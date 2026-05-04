"""
Smart Forecaster — Wadi Saqra Intersection, Amman
--------------------------------------------------
Hybrid real-time forecast combining three data sources:

  1. LIVE VIDEO counts — vehicles already crossed each line this session.
     The per-minute rate from the live detector is the most accurate
     short-term signal we have.

  2. GOOGLE MAPS congestion ratio — tells us how much slower than normal
     the road is right now (1.0 = normal, 2.0 = twice as slow).
     Higher congestion → more vehicles queuing at the intersection.

  3. TYPICAL Sunday/Monday patterns — hourly baseline counts seeded by
     seed_typical_data.py.  Used as a fallback when the detection session
     is short (< 15 min) or not running.

Blending logic
--------------
  blended_rate = live_weight × live_rate + (1 − live_weight) × typical_rate

  live_weight rises from 0 → 1 over the first 15 minutes of detection.
  This means:
    • First 5 min  → 67 % typical + 33 % live
    • 10 min       → 33 % typical + 67 % live
    • ≥ 15 min     → 100 % live

  For +60 min horizon the weight is reduced by half because traffic
  conditions 60 minutes out are less predictable from a 2-min session.

Congestion modifier
-------------------
  modifier = 1 + (congestion_ratio − 1) × 0.20
  e.g. congestion 1.5x → +10 % more vehicles expected (they spread longer).

Usage
-----
  from src.forecasting.smart_forecast import compute_and_save
  compute_and_save()      # reads state + DB, writes to forecasts table
"""

import sqlite3
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DB_PATH    = os.getenv("DB_PATH", "Data/traffic.db")
DIRECTIONS = ["North", "South", "East", "West"]
HORIZONS   = [15, 30, 60]

# ── Typical vehicles per 15-minute window, by hour ───────────────────────────
# Same table as seed_typical_data.py — kept here so the forecaster is
# self-contained and doesn't depend on the DB having seed data.
TYPICAL_15MIN: dict[int, dict[str, int]] = {
    0:  {"North": 2,  "South": 2,  "East": 1,  "West": 1},
    1:  {"North": 1,  "South": 1,  "East": 1,  "West": 1},
    2:  {"North": 1,  "South": 1,  "East": 0,  "West": 0},
    3:  {"North": 1,  "South": 1,  "East": 0,  "West": 0},
    4:  {"North": 1,  "South": 1,  "East": 1,  "West": 1},
    5:  {"North": 3,  "South": 2,  "East": 1,  "West": 1},
    6:  {"North": 6,  "South": 5,  "East": 3,  "West": 2},
    7:  {"North": 14, "South": 11, "East": 7,  "West": 6},
    8:  {"North": 24, "South": 19, "East": 12, "West": 10},
    9:  {"North": 19, "South": 16, "East": 9,  "West": 8},
    10: {"North": 13, "South": 11, "East": 7,  "West": 6},
    11: {"North": 15, "South": 13, "East": 8,  "West": 7},
    12: {"North": 18, "South": 16, "East": 10, "West": 9},
    13: {"North": 20, "South": 17, "East": 11, "West": 10},
    14: {"North": 15, "South": 13, "East": 8,  "West": 7},
    15: {"North": 17, "South": 15, "East": 9,  "West": 8},
    16: {"North": 22, "South": 19, "East": 12, "West": 10},
    17: {"North": 30, "South": 26, "East": 15, "West": 13},
    18: {"North": 34, "South": 29, "East": 17, "West": 15},
    19: {"North": 25, "South": 22, "East": 13, "West": 11},
    20: {"North": 17, "South": 15, "East": 9,  "West": 8},
    21: {"North": 11, "South": 10, "East": 6,  "West": 5},
    22: {"North": 7,  "South": 6,  "East": 4,  "West": 3},
    23: {"North": 4,  "South": 3,  "East": 2,  "West": 2},
}

# Sunday is Jordan's first workday — slightly heavier morning flow
SUNDAY_MULTIPLIER = {
    "North": 1.15, "South": 1.10, "East": 1.10, "West": 1.05,
}


def _typical_rate(hour: int, direction: str, day_of_week: int) -> float:
    """
    Returns typical vehicles-per-minute for a given hour and direction.
    Applies Sunday multiplier when day_of_week == 6.
    """
    base = TYPICAL_15MIN.get(hour, {}).get(direction, 1)
    if day_of_week == 6:   # Sunday
        base = base * SUNDAY_MULTIPLIER.get(direction, 1.0)
    return base / 15.0     # convert 15-min count → vehicles per minute


