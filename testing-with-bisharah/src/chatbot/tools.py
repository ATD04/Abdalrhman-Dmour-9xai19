"""
MCP Tool Definitions + Implementations — Wadi Saqra Traffic System
-------------------------------------------------------------------
Each tool reads from either:
  • src.api.state   — shared in-process live detection data (YOLO)
  • Data/traffic.db — SQLite for congestion, forecasts, history
  • Computed logic   — signal phase, forecast blend

These tools are given to Claude via the tool_use API so it can
answer any question about live or historical traffic conditions.
"""

import sqlite3
import os
from datetime import datetime
from collections import defaultdict
from dotenv import load_dotenv

load_dotenv()

DB_PATH    = os.getenv("DB_PATH", "Data/traffic.db")
DIRECTIONS = ["North", "South", "East", "West"]

# ── Static intersection information ──────────────────────────────────────────
INTERSECTION_INFO = {
    "name":        "Wadi Saqra Intersection (تقاطع وادي صقرة)",
    "city":        "Amman, Jordan",
    "coordinates": {"lat": 31.966688, "lng": 35.887007},
    "roads": [
        "Arar Street — main N/S flow (carries ~60% of traffic)",
        "Prince Shaker Street — main E/W connector",
        "Kindi Street — secondary access",
    ],
    "nearby_landmarks": [
        "King Abdullah I Park (north)",
        "Istishari Hospital (southwest) — major traffic generator",
        "McDonald's + Amman TV (southeast)",
        "Wahbeh Tamari Kindergarten (east)",
        "Mariposa Clinic (south)",
    ],
    "signal_cycle": {
        "total_sec": 109,
        "phases": [
            "North/South GREEN  30 s",
            "North/South YELLOW  5 s",
            "East GREEN  35 s",
            "East YELLOW  5 s",
            "West GREEN  29 s",
            "West YELLOW  5 s",
        ],
        "note": "East and West phases are separate — never both green simultaneously",
    },
    "monitoring_system": {
        "model":      "YOLO v2.6s (small) — real-time object detection",
        "counting":   "Line-crossing algorithm with direction filtering",
        "directions": "4 counting lines: North, South, East, West",
        "forecasting": "Hybrid: live YOLO rates + Google Maps congestion + Sun/Mon typical patterns",
    },
}

# ── Signal phase lookup ───────────────────────────────────────────────────────
_FULL_CYCLE = 109.1
_PHASES = [
    (0,    30,   "green",  "red",    "red"),
    (30,   35,   "yellow", "red",    "red"),
    (35,   70,   "red",    "green",  "red"),
    (70,   75,   "red",    "yellow", "red"),
    (75,   104,  "red",    "red",    "green"),
    (104,  _FULL_CYCLE, "red",  "red", "yellow"),
]


def _get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _get_state() -> dict:
    """Read shared in-process state; returns safe defaults if not available."""
    try:
        import src.api.state as _state
        with _state.lock:
            return {
                "live_counts":       dict(_state.live_counts),
                "live_stats":        dict(_state.live_stats),
                "detection_running": _state.detection_running,
                "frame_time":        _state.frame_time,
                "detection_start":   _state.detection_start_time,
            }
    except Exception:
        return {
            "live_counts":       {"North": 0, "South": 0, "East": 0, "West": 0},
            "live_stats":        {},
            "detection_running": False,
            "frame_time":        0.0,
            "detection_start":   None,
        }


def _elapsed_minutes(state: dict) -> float:
    if not state["detection_running"] or state["detection_start"] is None:
        return 0.0
    return (datetime.now() - state["detection_start"]).total_seconds() / 60.0


# ═══════════════════════════════════════════════════════════════════════════════
# TOOL IMPLEMENTATIONS
# ═══════════════════════════════════════════════════════════════════════════════

def tool_get_live_counts(_args: dict = None) -> dict:
    """Cumulative vehicles that crossed each line since detection started."""
    s       = _get_state()
    counts  = s["live_counts"]
    total   = sum(counts.values())
    elapsed = _elapsed_minutes(s)

    # Compute rate per minute per direction
    rates = {}
    if elapsed > 0.5:
        rates = {d: round(counts[d] / elapsed, 1) for d in DIRECTIONS}

    return {
        "detection_running":    s["detection_running"],
        "elapsed_minutes":      round(elapsed, 1),
        "counts_since_start": {
            "North": counts["North"],
            "South": counts["South"],
            "East":  counts["East"],
            "West":  counts["West"],
            "total": total,
        },
        "rate_per_minute": rates if rates else "not_enough_data",
        "busiest_direction": max(counts, key=counts.get) if total > 0 else "N/A",
        "note": (
            "Cumulative vehicles that physically crossed the counting line per direction."
            if s["detection_running"]
            else "Detection is not currently running — counts show last session values."
        ),
    }


