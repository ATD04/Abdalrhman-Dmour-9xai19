"""
FastAPI Backend
----------------
Serves all data to the dashboard via REST endpoints.

Run with:
  uvicorn src.api.main:app --reload --port 8000

Endpoints:
  GET  /counts          — vehicle counts per direction
  GET  /forecasts       — latest DB-cached predictions per direction
  GET  /forecasts/live  — instant smart forecast (video + Google Maps + typical patterns)
  GET  /conditions      — latest Google Maps congestion
  GET  /events          — latest incidents
  GET  /summary         — everything in one call
"""

import sqlite3
import asyncio
import os
import cv2
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from datetime import datetime
import src.api.state as _state
from src.forecasting.smart_forecast import compute_and_save as _smart_forecast, compute_forecast

DB_PATH   = "Data/traffic.db"
DASH_DIR  = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "dashboard")

app = FastAPI(title="Wadi Saqra Traffic API")

# Allow dashboard to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup: seed DB + launch background forecast task ───────────────────────
@app.on_event("startup")
async def on_startup():
    """
    1. Seed the DB with typical Sunday/Monday patterns if it has too little data.
    2. Ensure the incidents table exists.
    3. Start the background task that updates forecasts every 60 s.
    """
    # Ensure incidents table exists
    try:
        _ensure_incidents_table()
    except Exception as exc:
        print(f"[startup] incidents table error: {exc}")

    # Seed typical data if DB is sparse
    try:
        conn = sqlite3.connect(DB_PATH)
        n = conn.execute("SELECT COUNT(*) FROM detector_readings").fetchone()[0]
        conn.close()
        if n < 100:
            from src.acquisition.seed_typical_data import seed
            seed(weeks_back=3)
    except Exception as exc:
        print(f"[startup] seed check failed: {exc}")

    # Launch background forecast updater
    asyncio.create_task(_forecast_background_loop())


async def _forecast_background_loop():
    """Run the smart forecaster every 60 seconds and save results to DB."""
    while True:
        try:
            _smart_forecast()
        except Exception as exc:
            print(f"[forecast-loop] error: {exc}")
        await asyncio.sleep(60)


# Serve dashboard HTML at root
@app.get("/")
def serve_dashboard():
    return FileResponse(os.path.join(DASH_DIR, "index.html"))

# Serve any other static file in dashboard/
app.mount("/dashboard", StaticFiles(directory=DASH_DIR), name="dashboard")

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

# ── DB helper ──────────────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

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

