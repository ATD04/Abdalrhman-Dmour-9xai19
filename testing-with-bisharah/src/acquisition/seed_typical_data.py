"""
Typical Traffic Data Seeder — Wadi Saqra Intersection, Amman
-------------------------------------------------------------
Generates realistic vehicle count baselines for Sunday and Monday
(Jordan's first two workdays) so the smart forecaster has historical
patterns to fall back on when the detection session is short.

Traffic profile is based on:
  - Busy urban Amman intersection (Arar St × Prince Shaker St)
  - Nearby generators: Istishari Hospital (SW), King Abdullah Park (N),
    McDonald's / Amman TV (SE), Wahbeh Tamari Kindergarten (E)
  - Jordan workday rush hours: 7:30–9:30 AM, 12:00–1:30 PM (hospital+lunch),
    5:00–7:30 PM (heaviest)
  - North/South (Arar St) carries ~60 % more traffic than East/West

Run ONCE to populate the DB:
  python3 src/acquisition/seed_typical_data.py
"""

import sqlite3
import os
import random
from datetime import datetime, timedelta

DB_PATH    = "Data/traffic.db"
DIRECTIONS = ["North", "South", "East", "West"]

# ── Typical vehicles per 15-minute window, by hour ───────────────────────────
# Values are median counts — actual rows are ±noise so the data looks real.
# North/South = Arar Street main flow (heavier).
# East/West   = Prince Shaker / Kindi cross-flow (lighter).
TYPICAL_15MIN: dict[int, dict[str, int]] = {
    0:  {"North": 2,  "South": 2,  "East": 1,  "West": 1},
    1:  {"North": 1,  "South": 1,  "East": 1,  "West": 1},
    2:  {"North": 1,  "South": 1,  "East": 0,  "West": 0},
    3:  {"North": 1,  "South": 1,  "East": 0,  "West": 0},
    4:  {"North": 1,  "South": 1,  "East": 1,  "West": 1},
    5:  {"North": 3,  "South": 2,  "East": 1,  "West": 1},
    6:  {"North": 6,  "South": 5,  "East": 3,  "West": 2},
    7:  {"North": 14, "South": 11, "East": 7,  "West": 6},   # morning build-up
    8:  {"North": 24, "South": 19, "East": 12, "West": 10},  # peak morning rush
    9:  {"North": 19, "South": 16, "East": 9,  "West": 8},   # post-rush
    10: {"North": 13, "South": 11, "East": 7,  "West": 6},
    11: {"North": 15, "South": 13, "East": 8,  "West": 7},
    12: {"North": 18, "South": 16, "East": 10, "West": 9},   # midday lunch
    13: {"North": 20, "South": 17, "East": 11, "West": 10},  # hospital visits peak
    14: {"North": 15, "South": 13, "East": 8,  "West": 7},
    15: {"North": 17, "South": 15, "East": 9,  "West": 8},
    16: {"North": 22, "South": 19, "East": 12, "West": 10},  # afternoon build-up
    17: {"North": 30, "South": 26, "East": 15, "West": 13},  # evening rush peak
    18: {"North": 34, "South": 29, "East": 17, "West": 15},  # heaviest hour
    19: {"North": 25, "South": 22, "East": 13, "West": 11},
    20: {"North": 17, "South": 15, "East": 9,  "West": 8},
    21: {"North": 11, "South": 10, "East": 6,  "West": 5},
    22: {"North": 7,  "South": 6,  "East": 4,  "West": 3},
    23: {"North": 4,  "South": 3,  "East": 2,  "West": 2},
}

# Sunday pattern differs slightly: heavier morning (first workday of week in Jordan),
# lighter late evening.  Expressed as a multiplier vs the weekday baseline above.
SUNDAY_MULTIPLIER = {
    "North": 1.15, "South": 1.10, "East": 1.10, "West": 1.05,
}


def _add_noise(value: int, noise_pct: float = 0.20) -> int:
    """Add ±noise_pct random variation and keep value ≥ 0."""
    delta = int(value * noise_pct * (2 * random.random() - 1))
    return max(0, value + delta)


def seed(weeks_back: int = 3):
    """
    Seed the DB with typical data for the past `weeks_back` Sundays and Mondays.
    Skips dates already present in the DB to avoid duplicates.
    """
    if not os.path.exists(DB_PATH):
        print(f"ERROR: DB not found at {DB_PATH}. Run setup_db.py first.")
        return

    conn = sqlite3.connect(DB_PATH)

    # Find which timestamps already exist so we don't double-insert
    existing = set(
        row[0][:16]   # "YYYY-MM-DDTHH:MM"
        for row in conn.execute("SELECT timestamp FROM detector_readings").fetchall()
    )

    today     = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    rows_added = 0

    for week in range(1, weeks_back + 1):
        # Build the Sunday and Monday of that week
        # Python weekday: Monday=0, Sunday=6
        days_to_sunday = (today.weekday() + 1) % 7 + 7 * (week - 1)
        sunday = today - timedelta(days=days_to_sunday)
        monday = sunday + timedelta(days=1)

        for day_dt in (sunday, monday):
            is_sunday  = (day_dt.weekday() == 6)
            day_of_week = day_dt.weekday()  # 0=Mon … 6=Sun
            is_weekend  = 0  # both Sun+Mon are workdays in Jordan

            # Walk every 15-minute slot of the day
            for hour in range(24):
                for quarter in range(4):
                    slot_dt = day_dt.replace(hour=hour) + timedelta(minutes=quarter * 15)
                    slot_key = slot_dt.isoformat()[:16]

                    if slot_key in existing:
                        continue  # already have this slot

                    for direction in DIRECTIONS:
                        base = TYPICAL_15MIN[hour][direction]
                        if is_sunday:
                            base = round(base * SUNDAY_MULTIPLIER[direction])
                        count = _add_noise(base)

                        conn.execute("""
                            INSERT INTO detector_readings
                                (timestamp, direction, vehicle_count, hour, day_of_week, is_weekend)
                            VALUES (?, ?, ?, ?, ?, ?)
                        """, (
                            slot_dt.isoformat(),
                            direction,
                            count,
                            hour,
                            day_of_week,
                            is_weekend,
                        ))
                        rows_added += 1

    conn.commit()
    conn.close()

    if rows_added:
        print(f"✓ Seeded {rows_added} rows of typical traffic data ({weeks_back} weeks of Sun+Mon).")
        print(f"  DB: {DB_PATH}")
    else:
        print("  DB already has data for these dates — nothing added.")


if __name__ == "__main__":
    random.seed(42)     # reproducible noise
    seed(weeks_back=3)