def tool_get_live_detection_stats(_args: dict = None) -> dict:
    """Instantaneous YOLO frame stats: what the camera sees right now."""
    s    = _get_state()
    st   = s["live_stats"]
    conf = st.get("avg_confidence", 0)

    return {
        "detection_running":      s["detection_running"],
        "vehicles_in_frame_now":  st.get("visible_now", 0),
        "moving":                 st.get("moving", 0),
        "stopped_or_waiting":     st.get("stopped", 0),
        "vehicle_types": {
            "cars":        st.get("cars", 0),
            "trucks":      st.get("trucks", 0),
            "buses":       st.get("buses", 0),
            "motorcycles": st.get("motos", 0),
        },
        "unique_vehicles_tracked_this_session": st.get("session_tracks", 0),
        "ai_confidence": {
            "percentage": conf,
            "label": (
                "High (>70%)"   if conf >= 70 else
                "Medium (45–70%)" if conf >= 45 else
                "Low (<45%)"    if conf > 0  else
                "N/A — detection not running"
            ),
        },
        "ai_model": "YOLO v2.6s",
    }


def tool_get_signal_state(_args: dict = None) -> dict:
    """Current traffic light phase derived from video position."""
    s      = _get_state()
    vid_t  = s["frame_time"]
    phase  = vid_t % _FULL_CYCLE

    ns = ew_e = ew_w = "red"
    ps = pe = 0.0
    for (p_start, p_end, _ns, _e, _w) in _PHASES:
        if phase < p_end:
            ns, ew_e, ew_w = _ns, _e, _w
            ps, pe = p_start, p_end
            break

    elapsed   = round(phase - ps, 1)
    remaining = round(pe - phase, 1)
    active    = [d for d, st in [("North", ns), ("South", ns),
                                  ("East", ew_e), ("West", ew_w)] if st == "green"]

    return {
        "available": s["detection_running"],
        "signals": {
            "North": ns,
            "South": ns,
            "East":  ew_e,
            "West":  ew_w,
        },
        "currently_green_directions": active,
        "current_phase_elapsed_sec":  elapsed,
        "current_phase_remaining_sec": remaining,
        "full_cycle_sec": _FULL_CYCLE,
        "cycle_description": (
            "Phases: N/S Green(30s) → N/S Yellow(5s) → "
            "East Green(35s) → East Yellow(5s) → "
            "West Green(29s) → West Yellow(5s)"
        ),
        "note": (
            "Signal state is synced with the detection video position."
            if s["detection_running"]
            else "Detection not running — signal state unavailable."
        ),
    }


def tool_get_forecast(args: dict = None) -> dict:
    """Hybrid +15/+30/+60 min vehicle count forecast."""
    direction = (args or {}).get("direction")
    s = _get_state()
    now = datetime.now()
    elapsed = _elapsed_minutes(s)

    congestion = 1.0
    cong_ts    = None
    try:
        conn = _get_db()
        row = conn.execute("""
            SELECT congestion_ratio, timestamp
            FROM traffic_conditions ORDER BY timestamp DESC LIMIT 1
        """).fetchone()
        conn.close()
        if row and row["congestion_ratio"]:
            congestion = float(row["congestion_ratio"])
            cong_ts    = row["timestamp"]
    except Exception:
        pass

    try:
        from src.forecasting.smart_forecast import compute_forecast
        forecasts = compute_forecast(s["live_counts"], elapsed, congestion, now)
    except Exception as e:
        return {"error": f"Forecast computation failed: {e}"}

    live_pct = round(min(100, elapsed / 15.0 * 100))
    source = (
        f"Live YOLO video ({live_pct}% weight) + Google Maps congestion"
        if elapsed > 0.5
        else "Typical Wadi Saqra Sunday/Monday pattern + Google Maps congestion"
    )

    if direction and direction in forecasts:
        fc_data = {direction: forecasts[direction]}
    else:
        fc_data = forecasts

    output = {}
    for d, horizons in fc_data.items():
        output[d] = {
            "+15 min": horizons.get(15, 0),
            "+30 min": horizons.get(30, 0),
            "+60 min": horizons.get(60, 0),
        }

    return {
        "predicted_vehicle_counts": output,
        "forecast_source":          source,
        "congestion_ratio_applied": round(congestion, 2),
        "congestion_data_at":       cong_ts,
        "detection_elapsed_min":    round(elapsed, 1),
        "live_data_weight_pct":     live_pct,
        "interpretation": (
            "Values are expected vehicles that will cross each direction's counting line "
            "in that future time window. Higher congestion → slightly more vehicles queuing."
        ),
    }