# ── Live Forecast (instant, no DB cache) ──────────────────────────────────────
@app.get("/forecasts/live")
def get_forecasts_live():
    """
    Instant smart forecast computed right now from:
      • Live video detection counts + elapsed session time
      • Latest Google Maps congestion ratio
      • Typical Sunday/Monday traffic patterns for Wadi Saqra

    Returns per-direction predictions for +15 min, +30 min and +60 min,
    plus metadata explaining which data sources were used.
    """
    with _state.lock:
        live_counts = dict(_state.live_counts)
        start_time  = _state.detection_start_time
        running     = _state.detection_running

    now = datetime.now()
    elapsed_min = (
        (now - start_time).total_seconds() / 60.0
        if (running and start_time is not None)
        else 0.0
    )

    # Get latest Google Maps congestion
    congestion = 1.0
    cong_ts    = None
    try:
        conn = get_db()
        row = conn.execute("""
            SELECT congestion_ratio, timestamp FROM traffic_conditions
            ORDER BY timestamp DESC LIMIT 1
        """).fetchone()
        conn.close()
        if row and row["congestion_ratio"] is not None:
            congestion = float(row["congestion_ratio"])
            cong_ts    = row["timestamp"]
    except Exception:
        pass

    forecasts = compute_forecast(live_counts, elapsed_min, congestion, now)

    # Flatten to list for dashboard compatibility
    flat = []
    for direction, horizons in forecasts.items():
        for horizon_min, count in horizons.items():
            flat.append({
                "direction":       direction,
                "horizon_minutes": horizon_min,
                "predicted_count": count,
                "created_at":      now.isoformat(),
            })

    return {
        "forecasts":            flat,
        "metadata": {
            "source":           "live_video+google_maps" if elapsed_min > 0.5 else "typical_pattern+google_maps",
            "detection_running": running,
            "elapsed_min":      round(elapsed_min, 1),
            "live_weight_pct":  round(min(100, elapsed_min / 15.0 * 100)),
            "congestion_ratio": round(congestion, 2),
            "congestion_ts":    cong_ts,
            "computed_at":      now.isoformat(),
        },
    }

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
    live_fc = get_forecasts_live()
    return {
        "timestamp":       datetime.now().isoformat(),
        "counts":          get_counts_summary(),
        "forecasts":       live_fc["forecasts"],
        "forecast_meta":   live_fc["metadata"],
        "conditions":      get_latest_condition(),
        "events":          get_events(limit=5),
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


# ── Chatbot ────────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message:    str
    session_id: str | None = None   # omit to start a new session


class ChatResetRequest(BaseModel):
    session_id: str


@app.post("/chat")
def chat_endpoint(req: ChatRequest):
    """
    Send a message to the Wadi Saqra traffic assistant (powered by Claude).
    The assistant has access to all live data tools (YOLO counts, Google Maps,
    forecasts, signal states, history).

    Request body:
        { "message": "How heavy is traffic right now?", "session_id": "<uuid>" }

    Response:
        { "reply": "...", "session_id": "...", "tools_used": [...], "turn": N }

    Omit session_id to start a fresh conversation — a new ID will be returned.
    """
    try:
        from src.chatbot.claude_chat import chat, new_session
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Chatbot module not available: {e}")

    sid = req.session_id or new_session()
    try:
        result = chat(sid, req.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return result


@app.post("/chat/reset")
def chat_reset(req: ChatResetRequest):
    """Clear conversation history for a session."""
    try:
        from src.chatbot.claude_chat import reset_session
        reset_session(req.session_id)
    except ImportError:
        pass
    return {"status": "ok", "session_id": req.session_id}


@app.get("/chat/session")
def chat_new_session():
    """Get a fresh session ID."""
    try:
        from src.chatbot.claude_chat import new_session
        return {"session_id": new_session()}
    except ImportError as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# ADVANCED ANALYTICS ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

# ── Constants ─────────────────────────────────────────────────────────────────
LANE_CAPACITY_VPH = 1500          # standard single-lane hourly capacity
_CYCLE_SEC        = 109.1
_PHASE_GREEN_SEC  = {"North": 30, "South": 30, "East": 35, "West": 29}


def _ensure_incidents_table():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS incidents (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            direction TEXT,
            type      TEXT NOT NULL,
            notes     TEXT DEFAULT '',
            source    TEXT DEFAULT 'operator'
        )
    """)
    conn.commit()
    conn.close()


def _get_congestion_ratio() -> float:
    try:
        conn = get_db()
        row = conn.execute(
            "SELECT congestion_ratio FROM traffic_conditions ORDER BY timestamp DESC LIMIT 1"
        ).fetchone()
        conn.close()
        if row and row["congestion_ratio"]:
            return float(row["congestion_ratio"])
    except Exception:
        pass
    return 1.0


def _get_elapsed_and_counts():
    with _state.lock:
        counts     = dict(_state.live_counts)
        running    = _state.detection_running
        start_time = _state.detection_start_time
    now = datetime.now()
    elapsed = (
        (now - start_time).total_seconds() / 60.0
        if (running and start_time is not None)
        else 0.0
    )
    return counts, elapsed, running, now


# ── Signal Advisor ─────────────────────────────────────────────────────────────
@app.get("/signal/advisor")
def get_signal_advisor():
    """Rule-based signal recommendations per direction with explanations."""
    counts, elapsed, running, now = _get_elapsed_and_counts()
    congestion = _get_congestion_ratio()

    recs = []
    for direction in ["North", "South", "East", "West"]:
        count         = counts.get(direction, 0)
        rate_per_hour = round((count / elapsed * 60) if elapsed > 0.5 else 0)
        green_sec     = _PHASE_GREEN_SEC[direction]
        green_frac    = green_sec / _CYCLE_SEC
        capacity      = round(LANE_CAPACITY_VPH * green_frac)
        load_pct      = min(round(rate_per_hour / capacity * 100) if capacity else 0, 150)

        if load_pct > 90:
            action   = "Extend Green Phase"
            reason   = f"{direction} is at {load_pct}% of capacity — add 10–15 s to green"
            priority = "high"
        elif load_pct > 70:
            action   = "Monitor Closely"
            reason   = f"{direction} approaching capacity ({load_pct}%) — consider +5 s green"
            priority = "medium"
        elif load_pct < 20 and green_sec > 20 and elapsed > 2:
            action   = "Reduce Green Phase"
            reason   = f"{direction} at only {load_pct}% capacity — shorten green by 5 s"
            priority = "low"
        else:
            action   = "Optimal"
            reason   = f"{direction} operating efficiently at {load_pct}% capacity"
            priority = "ok"

        recs.append({
            "direction":        direction,
            "action":           action,
            "reason":           reason,
            "priority":         priority,
            "load_pct":         load_pct,
            "rate_per_hour":    rate_per_hour,
            "capacity_per_hour": capacity,
            "green_sec":        green_sec,
        })

    max_load = max(r["load_pct"] for r in recs)
    traffic_state = (
        "Critical" if max_load > 90 or congestion > 1.8 else
        "Warning"  if max_load > 70 or congestion > 1.3 else
        "Normal"
    )

    return {
        "traffic_state":    traffic_state,
        "congestion_ratio": round(congestion, 2),
        "recommendations":  recs,
        "data_available":   elapsed > 0.5,
        "computed_at":      now.isoformat(),
    }


# ── Analytics: Hourly Heatmap ─────────────────────────────────────────────────
@app.get("/analytics/heatmap")
def get_heatmap():
    """Average hourly vehicle count per direction (last 30 days from DB)."""
    conn = get_db()
    rows = conn.execute("""
        SELECT hour, direction, AVG(vehicle_count) AS avg_count
        FROM detector_readings
        WHERE timestamp >= datetime('now', '-30 days')
        GROUP BY hour, direction
        ORDER BY hour, direction
    """).fetchall()
    conn.close()

    result = {h: {"North": 0.0, "South": 0.0, "East": 0.0, "West": 0.0} for h in range(24)}
    for row in rows:
        h = row["hour"]
        d = row["direction"]
        if h in result and d in result[h]:
            result[h][d] = round(float(row["avg_count"]) * 4, 1)   # per-15min → hourly

    return {"hours": [{"hour": h, **result[h]} for h in range(24)]}


# ── Analytics: Economic Cost ──────────────────────────────────────────────────
@app.get("/analytics/cost")
def get_cost():
    """Estimates total delay and fuel cost for vehicles in current session."""
    try:
        conn = get_db()
        row = conn.execute("""
            SELECT congestion_ratio, travel_time_normal, travel_time_traffic
            FROM traffic_conditions ORDER BY timestamp DESC LIMIT 1
        """).fetchone()
        conn.close()
    except Exception:
        row = None

    counts, elapsed, _, _ = _get_elapsed_and_counts()
    total_vehicles = sum(counts.values())

    if row and row["travel_time_normal"] and row["travel_time_traffic"]:
        delay_sec  = max(0.0, float(row["travel_time_traffic"]) - float(row["travel_time_normal"]))
        congestion = float(row["congestion_ratio"] or 1.0)
    else:
        delay_sec  = 0.0
        congestion = 1.0

    # Fuel: idling ~0.8 L/hr, fuel price ~1.1 JOD/L
    delay_hours             = delay_sec / 3600.0
    fuel_per_vehicle_jod    = delay_hours * 0.8 * 1.1
    total_delay_min         = round(total_vehicles * delay_sec / 60.0, 1)
    total_fuel_jod          = round(total_vehicles * fuel_per_vehicle_jod, 2)

    return {
        "congestion_ratio":           round(congestion, 2),
        "delay_per_vehicle_sec":      round(delay_sec),
        "total_vehicles_this_session": total_vehicles,
        "total_delay_minutes":        total_delay_min,
        "estimated_fuel_cost_jod":    total_fuel_jod,
        "fuel_cost_per_vehicle_fils": round(fuel_per_vehicle_jod * 1000, 1),
        "note": "Based on Google Maps travel-time delta × session vehicle count",
    }


# ── Analytics: Demand vs Capacity ─────────────────────────────────────────────
@app.get("/analytics/capacity")
def get_capacity():
    """Demand vs capacity per direction."""
    counts, elapsed, _, _ = _get_elapsed_and_counts()
    result = []
    for direction in ["North", "South", "East", "West"]:
        count         = counts.get(direction, 0)
        rate_per_hour = round((count / elapsed * 60) if elapsed > 0.5 else 0)
        green_sec     = _PHASE_GREEN_SEC[direction]
        capacity      = round(LANE_CAPACITY_VPH * (green_sec / _CYCLE_SEC))
        load_pct      = min(round(rate_per_hour / capacity * 100) if capacity else 0, 150)
        result.append({
            "direction":        direction,
            "rate_per_hour":    rate_per_hour,
            "capacity_per_hour": capacity,
            "load_pct":         load_pct,
        })
    return {"directions": result, "elapsed_min": round(elapsed, 1)}


# ── Analytics: Past vs Future Comparison ──────────────────────────────────────
@app.get("/analytics/comparison")
def get_comparison():
    """Historical hourly averages (last 4 h) vs live forecast (next 3 horizons)."""
    now  = datetime.now()
    hour = now.hour

    conn   = get_db()
    hist   = []
    for h in range(max(0, hour - 3), hour + 1):
        rows = conn.execute("""
            SELECT direction, AVG(vehicle_count) AS avg_count
            FROM detector_readings WHERE hour = ?
            GROUP BY direction
        """, (h,)).fetchall()
        avg  = {r["direction"]: round(float(r["avg_count"]) * 4) for r in rows}
        hist.append({"hour": h, "label": f"{h:02d}:00",
                     "North": avg.get("North", 0), "South": avg.get("South", 0),
                     "East":  avg.get("East",  0), "West":  avg.get("West",  0)})
    conn.close()

    counts, elapsed, running, _ = _get_elapsed_and_counts()
    congestion = _get_congestion_ratio()
    forecasts  = compute_forecast(counts, elapsed, congestion, now)

    future = []
    for h_off, horizon in [(1, 15), (2, 30), (4, 60)]:
        fh   = (hour + h_off) % 24
        fdata = {"hour": fh, "label": f"+{horizon}m", "is_forecast": True}
        for d in ["North", "South", "East", "West"]:
            fdata[d] = forecasts.get(d, {}).get(horizon, 0)
        future.append(fdata)

    return {"historical": hist, "forecast": future}


# ── Incidents ──────────────────────────────────────────────────────────────────
class IncidentReport(BaseModel):
    direction:     str
    incident_type: str
    notes:         str = ""


@app.post("/incidents")
def report_incident(req: IncidentReport):
    """Report a traffic incident from the dashboard."""
    _ensure_incidents_table()
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO incidents (timestamp, direction, type, notes, source) VALUES (?,?,?,?,'operator')",
        (datetime.now().isoformat(), req.direction, req.incident_type, req.notes),
    )
    conn.commit()
    conn.close()
    return {"status": "reported", "timestamp": datetime.now().isoformat()}


@app.get("/incidents")
def get_incidents_list(limit: int = 20):
    """Get recent operator-reported incidents."""
    try:
        _ensure_incidents_table()
        conn  = get_db()
        rows  = conn.execute("""
            SELECT id, timestamp, direction, type, notes
            FROM incidents ORDER BY timestamp DESC LIMIT ?
        """, (limit,)).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception:
        return []
