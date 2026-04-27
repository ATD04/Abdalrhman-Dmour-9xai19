#!/usr/bin/env python3
"""Phase 3: System Health Monitoring and Metrics.

Tracks system status, data source health, ingestion metrics, and provides health API responses.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from phase3_database import Phase3Database

logger = logging.getLogger("its.system_health")

UTC = timezone.utc


class SystemHealthMonitor:
    """Monitors and reports system health metrics."""

    def __init__(self, db: Phase3Database | None = None) -> None:
        self.db = db or Phase3Database()
        self.startup_time = datetime.now(UTC)
        self.last_google_update: datetime | None = None
        self.last_detector_update: datetime | None = None
        self.last_video_update: datetime | None = None
        self.google_api_failures = 0
        self.detector_load_failures = 0
        self.video_process_failures = 0
        self.records_ingested = 0
        self.records_dropped = 0
        self.events_created = 0
        self.forecasts_generated = 0

    def update_google_success(self) -> None:
        """Mark successful Google API call."""
        self.last_google_update = datetime.now(UTC)
        self.google_api_failures = 0

    def update_google_failure(self) -> None:
        """Mark failed Google API call."""
        self.google_api_failures += 1

    def update_detector_success(self) -> None:
        """Mark successful detector data load."""
        self.last_detector_update = datetime.now(UTC)
        self.detector_load_failures = 0

    def update_detector_failure(self) -> None:
        """Mark failed detector data load."""
        self.detector_load_failures += 1

    def update_video_success(self) -> None:
        """Mark successful video processing."""
        self.last_video_update = datetime.now(UTC)
        self.video_process_failures = 0

    def update_video_failure(self) -> None:
        """Mark failed video processing."""
        self.video_process_failures += 1

    def record_ingestion(self, count: int = 1, dropped: int = 0) -> None:
        """Record ingested records."""
        self.records_ingested += count
        self.records_dropped += dropped

    def record_event_created(self) -> None:
        """Record event creation."""
        self.events_created += 1

    def record_forecast_generated(self) -> None:
        """Record forecast generation."""
        self.forecasts_generated += 1

    def get_uptime_seconds(self) -> float:
        """Get system uptime in seconds."""
        return (datetime.now(UTC) - self.startup_time).total_seconds()

    def get_uptime_formatted(self) -> str:
        """Get formatted uptime string."""
        seconds = self.get_uptime_seconds()
        days = int(seconds // 86400)
        hours = int((seconds % 86400) // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)

        if days > 0:
            return f"{days}d {hours}h {minutes}m {secs}s"
        elif hours > 0:
            return f"{hours}h {minutes}m {secs}s"
        elif minutes > 0:
            return f"{minutes}m {secs}s"
        else:
            return f"{secs}s"

    def get_google_status(self) -> dict[str, Any]:
        """Get Google API status."""
        if self.last_google_update is None:
            return {
                "status": "never_attempted",
                "last_update": None,
                "failures": 0,
                "note": "Google API has not been called yet",
            }

        now = datetime.now(UTC)
        time_since_update = (now - self.last_google_update).total_seconds()

        if self.google_api_failures > 0:
            status = "degraded" if time_since_update < 300 else "down"
        else:
            status = "ok"

        return {
            "status": status,
            "last_update": self.last_google_update.isoformat(),
            "seconds_since_update": round(time_since_update, 1),
            "consecutive_failures": self.google_api_failures,
            "note": f"Last successful update {round(time_since_update, 1)}s ago" if status == "ok"
                   else f"{self.google_api_failures} consecutive failures",
        }

    def get_detector_status(self) -> dict[str, Any]:
        """Get detector data source status."""
        if self.last_detector_update is None:
            return {
                "status": "never_attempted",
                "last_update": None,
                "failures": 0,
                "note": "Detector data has not been loaded yet",
            }

        now = datetime.now(UTC)
        time_since_update = (now - self.last_detector_update).total_seconds()

        if self.detector_load_failures > 0:
            status = "degraded" if time_since_update < 600 else "down"
        else:
            status = "ok"

        return {
            "status": status,
            "last_update": self.last_detector_update.isoformat(),
            "seconds_since_update": round(time_since_update, 1),
            "consecutive_failures": self.detector_load_failures,
        }

    def get_video_status(self) -> dict[str, Any]:
        """Get video processing status."""
        if self.last_video_update is None:
            return {
                "status": "not_enabled",
                "last_update": None,
                "failures": 0,
                "note": "Live video processing is disabled",
            }

        now = datetime.now(UTC)
        time_since_update = (now - self.last_video_update).total_seconds()

        if self.video_process_failures > 0:
            status = "degraded" if time_since_update < 300 else "down"
        else:
            status = "ok"

        return {
            "status": status,
            "last_update": self.last_video_update.isoformat(),
            "seconds_since_update": round(time_since_update, 1),
            "consecutive_failures": self.video_process_failures,
        }

    def get_database_status(self) -> dict[str, Any]:
        """Get database status."""
        try:
            size_mb = self.db.get_database_size_mb()
            return {
                "status": "ok",
                "file_size_mb": round(size_mb, 2),
                "note": "SQLite database is operational",
            }
        except Exception as exc:  # noqa: BLE001
            return {
                "status": "error",
                "error": str(exc),
            }

    def get_full_health_report(self) -> dict[str, Any]:
        """Get complete system health report."""
        return {
            "timestamp": datetime.now(UTC).isoformat(),
            "uptime_seconds": round(self.get_uptime_seconds(), 1),
            "uptime_formatted": self.get_uptime_formatted(),
            "google_api": self.get_google_status(),
            "detector_data": self.get_detector_status(),
            "video_processing": self.get_video_status(),
            "database": self.get_database_status(),
            "ingestion_metrics": {
                "records_ingested": self.records_ingested,
                "records_dropped": self.records_dropped,
                "drop_rate_percent": round(
                    100.0 * self.records_dropped / (self.records_ingested + self.records_dropped)
                    if (self.records_ingested + self.records_dropped) > 0 else 0.0,
                    2
                ),
            },
            "operational_metrics": {
                "events_detected": self.events_created,
                "forecasts_generated": self.forecasts_generated,
            },
            "overall_status": self._compute_overall_status(),
        }

    def _compute_overall_status(self) -> str:
        """Compute overall system status."""
        google = self.get_google_status()["status"]
        detector = self.get_detector_status()["status"]
        db = self.get_database_status()["status"]

        if db != "ok":
            return "critical"
        if google in ("down", "degraded") and detector in ("down", "degraded"):
            return "degraded"
        if google == "down" and detector == "down":
            return "critical"
        return "ok"

    def get_compact_health(self) -> dict[str, Any]:
        """Get compact health status for dashboard header."""
        google = self.get_google_status()["status"]
        detector = self.get_detector_status()["status"]
        db = self.get_database_status()["status"]

        sources_ok = sum([
            google == "ok",
            detector == "ok",
        ])

        return {
            "overall": self._compute_overall_status(),
            "sources_ok": sources_ok,
            "sources_total": 2,
            "google": google,
            "detector": detector,
            "database": db,
            "uptime": self.get_uptime_formatted(),
        }


if __name__ == "__main__":
    import json

    logging.basicConfig(level=logging.INFO)

    monitor = SystemHealthMonitor()

    # Simulate some activity
    monitor.update_google_success()
    monitor.update_detector_success()
    monitor.record_ingestion(100, 5)
    monitor.record_event_created()
    monitor.record_forecast_generated()

    health = monitor.get_full_health_report()
    print(json.dumps(health, indent=2))
    print("\n✓ System health report generated")