def tool_get_congestion(_args: dict = None) -> dict:
    """Google Maps congestion ratio for the Wadi Saqra corridor."""
    try:
        conn  = _get_db()
        rows  = conn.execute("""
            SELECT timestamp, congestion_ratio, travel_time_normal, travel_time_traffic
            FROM traffic_conditions ORDER BY timestamp DESC LIMIT 5
        """).fetchall()
        conn.close()
    except Exception as e:
        return {"error": str(e)}

    if not rows:
        return {
            "status":  "no_data",
            "message": "No Google Maps data available yet. Start google_traffic.py to collect data.",
        }

    latest = dict(rows[0])
    ratio  = latest.get("congestion_ratio") or 1.0
    normal = latest.get("travel_time_normal") or 0
    actual = latest.get("travel_time_traffic") or 0
    delay  = max(0, actual - normal)

    level  = "free_flow" if ratio < 1.3 else "moderate" if ratio < 1.8 else "heavy"
    labels = {
        "free_flow": "🟢 Free Flow — traffic moving normally",
        "moderate":  "🟡 Moderate — some slowdowns",
        "heavy":     "🔴 Heavy Traffic — significant delays",
    }

    return {
        "corridor": "Arar Street (N/S) through Wadi Saqra intersection",
        "congestion_ratio": round(ratio, 2),
        "status": level,
        "status_description": labels[level],
        "travel_times": {
            "normal_sec": normal,
            "with_traffic_sec": actual,
            "extra_delay_sec": delay,
            "extra_delay_min": round(delay / 60, 1),
        },
        "data_timestamp": latest.get("timestamp"),
        "interpretation": (
            f"Ratio {ratio:.2f} means the journey takes {ratio:.1f}x longer than normal. "
            f"{'No significant delay.' if delay < 30 else f'Extra {round(delay/60,1)} minutes of delay.'}"
        ),
        "recent_readings": [
            {"time": dict(r)["timestamp"][11:16], "ratio": dict(r)["congestion_ratio"]}
            for r in rows
        ],
    }


def tool_get_traffic_summary(_args: dict = None) -> dict:
    """All live data in one comprehensive snapshot."""
    return {
        "timestamp":       datetime.now().isoformat(),
        "intersection":    INTERSECTION_INFO["name"],
        "location":        "Amman, Jordan — Arar St × Prince Shaker St",
        "live_counts":     tool_get_live_counts(),
        "detection_stats": tool_get_live_detection_stats(),
        "signals":         tool_get_signal_state(),
        "forecast":        tool_get_forecast(),
        "congestion":      tool_get_congestion(),
    }


def tool_get_historical_counts(_args: dict = None) -> dict:
    """Historical aggregate stats from DB (typical patterns + past sessions)."""
    try:
        conn = _get_db()
        totals = conn.execute("""
            SELECT direction,
                   SUM(vehicle_count)  AS total,
                   AVG(vehicle_count)  AS avg_per_15min,
                   COUNT(*)            AS windows_recorded
            FROM detector_readings
            GROUP BY direction ORDER BY total DESC
        """).fetchall()

        by_hour = conn.execute("""
            SELECT direction, hour, AVG(vehicle_count) AS avg_count
            FROM detector_readings
            GROUP BY direction, hour
            ORDER BY direction, hour
        """).fetchall()
        conn.close()
    except Exception as e:
        return {"error": str(e)}

    # Totals
    totals_list = [
        {
            "direction":       dict(r)["direction"],
            "total_vehicles":  int(dict(r)["total"]),
            "avg_per_15min":   round(dict(r)["avg_per_15min"], 1),
            "data_windows":    dict(r)["windows_recorded"],
        }
        for r in totals
    ]

    # Peak hours per direction
    peaks = defaultdict(lambda: {"hour": 0, "avg_vehicles_per_15min": 0.0})
    for row in by_hour:
        r = dict(row)
        d = r["direction"]
        if r["avg_count"] > peaks[d]["avg_vehicles_per_15min"]:
            peaks[d] = {
                "hour": r["hour"],
                "avg_vehicles_per_15min": round(r["avg_count"], 1),
                "time_range": f"{r['hour']:02d}:00–{r['hour']:02d}:59",
            }

    # Busiest overall hour
    all_by_hour: dict[int, float] = defaultdict(float)
    for row in by_hour:
        r = dict(row)
        all_by_hour[r["hour"]] += r["avg_count"]
    busiest_hour = max(all_by_hour, key=all_by_hour.get) if all_by_hour else None

    return {
        "totals_per_direction":    totals_list,
        "peak_hour_per_direction": dict(peaks),
        "busiest_hour_overall": {
            "hour":       busiest_hour,
            "time_range": f"{busiest_hour:02d}:00–{busiest_hour:02d}:59" if busiest_hour is not None else "N/A",
            "total_avg_vehicles": round(all_by_hour.get(busiest_hour, 0), 1),
        },
        "note": "Data includes seeded typical Sunday/Monday patterns + real detection sessions.",
    }


