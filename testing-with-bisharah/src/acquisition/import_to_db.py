"""
Signal Log Generator + CSV Importer
-------------------------------------
1. Reads your existing line_counts.csv (real car counts from video)
2. Aggregates counts into 15-min windows per direction
3. Generates synthetic signal timing that matches the video duration
4. Saves everything to SQLite
"""

import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

DB_PATH      = "Data/traffic.db"
COUNTS_CSV   = "Data/output/line_counts.csv"
VIDEO_START  = datetime(2026, 5, 3, 8, 0, 0)   # assume video starts at 8:00am
DIRECTIONS   = ["North", "South", "East", "West"]

# Signal cycle config per direction (seconds)
SIGNAL_CYCLES = {
    "North": {"green": 35, "yellow": 5, "red": 30},
    "South": {"green": 35, "yellow": 5, "red": 30},
    "East":  {"green": 40, "yellow": 5, "red": 25},
    "West":  {"green": 40, "yellow": 5, "red": 25},
}

def import_counts(conn, df):
    """Aggregate per-vehicle detections into 15-min window counts and save to DB."""
    c = conn.cursor()

    # Convert frame number to approximate timestamp
    # Video is ~109 seconds, 3273 frames → 30fps
    fps = 30.0
    df["video_sec"] = df["frame"] / fps
    df["timestamp"] = df["video_sec"].apply(
        lambda s: (VIDEO_START + timedelta(seconds=s)).isoformat()
    )
    df["dt"] = pd.to_datetime(df["timestamp"], format="ISO8601")

    # Round down to 15-min window
    df["window"] = df["dt"].dt.floor("15min")

    # Count unique vehicle IDs per direction per window
    agg = (
        df.groupby(["window", "direction"])["vehicle_id"]
        .nunique()
        .reset_index()
        .rename(columns={"vehicle_id": "vehicle_count"})
    )

    rows = 0
    for _, row in agg.iterrows():
        ts  = row["window"].isoformat()
        dt  = row["window"]
        c.execute("""
            INSERT INTO detector_readings
                (timestamp, direction, vehicle_count, hour, day_of_week, is_weekend)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            ts,
            row["direction"],
            int(row["vehicle_count"]),
            dt.hour,
            dt.weekday(),
            1 if dt.weekday() >= 5 else 0,
        ))
        rows += 1

    conn.commit()
    print(f"✓ Imported {rows} aggregated count rows into detector_readings")
    return agg

def generate_signals(conn, duration_sec=109):
    """Generate synthetic signal events for the video duration."""
    c = conn.cursor()
    rows = 0

    for direction, cycle in SIGNAL_CYCLES.items():
        t = VIDEO_START
        end_time = VIDEO_START + timedelta(seconds=duration_sec * 10)  # extend for forecasting

        while t < end_time:
            for state, key in [("GREEN", "green"), ("YELLOW", "yellow"), ("RED", "red")]:
                dur = cycle[key]
                c.execute("""
                    INSERT INTO signal_logs
                        (timestamp, intersection_id, direction, state, duration_sec)
                    VALUES (?, ?, ?, ?, ?)
                """, (t.isoformat(), "WADI_SAQRA", direction, state, dur))
                t += timedelta(seconds=dur)
                rows += 1

    conn.commit()
    print(f"✓ Generated {rows} signal log rows into signal_logs")

def main():
    if not os.path.exists(COUNTS_CSV):
        print(f"ERROR: {COUNTS_CSV} not found.")
        print("Run step3_line_count.py first to generate it.")
        return

    conn = sqlite3.connect(DB_PATH)

    # Load CSV
    df = pd.read_csv(COUNTS_CSV)
    print(f"Loaded {len(df)} detection rows from {COUNTS_CSV}")
    print(f"Columns: {list(df.columns)}")

    # Import counts
    import_counts(conn, df)

    # Generate signal logs
    generate_signals(conn)

    # Summary
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM detector_readings")
    print(f"\nDB summary:")
    print(f"  detector_readings: {c.fetchone()[0]} rows")
    c.execute("SELECT COUNT(*) FROM signal_logs")
    print(f"  signal_logs:       {c.fetchone()[0]} rows")

    conn.close()
    print(f"\n✓ All data saved to {DB_PATH}")

if __name__ == "__main__":
    main()
