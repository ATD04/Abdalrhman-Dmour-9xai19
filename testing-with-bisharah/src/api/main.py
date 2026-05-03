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
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

DB_PATH = "Data/traffic.db"

app = FastAPI(title="Wadi Saqra Traffic API")

# Allow React dashboard to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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