def tool_get_recent_events(_args: dict = None) -> dict:
    """Latest traffic incidents/events logged at the intersection."""
    try:
        conn = _get_db()
        rows = conn.execute("""
            SELECT timestamp, event_type, direction, confidence
            FROM events ORDER BY timestamp DESC LIMIT 10
        """).fetchall()
        conn.close()
    except Exception as e:
        return {"error": str(e)}

    events = [dict(r) for r in rows]
    return {
        "event_count": len(events),
        "events": events,
        "message": (
            "No events recorded yet."
            if not events
            else f"{len(events)} recent event(s) found."
        ),
    }


def tool_get_intersection_info(_args: dict = None) -> dict:
    return INTERSECTION_INFO


# ═══════════════════════════════════════════════════════════════════════════════
# TOOL REGISTRY  (name → function + Claude schema)
# ═══════════════════════════════════════════════════════════════════════════════

TOOL_FUNCTIONS: dict[str, callable] = {
    "get_live_counts":          tool_get_live_counts,
    "get_live_detection_stats": tool_get_live_detection_stats,
    "get_signal_state":         tool_get_signal_state,
    "get_forecast":             tool_get_forecast,
    "get_congestion":           tool_get_congestion,
    "get_traffic_summary":      tool_get_traffic_summary,
    "get_historical_counts":    tool_get_historical_counts,
    "get_recent_events":        tool_get_recent_events,
    "get_intersection_info":    tool_get_intersection_info,
}

TOOL_SCHEMAS: list[dict] = [
    {
        "name": "get_live_counts",
        "description": (
            "Get real-time cumulative vehicle counts for each direction (North/South/East/West) "
            "at Wadi Saqra intersection, as counted by the YOLO AI from the live video feed. "
            "Also returns vehicles-per-minute rate and the busiest direction."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_live_detection_stats",
        "description": (
            "Get per-frame YOLO AI detection statistics: how many vehicles are currently visible "
            "in the camera frame, how many are moving vs stopped/waiting, vehicle type breakdown "
            "(cars/trucks/buses/motorcycles), unique vehicles tracked this session, and AI confidence %."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_signal_state",
        "description": (
            "Get the current traffic light state for each direction (green/yellow/red), "
            "which directions are currently green, how long the current phase has been active, "
            "and how many seconds remain until the next phase."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_forecast",
        "description": (
            "Get a smart traffic forecast for the next +15, +30, and +60 minutes at Wadi Saqra. "
            "The forecast blends live YOLO detection rates with Google Maps congestion and typical "
            "Sunday/Monday traffic patterns. Returns predicted vehicle counts per direction."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "direction": {
                    "type": "string",
                    "description": "Optional: filter to one direction. Omit for all four.",
                    "enum": ["North", "South", "East", "West"],
                }
            },
            "required": [],
        },
    },
    {
        "name": "get_congestion",
        "description": (
            "Get Google Maps traffic congestion data for the Wadi Saqra corridor (Arar Street). "
            "Returns congestion ratio (1.0=normal, 2.0=twice as slow), actual vs normal travel times, "
            "extra delay in minutes, and congestion level (free_flow/moderate/heavy)."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_traffic_summary",
        "description": (
            "Get a complete traffic snapshot in one call: live vehicle counts, YOLO detection stats, "
            "signal states, forecast, and congestion. Use this for general or overview questions "
            "about the current traffic situation at the intersection."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_historical_counts",
        "description": (
            "Get historical aggregate data from the database: total and average vehicle counts per "
            "direction, peak traffic hours for each direction, and the busiest hour overall. "
            "Data covers typical Sunday/Monday patterns plus past detection sessions."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_recent_events",
        "description": (
            "Get recent traffic events or incidents logged at the intersection "
            "(e.g. stalled vehicles, congestion alerts). Returns up to 10 latest events."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_intersection_info",
        "description": (
            "Get static information about the Wadi Saqra intersection: GPS coordinates, road names, "
            "nearby landmarks, signal cycle configuration, and monitoring system details."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
]
