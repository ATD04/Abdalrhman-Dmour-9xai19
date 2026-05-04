"""
FastAPI Backend
----------------
Serves all data to the dashboard via REST endpoints.

Run with:
  uvicorn src.api.main:app --reload --port 8000

Endpoints:
  GET  /counts       — vehicle counts per direction
  GET  /forecasts    — latest predictions per direction
  GET  /conditions   — latest Google Maps congestion
  GET  /events       — latest incidents
  GET  /summary      — everything in one call
"""

import sqlite3
import asyncio
import os
import cv2
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from datetime import datetime
import src.api.state as _state

DB_PATH   = "Data/traffic.db"
DASH_DIR  = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "dashboard")

app = FastAPI(title="Wadi Saqra Traffic API")

# Allow React dashboard to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve dashboard HTML at root
@app.get("/")
def serve_dashboard():
    return FileResponse(os.path.join(DASH_DIR, "index.html"))

# Serve any other static file in dashboard/
app.mount("/dashboard", StaticFiles(directory=DASH_DIR), name="dashboard")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# ── Live Video Feed (MJPEG) ──────────────────────────────────────────────────
async def _mjpeg_generator():
    while True:
        with _state.lock:
            frame = _state.latest_frame
        if frame is not None:
            ok, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if ok:
                yield (
                    b'--frame\r\n'
                    b'Content-Type: image/jpeg\r\n\r\n'
                    + buf.tobytes()
                    + b'\r\n'
                )
        await asyncio.sleep(0.04)   # ~25 fps cap

@app.get("/video_feed")
async def video_feed():
    """MJPEG stream of the live annotated detection video."""
    return StreamingResponse(
        _mjpeg_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )

# ── Live Counts (real-time per crossing) ──────────────────────────────────
@app.get("/live_counts")
def live_counts():
    """Real-time vehicle count per direction from the running detection."""
    with _state.lock:
        counts  = dict(_state.live_counts)
        running = _state.detection_running
    return {
        "running": running,
        "counts":  counts,
        "total":   sum(counts.values()),
    }

# ── Live Stats (per-frame object counts, types, confidence) ───────────────────
@app.get("/live_stats")
def live_stats_endpoint():
    """Per-frame detection statistics + signal phase derived from video position."""
    with _state.lock:
        stats      = dict(_state.live_stats)
        counts     = dict(_state.live_counts)
        running    = _state.detection_running
        vid_t      = _state.frame_time          # seconds into current video loop

    # ── Signal phase from VIDEO timestamp ─────────────────────────────────
    # Calibrated from crossing data (every loop is consistent):
    #   N/S crossings: 0→35s  |  E crossings: 35→75s  |  W crossings: 75→104s
    # East and West are SEPARATE phases — never simultaneously green.
    # Phases (109.1s full cycle = one video loop):
    #   0  – 30s : N/S green,  E red,    W red
    #   30 – 35s : N/S yellow, E red,    W red
    #   35 – 70s : N/S red,    E green,  W red
    #   70 – 75s : N/S red,    E yellow, W red
    #   75 – 104s: N/S red,    E red,    W green
    #   104– 109s: N/S red,    E red,    W yellow
    FULL = 109.1
    PHASES = [
        (0,    30,   "green",  "red",    "red"),
        (30,   35,   "yellow", "red",    "red"),
        (35,   70,   "red",    "green",  "red"),
        (70,   75,   "red",    "yellow", "red"),
        (75,   104,  "red",    "red",    "green"),
        (104,  FULL, "red",    "red",    "yellow"),
    ]

    phase = vid_t % FULL
    ns = ew_e = ew_w = "red"
    phase_start = phase_end = 0.0
    for (p_start, p_end, _ns, _e, _w) in PHASES:
        if phase < p_end:
            ns, ew_e, ew_w = _ns, _e, _w
            phase_start, phase_end = p_start, p_end
            break

    stats["running"]         = running
    stats["signals"]         = {"North": ns, "South": ns, "East": ew_e, "West": ew_w}
    stats["phase_elapsed"]   = round(phase - phase_start, 1)
    stats["phase_remaining"] = round(phase_end - phase, 1)
    stats["live_counts"]     = counts
    stats["vid_phase"]       = round(phase, 1)
    return stats