def _forecast_for_horizon(
    live_rate:    float,
    typical_rate: float,
    live_weight:  float,
    horizon_min:  int,
    cong_mod:     float,
    hour_target:  int,
    direction:    str,
    day_of_week:  int,
) -> int:
    """
    Compute forecast count for one direction at one horizon.
    For +60 min we weight typical patterns more heavily because
    conditions this far out are less predictable from current traffic.
    """
    if horizon_min == 60:
        # Pull toward the typical rate for the target hour
        target_typical = _typical_rate(hour_target % 24, direction, day_of_week)
        w = live_weight * 0.4      # max 40 % live for 1-hour forecast
        rate = w * live_rate + (1 - w) * target_typical
    else:
        rate = live_weight * live_rate + (1 - live_weight) * typical_rate

    projected = max(0, round(rate * horizon_min * cong_mod))
    return projected


def compute_forecast(
    live_counts:   dict[str, int],
    elapsed_min:   float,
    congestion:    float,
    now:           datetime,
) -> dict[str, dict[int, int]]:
    """
    Core forecast computation.

    Parameters
    ----------
    live_counts   : vehicles that crossed each line this session
    elapsed_min   : how many minutes detection has been running
    congestion    : Google Maps congestion ratio (1.0 = normal)
    now           : current datetime

    Returns
    -------
    {direction: {15: n, 30: n, 60: n}}
    """
    hour        = now.hour
    day_of_week = now.weekday()

    # Congestion modifier: 1.0x → 1.0, 1.5x → 1.10, 2.0x → 1.20
    cong_mod = 1.0 + (congestion - 1.0) * 0.20
    cong_mod = max(0.8, min(1.5, cong_mod))   # clamp to sensible range

    # How much to trust the live rate vs typical baseline.
    # Reaches full trust (1.0) after 15 minutes of detection data.
    live_weight = min(1.0, elapsed_min / 15.0) if elapsed_min > 0 else 0.0

    result: dict[str, dict[int, int]] = {}

    for direction in DIRECTIONS:
        typ_rate  = _typical_rate(hour, direction, day_of_week)
        live_rate = (live_counts.get(direction, 0) / elapsed_min
                     if elapsed_min > 0.5 else typ_rate)

        result[direction] = {}
        for horizon in HORIZONS:
            hour_target = hour + (horizon // 60)
            result[direction][horizon] = _forecast_for_horizon(
                live_rate    = live_rate,
                typical_rate = typ_rate,
                live_weight  = live_weight,
                horizon_min  = horizon,
                cong_mod     = cong_mod,
                hour_target  = hour_target,
                direction    = direction,
                day_of_week  = day_of_week,
            )

    return result


def compute_and_save() -> dict | None:
    """
    Read live state + latest Google Maps data, compute forecast,
    write to the `forecasts` DB table, and return the result dict.

    Safe to call from any thread or asyncio task.
    """
    # Import here to avoid circular imports at module load time
    import src.api.state as _state

    now = datetime.now()

    with _state.lock:
        live_counts  = dict(_state.live_counts)
        start_time   = _state.detection_start_time
        running      = _state.detection_running

    elapsed_min = (
        (now - start_time).total_seconds() / 60.0
        if (running and start_time is not None)
        else 0.0
    )

    # Get latest congestion from DB
    congestion = 1.0
    try:
        conn = sqlite3.connect(DB_PATH)
        row = conn.execute("""
            SELECT congestion_ratio FROM traffic_conditions
            ORDER BY timestamp DESC LIMIT 1
        """).fetchone()
        conn.close()
        if row and row[0] is not None:
            congestion = float(row[0])
    except Exception:
        pass

    forecasts = compute_forecast(live_counts, elapsed_min, congestion, now)

    # Persist to DB so existing /forecasts endpoint picks it up
    try:
        conn = sqlite3.connect(DB_PATH)
        created = now.isoformat()
        for direction, horizons in forecasts.items():
            for horizon_min, count in horizons.items():
                conn.execute("""
                    INSERT INTO forecasts
                        (created_at, direction, horizon_minutes, predicted_count)
                    VALUES (?, ?, ?, ?)
                """, (created, direction, horizon_min, count))
        conn.commit()
        conn.close()
    except Exception as exc:
        print(f"[smart_forecast] DB write error: {exc}")

    return {
        "forecasts":    forecasts,
        "elapsed_min":  round(elapsed_min, 1),
        "congestion":   round(congestion, 2),
        "live_weight":  round(min(1.0, elapsed_min / 15.0), 2),
        "source":       "live_video+google_maps" if elapsed_min > 0 else "typical_pattern+google_maps",
        "computed_at":  now.isoformat(),
    }


if __name__ == "__main__":
    # Quick test — run without API/detection
    from datetime import datetime
    test_counts = {"North": 38, "South": 18, "East": 22, "West": 0}
    result = compute_forecast(test_counts, elapsed_min=8.5, congestion=1.10,
                              now=datetime.now())
    for d, horizons in result.items():
        print(f"  {d:<6}: +15m={horizons[15]:>3}  +30m={horizons[30]:>3}  +60m={horizons[60]:>3}")
