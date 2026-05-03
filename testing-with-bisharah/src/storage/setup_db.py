"""
Database Setup — SQLite
-----------------------
Creates all tables needed for the traffic intelligence system.
Run once before anything else.
"""

import sqlite3
import os

DB_PATH = "Data/traffic.db"

def setup():
    os.makedirs("Data", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Vehicle counts per direction per 15-min window
    c.execute("""
        CREATE TABLE IF NOT EXISTS detector_readings (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp   TEXT NOT NULL,
            direction   TEXT NOT NULL,   -- North / South / East / West
            vehicle_count INTEGER NOT NULL,
            hour        INTEGER,
            day_of_week INTEGER,         -- 0=Mon ... 6=Sun
            is_weekend  INTEGER          -- 0 or 1
        )
    """)

    # Signal timing logs (synthetic)
    c.execute("""
        CREATE TABLE IF NOT EXISTS signal_logs (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp       TEXT NOT NULL,
            intersection_id TEXT NOT NULL,
            direction       TEXT NOT NULL,
            state           TEXT NOT NULL,  -- GREEN / YELLOW / RED
            duration_sec    INTEGER
        )
    """)

    # Google Maps congestion data
    c.execute("""
        CREATE TABLE IF NOT EXISTS traffic_conditions (
            id                    INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp             TEXT NOT NULL,
            congestion_ratio      REAL,       -- travel_with_traffic / travel_without
            travel_time_normal    INTEGER,    -- seconds
            travel_time_traffic   INTEGER     -- seconds
        )
    """)

    # Forecasting results
    c.execute("""
        CREATE TABLE IF NOT EXISTS forecasts (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at      TEXT NOT NULL,
            direction       TEXT NOT NULL,
            horizon_minutes INTEGER NOT NULL,  -- 15, 30, or 60
            predicted_count INTEGER NOT NULL
        )
    """)

    # Incident/event log
    c.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp   TEXT NOT NULL,
            event_type  TEXT NOT NULL,   -- STALLED_VEHICLE, CONGESTION, etc.
            direction   TEXT,
            confidence  REAL
        )
    """)

    conn.commit()
    conn.close()
    print(f"✓ Database created at {DB_PATH}")
    print("  Tables: detector_readings, signal_logs, traffic_conditions, forecasts, events")

if __name__ == "__main__":
    setup()
