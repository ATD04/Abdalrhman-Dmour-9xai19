"""Storage Manager for Traffic Intelligence.

Handles structured logging and relational storage for:
- Processed traffic data
- Event metadata
- Forecasting results
- Performance indicators
- System logs
- Validation outputs
- Monitoring outputs
"""

from __future__ import annotations

import json
import logging
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("its.storage")

class StorageManager:
    def __init__(self, storage_dir: Path):
        self.storage_dir = storage_dir
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        
        self.jsonl_path = self.storage_dir / "system_events.jsonl"
        self.db_path = self.storage_dir / "traffic_intelligence.db"
        
        self._init_db()

    def _init_db(self):
        """Initialize SQLite database with Phase 3 schema."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Events Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT,
                    event_type TEXT,
                    severity TEXT,
                    direction TEXT,
                    message TEXT,
                    confidence FLOAT,
                    location_label TEXT,
                    queue_indicator FLOAT,
                    clip_reference TEXT
                )
            """)
            
            # Forecasts Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS forecasts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT,
                    direction TEXT,
                    horizon_minutes INTEGER,
                    veh_per_hour FLOAT,
                    confidence FLOAT
                )
            """)
            
            # Performance/Health Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS system_health (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT,
                    ingestion_rate_fps FLOAT,
                    dropped_frames INTEGER,
                    uptime_s FLOAT,
                    error_count INTEGER
                )
            """)
            
            conn.commit()

    def log_event(self, event_data: Dict[str, Any]):
        """Log event to JSONL and SQLite."""
        ts = event_data.get("timestamp") or datetime.now(timezone.utc).isoformat()
        
        # JSONL
        with self.jsonl_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps({**event_data, "timestamp": ts}) + "\n")
            
        # SQLite
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO events (timestamp, event_type, severity, direction, message, confidence, location_label, queue_indicator, clip_reference)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    ts,
                    event_data.get("type"),
                    event_data.get("severity"),
                    event_data.get("direction"),
                    event_data.get("message"),
                    event_data.get("confidence", 0.0),
                    event_data.get("location_label"),
                    event_data.get("queue_indicator"),
                    event_data.get("clip_reference")
                ))
                conn.commit()
        except Exception as exc:
            logger.error("Failed to insert event into DB: %s", exc)

    def log_forecast(self, forecast_data: Dict[str, Any]):
        """Log forecasting results."""
        ts = forecast_data.get("timestamp") or datetime.now(timezone.utc).isoformat()
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                for direction, points in forecast_data.get("directions", {}).items():
                    for p in points:
                        cursor.execute("""
                            INSERT INTO forecasts (timestamp, direction, horizon_minutes, veh_per_hour, confidence)
                            VALUES (?, ?, ?, ?, ?)
                        """, (ts, direction, p["horizon_minutes"], p["veh_per_hour"], p["confidence"]))
                conn.commit()
        except Exception as exc:
            logger.error("Failed to insert forecast into DB: %s", exc)

    def log_health(self, health_data: Dict[str, Any]):
        """Log system health metrics."""
        ts = datetime.now(timezone.utc).isoformat()
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO system_health (timestamp, ingestion_rate_fps, dropped_frames, uptime_s, error_count)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    ts,
                    health_data.get("ingestion_rate_fps", 0.0),
                    health_data.get("dropped_frames", 0),
                    health_data.get("uptime_s", 0.0),
                    health_data.get("error_count", 0)
                ))
                conn.commit()
        except Exception as exc:
            logger.error("Failed to insert health data into DB: %s", exc)

# Pre-defined storage location
STORAGE_DIR = Path(__file__).resolve().parents[1] / "logs" / "phase3"
storage = StorageManager(STORAGE_DIR)