# ── Vehicle Counts ─────────────────────────────────────────────────────────────
@app.get("/counts")
def get_counts(limit: int = 50):
    """Latest vehicle counts per direction."""
    conn = get_db()
    rows = conn.execute("""
        SELECT timestamp, direction, vehicle_count, hour, day_of_week
        FROM detector_readings
        ORDER BY timestamp DESC
        LIMIT ?
    """, (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/counts/summary")
def get_counts_summary():
    """Total count per direction from all data."""
    conn = get_db()
    rows = conn.execute("""
        SELECT direction, SUM(vehicle_count) as total, AVG(vehicle_count) as avg_per_15min
        FROM detector_readings
        GROUP BY direction
        ORDER BY total DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ── Forecasts ──────────────────────────────────────────────────────────────────
@app.get("/forecasts")
def get_forecasts():
    """Latest forecast for each direction + horizon."""
    conn = get_db()
    rows = conn.execute("""
        SELECT f.direction, f.horizon_minutes, f.predicted_count, f.created_at
        FROM forecasts f
        INNER JOIN (
            SELECT direction, horizon_minutes, MAX(created_at) as latest
            FROM forecasts
            GROUP BY direction, horizon_minutes
        ) latest ON f.direction = latest.direction
               AND f.horizon_minutes = latest.horizon_minutes
               AND f.created_at = latest.latest
        ORDER BY f.direction, f.horizon_minutes
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ── Traffic Conditions ─────────────────────────────────────────────────────────
@app.get("/conditions")
def get_conditions(limit: int = 20):
    """Latest Google Maps congestion readings."""
    conn = get_db()
    rows = conn.execute("""
        SELECT timestamp, congestion_ratio, travel_time_normal, travel_time_traffic
        FROM traffic_conditions
        ORDER BY timestamp DESC
        LIMIT ?
    """, (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/conditions/latest")
def get_latest_condition():
    """Single latest congestion reading."""
    conn = get_db()
    row = conn.execute("""
        SELECT timestamp, congestion_ratio, travel_time_normal, travel_time_traffic
        FROM traffic_conditions
        ORDER BY timestamp DESC
        LIMIT 1
    """).fetchone()
    conn.close()
    if row:
        data = dict(row)
        ratio = data["congestion_ratio"] or 1.0
        data["level"] = (
            "free_flow" if ratio < 1.3 else
            "moderate"  if ratio < 1.8 else
            "heavy"
        )
        return data
    return {"congestion_ratio": None, "level": "unknown"}

# ── Events / Incidents ─────────────────────────────────────────────────────────
@app.get("/events")
def get_events(limit: int = 20):
    """Latest detected incidents."""
    conn = get_db()
    rows = conn.execute("""
        SELECT timestamp, event_type, direction, confidence
        FROM events
        ORDER BY timestamp DESC
        LIMIT ?
    """, (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ── Summary (everything in one call for dashboard) ────────────────────────────
@app.get("/summary")
def get_summary():
    """Full snapshot for the dashboard — one request gets everything."""
    return {
        "timestamp":  datetime.now().isoformat(),
        "counts":     get_counts_summary(),
        "forecasts":  get_forecasts(),
        "conditions": get_latest_condition(),
        "events":     get_events(limit=5),
    }

# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    conn = get_db()
    counts_n = conn.execute("SELECT COUNT(*) FROM detector_readings").fetchone()[0]
    forecasts_n = conn.execute("SELECT COUNT(*) FROM forecasts").fetchone()[0]
    conn.close()
    return {
        "status":   "ok",
        "time":     datetime.now().isoformat(),
        "db_rows":  {"detector_readings": counts_n, "forecasts": forecasts_n},
    }
