#!/usr/bin/env python3
"""Phase 3: Lightweight SQLite database layer for events, observations, forecasts, and recommendations.

This module provides persistent storage for all Phase 3 data without introducing heavy ORM complexity.
It's designed to be lightweight, reproducible, and easy to inspect.
"""

from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger("its.phase3_db")

UTC = timezone.utc


class Phase3Database:
    """SQLite database for Phase 3 event logging, observations, forecasts, and recommendations."""

    def __init__(self, db_path: Path | str = "app/data/phase3.db") -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.connection: sqlite3.Connection | None = None
        self.initialize()

    def initialize(self) -> None:
        """Create tables if they don't exist."""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Traffic observations (15-min aggregated)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS traffic_observations (
                    observation_id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    approach TEXT NOT NULL,
                    lane_id TEXT,
                    source TEXT NOT NULL,
                    speed_kmh REAL,
                    volume_vehicles INTEGER,
                    queue_length_m REAL,
                    demand_estimate REAL,
                    created_at TEXT NOT NULL
                )
            """)

            # Signal logs (phase transitions)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS signal_logs (
                    signal_log_id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    intersection_id TEXT NOT NULL,
                    phase TEXT,
                    state TEXT,
                    green_time_s REAL,
                    yellow_time_s REAL,
                    all_red_time_s REAL,
                    cycle_length_s REAL,
                    created_at TEXT NOT NULL
                )
            """)

            # Detected events (real-time incidents)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS detected_events (
                    event_id TEXT PRIMARY KEY,
                    start_time TEXT NOT NULL,
                    end_time TEXT,
                    event_type TEXT NOT NULL,
                    severity TEXT,
                    approach TEXT,
                    lane_id TEXT,
                    confidence REAL,
                    description TEXT,
                    recommendation TEXT,
                    snapshot_path TEXT,
                    clip_path TEXT,
                    status TEXT DEFAULT 'active',
                    related_track_ids TEXT,
                    queue_length_m REAL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)

            # Forecasts (ML predictions)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS forecasts (
                    forecast_id TEXT PRIMARY KEY,
                    generated_at TEXT NOT NULL,
                    horizon_minutes INTEGER NOT NULL,
                    approach TEXT NOT NULL,
                    predicted_volume INTEGER,
                    confidence REAL,
                    trend TEXT,
                    model_name TEXT,
                    baseline_error REAL,
                    created_at TEXT NOT NULL
                )
            """)

            # Signal recommendations (Webster-style)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS signal_recommendations (
                    recommendation_id TEXT PRIMARY KEY,
                    generated_at TEXT NOT NULL,
                    current_plan_json TEXT NOT NULL,
                    recommended_plan_json TEXT NOT NULL,
                    estimated_delay_before_s REAL,
                    estimated_delay_after_s REAL,
                    delay_reduction_percent REAL,
                    reason TEXT,
                    decision_support_only INTEGER DEFAULT 1,
                    created_at TEXT NOT NULL
                )
            """)

            # System logs (health, errors, warnings)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS system_logs (
                    log_id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    component TEXT,
                    status TEXT,
                    message TEXT,
                    severity TEXT,
                    created_at TEXT NOT NULL
                )
            """)

            # Create indices for common queries
            cursor.execute("""CREATE INDEX IF NOT EXISTS idx_events_start_time ON detected_events(start_time)""")
            cursor.execute("""CREATE INDEX IF NOT EXISTS idx_events_approach ON detected_events(approach)""")
            cursor.execute("""CREATE INDEX IF NOT EXISTS idx_events_status ON detected_events(status)""")
            cursor.execute("""CREATE INDEX IF NOT EXISTS idx_observations_timestamp ON traffic_observations(timestamp)""")
            cursor.execute("""CREATE INDEX IF NOT EXISTS idx_forecasts_generated ON forecasts(generated_at)""")
            cursor.execute("""CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp)""")

            conn.commit()
            logger.info("Phase 3 database initialized at %s", self.db_path)

    def get_connection(self) -> sqlite3.Connection:
        """Get or create database connection."""
        if self.connection is None:
            self.connection = sqlite3.connect(str(self.db_path), timeout=30.0)
            self.connection.row_factory = sqlite3.Row
        return self.connection

    def close(self) -> None:
        """Close database connection."""
        if self.connection is not None:
            self.connection.close()
            self.connection = None

    # ── Traffic Observations ──

    def insert_observation(
        self,
        observation_id: str,
        timestamp: str,
        approach: str,
        source: str,
        speed_kmh: float | None = None,
        volume_vehicles: int | None = None,
        queue_length_m: float | None = None,
        demand_estimate: float | None = None,
        lane_id: str | None = None,
    ) -> None:
        """Insert a traffic observation."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO traffic_observations
                (observation_id, timestamp, approach, lane_id, source, speed_kmh, volume_vehicles,
                 queue_length_m, demand_estimate, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                observation_id, timestamp, approach, lane_id, source, speed_kmh,
                volume_vehicles, queue_length_m, demand_estimate, datetime.now(UTC).isoformat()
            ))
            conn.commit()

    # ── Signal Logs ──

    def insert_signal_log(
        self,
        signal_log_id: str,
        timestamp: str,
        intersection_id: str,
        phase: str | None = None,
        state: str | None = None,
        green_time_s: float | None = None,
        yellow_time_s: float | None = None,
        all_red_time_s: float | None = None,
        cycle_length_s: float | None = None,
    ) -> None:
        """Insert a signal phase log."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO signal_logs
                (signal_log_id, timestamp, intersection_id, phase, state, green_time_s,
                 yellow_time_s, all_red_time_s, cycle_length_s, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                signal_log_id, timestamp, intersection_id, phase, state, green_time_s,
                yellow_time_s, all_red_time_s, cycle_length_s, datetime.now(UTC).isoformat()
            ))
            conn.commit()

    # ── Detected Events ──

    def insert_event(
        self,
        event_id: str,
        start_time: str,
        event_type: str,
        approach: str | None = None,
        severity: str = "medium",
        confidence: float = 0.5,
        description: str = "",
        recommendation: str = "",
        end_time: str | None = None,
        lane_id: str | None = None,
        snapshot_path: str | None = None,
        clip_path: str | None = None,
        related_track_ids: list[str] | None = None,
        queue_length_m: float | None = None,
        status: str = "active",
    ) -> None:
        """Insert a detected event. If event_id exists, update it."""
        track_ids_json = json.dumps(related_track_ids) if related_track_ids else None
        now = datetime.now(UTC).isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO detected_events
                (event_id, start_time, end_time, event_type, severity, approach, lane_id,
                 confidence, description, recommendation, snapshot_path, clip_path,
                 status, related_track_ids, queue_length_m, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                event_id, start_time, end_time, event_type, severity, approach, lane_id,
                confidence, description, recommendation, snapshot_path, clip_path,
                status, track_ids_json, queue_length_m, now, now
            ))
            conn.commit()

    def get_active_events(self, limit: int = 100) -> list[dict[str, Any]]:
        """Get recent active events."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM detected_events
                WHERE status IN ('active', 'acknowledged')
                ORDER BY start_time DESC
                LIMIT ?
            """, (limit,))
            rows = cursor.fetchall()
        return [dict(row) for row in rows]

    def acknowledge_event(self, event_id: str) -> None:
        """Mark an event as acknowledged."""
        now = datetime.now(UTC).isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE detected_events
                SET status = 'acknowledged', updated_at = ?
                WHERE event_id = ?
            """, (now, event_id))
            conn.commit()

    def clear_event(self, event_id: str, end_time: str | None = None) -> None:
        """Mark an event as cleared."""
        now = datetime.now(UTC).isoformat()
        end_time = end_time or now
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE detected_events
                SET status = 'cleared', end_time = ?, updated_at = ?
                WHERE event_id = ?
            """, (end_time, now, event_id))
            conn.commit()

    # ── Forecasts ──

    def insert_forecast(
        self,
        forecast_id: str,
        generated_at: str,
        horizon_minutes: int,
        approach: str,
        predicted_volume: int | None = None,
        confidence: float | None = None,
        trend: str | None = None,
        model_name: str = "default",
        baseline_error: float | None = None,
    ) -> None:
        """Insert a traffic forecast."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO forecasts
                (forecast_id, generated_at, horizon_minutes, approach, predicted_volume,
                 confidence, trend, model_name, baseline_error, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                forecast_id, generated_at, horizon_minutes, approach, predicted_volume,
                confidence, trend, model_name, baseline_error, datetime.now(UTC).isoformat()
            ))
            conn.commit()

    def get_latest_forecasts(self, approach: str | None = None, limit: int = 12) -> list[dict[str, Any]]:
        """Get latest forecasts by approach."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if approach:
                cursor.execute("""
                    SELECT * FROM forecasts
                    WHERE approach = ?
                    ORDER BY generated_at DESC
                    LIMIT ?
                """, (approach, limit))
            else:
                cursor.execute("""
                    SELECT * FROM forecasts
                    ORDER BY generated_at DESC
                    LIMIT ?
                """, (limit,))
            rows = cursor.fetchall()
        return [dict(row) for row in rows]

    # ── Signal Recommendations ──

    def insert_recommendation(
        self,
        recommendation_id: str,
        generated_at: str,
        current_plan: dict[str, Any],
        recommended_plan: dict[str, Any],
        estimated_delay_before_s: float | None = None,
        estimated_delay_after_s: float | None = None,
        delay_reduction_percent: float | None = None,
        reason: str = "",
    ) -> None:
        """Insert a signal recommendation."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO signal_recommendations
                (recommendation_id, generated_at, current_plan_json, recommended_plan_json,
                 estimated_delay_before_s, estimated_delay_after_s, delay_reduction_percent,
                 reason, decision_support_only, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                recommendation_id, generated_at, json.dumps(current_plan), json.dumps(recommended_plan),
                estimated_delay_before_s, estimated_delay_after_s, delay_reduction_percent,
                reason, 1, datetime.now(UTC).isoformat()
            ))
            conn.commit()

    def get_latest_recommendation(self) -> dict[str, Any] | None:
        """Get the most recent recommendation."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM signal_recommendations
                ORDER BY generated_at DESC
                LIMIT 1
            """)
            row = cursor.fetchone()
        return dict(row) if row else None

    # ── System Logs ──

    def log_system(
        self,
        log_id: str,
        component: str,
        status: str,
        message: str = "",
        severity: str = "info",
    ) -> None:
        """Log a system event."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO system_logs
                (log_id, timestamp, component, status, message, severity, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                log_id, datetime.now(UTC).isoformat(), component, status,
                message, severity, datetime.now(UTC).isoformat()
            ))
            conn.commit()

    def get_system_logs(self, limit: int = 100) -> list[dict[str, Any]]:
        """Get recent system logs."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM system_logs
                ORDER BY timestamp DESC
                LIMIT ?
            """, (limit,))
            rows = cursor.fetchall()
        return [dict(row) for row in rows]

    # ── Statistics ──

    def get_event_stats(self, hours: int = 24) -> dict[str, Any]:
        """Get event statistics for the last N hours."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"""
                SELECT
                    event_type,
                    COUNT(*) as count,
                    AVG(confidence) as avg_confidence,
                    COUNT(CASE WHEN status = 'cleared' THEN 1 END) as cleared
                FROM detected_events
                WHERE start_time > datetime('now', '-{hours} hours')
                GROUP BY event_type
            """)
            rows = cursor.fetchall()
        return {row["event_type"]: {
            "count": row["count"],
            "avg_confidence": row["avg_confidence"],
            "cleared": row["cleared"],
        } for row in rows}

    def get_database_size_mb(self) -> float:
        """Get database file size in MB."""
        return self.db_path.stat().st_size / (1024 * 1024)


# Singleton instance for convenient access
_db_instance: Phase3Database | None = None


def get_db(db_path: Path | str = "app/data/phase3.db") -> Phase3Database:
    """Get or create the global database instance."""
    global _db_instance
    if _db_instance is None:
        _db_instance = Phase3Database(db_path)
    return _db_instance


if __name__ == "__main__":
    # Quick test
    logging.basicConfig(level=logging.INFO)
    db = Phase3Database("test_phase3.db")
    print("✓ Database initialized")
    
    # Test insert
    db.insert_observation(
        observation_id="obs_001",
        timestamp="2024-01-01T10:00:00Z",
        approach="northbound",
        source="google",
        speed_kmh=45.0,
        volume_vehicles=120,
        queue_length_m=50.0,
    )
    print("✓ Observation inserted")
    
    db.insert_event(
        event_id="evt_001",
        start_time="2024-01-01T10:05:00Z",
        event_type="queue_spillback",
        approach="northbound",
        severity="high",
        confidence=0.85,
        description="Queue spillback detected on north approach",
        recommendation="Extend green time for northbound phase",
    )
    print("✓ Event inserted")
    
    events = db.get_active_events()
    print(f"✓ Active events: {len(events)}")
    
    db.close()
    print("✓ Database test passed")
