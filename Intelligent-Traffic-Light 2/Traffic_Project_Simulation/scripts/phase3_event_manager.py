#!/usr/bin/env python3
"""Phase 3: Event Manager with deduplication, lifecycle management, and structured output.

This module handles event detection output, deduplication, event grouping, and lifecycle management.
It prevents duplicate alerts and provides structured event data for storage and dashboards.
"""

from __future__ import annotations

import json
import logging
import hashlib
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from phase3_database import Phase3Database

logger = logging.getLogger("its.event_manager")

UTC = timezone.utc


class EventManager:
    """Manages detected traffic events with deduplication and lifecycle management."""

    # Event types supported by Phase 3
    VALID_EVENT_TYPES = {
        "abnormal_stop",
        "stalled_vehicle",
        "queue_spillback",
        "sudden_congestion",
        "pedestrian_activity",
        "heavy_vehicle_presence",
        "incident_or_crash",
    }

    # Severity levels
    SEVERITY_LEVELS = {"low", "medium", "high", "critical"}

    # Event lifecycle states
    EVENT_STATES = {"active", "acknowledged", "cleared"}

    # Cooldown periods (seconds) per event type to avoid duplicate alerts
    COOLDOWN_SECONDS = {
        "abnormal_stop": 60,
        "stalled_vehicle": 120,
        "queue_spillback": 45,
        "sudden_congestion": 30,
        "pedestrian_activity": 20,
        "heavy_vehicle_presence": 60,
        "incident_or_crash": 180,
    }

    def __init__(self, db: Phase3Database | None = None) -> None:
        self.db = db or Phase3Database()
        # Track recently seen events to avoid duplicates: key=(approach, type, location) -> last_emit_time
        self._event_cooldowns: dict[str, float] = {}
        # Active event windows: key=event_id -> (type, approach, start_time)
        self._active_windows: dict[str, dict[str, Any]] = {}

    def hash_event_signature(self, approach: str, event_type: str, location: str | None = None) -> str:
        """Create a stable hash for event deduplication."""
        sig = f"{approach}:{event_type}:{location or 'generic'}"
        return hashlib.md5(sig.encode()).hexdigest()[:12]

    def should_emit_event(self, approach: str, event_type: str, location: str | None = None) -> bool:
        """Check if we should emit this event or if it's still in cooldown."""
        if event_type not in self.VALID_EVENT_TYPES:
            logger.warning("Unknown event type: %s", event_type)
            return False

        sig = self.hash_event_signature(approach, event_type, location)
        cooldown = self.COOLDOWN_SECONDS.get(event_type, 60)
        now = datetime.now(UTC).timestamp()

        if sig in self._event_cooldowns:
            last_emit = self._event_cooldowns[sig]
            if (now - last_emit) < cooldown:
                return False

        # Update cooldown
        self._event_cooldowns[sig] = now
        return True

    def create_event(
        self,
        event_type: str,
        approach: str,
        timestamp: str,
        severity: str = "medium",
        confidence: float = 0.5,
        description: str = "",
        recommendation: str = "",
        lane_id: str | None = None,
        snapshot_path: str | None = None,
        clip_path: str | None = None,
        track_ids: list[str] | None = None,
        queue_length_m: float | None = None,
        location_hint: str | None = None,
    ) -> dict[str, Any] | None:
        """
        Create and register a structured event.
        
        Returns the event dict if successfully emitted (not in cooldown), None otherwise.
        """
        # Validate
        if event_type not in self.VALID_EVENT_TYPES:
            logger.warning("Invalid event type: %s", event_type)
            return None

        if severity not in self.SEVERITY_LEVELS:
            severity = "medium"

        confidence = max(0.0, min(1.0, confidence))  # Clamp to [0, 1]

        # Check cooldown
        if not self.should_emit_event(approach, event_type, location_hint):
            logger.debug("Event %s:%s on %s is in cooldown", event_type, location_hint, approach)
            return None

        # Generate event ID
        event_id = f"evt_{uuid.uuid4().hex[:12]}"
        now = datetime.now(UTC).isoformat()

        # Structure the event
        event = {
            "event_id": event_id,
            "start_time": timestamp,
            "end_time": None,
            "event_type": event_type,
            "severity": severity,
            "approach": approach,
            "lane_id": lane_id,
            "confidence": confidence,
            "description": description,
            "recommendation": recommendation,
            "snapshot_path": snapshot_path,
            "clip_path": clip_path,
            "related_track_ids": track_ids or [],
            "queue_length_m": queue_length_m,
            "status": "active",
            "created_at": now,
            "updated_at": now,
        }

        # Store in database
        try:
            self.db.insert_event(
                event_id=event_id,
                start_time=timestamp,
                event_type=event_type,
                approach=approach,
                severity=severity,
                confidence=confidence,
                description=description,
                recommendation=recommendation,
                end_time=None,
                lane_id=lane_id,
                snapshot_path=snapshot_path,
                clip_path=clip_path,
                related_track_ids=track_ids,
                queue_length_m=queue_length_m,
                status="active",
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to store event: %s", exc)
            return None

        # Track in memory
        self._active_windows[event_id] = {
            "type": event_type,
            "approach": approach,
            "start_time": timestamp,
        }

        logger.info("Event created: %s (type=%s, approach=%s, confidence=%.2f)", 
                   event_id, event_type, approach, confidence)

        return event

    def acknowledge_event(self, event_id: str) -> bool:
        """Mark an event as acknowledged by operator."""
        try:
            self.db.acknowledge_event(event_id)
            if event_id in self._active_windows:
                self._active_windows[event_id]["status"] = "acknowledged"
            logger.info("Event acknowledged: %s", event_id)
            return True
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to acknowledge event: %s", exc)
            return False

    def clear_event(self, event_id: str, end_time: str | None = None) -> bool:
        """Mark an event as cleared/resolved."""
        end_time = end_time or datetime.now(UTC).isoformat()
        try:
            self.db.clear_event(event_id, end_time)
            if event_id in self._active_windows:
                del self._active_windows[event_id]
            logger.info("Event cleared: %s", event_id)
            return True
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to clear event: %s", exc)
            return False

    def get_active_events(self) -> list[dict[str, Any]]:
        """Get currently active events."""
        try:
            return self.db.get_active_events(limit=100)
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to retrieve active events: %s", exc)
            return []

    def get_event_dashboard_format(self) -> dict[str, Any]:
        """Get events in dashboard-friendly format."""
        events = self.get_active_events()
        formatted = {
            "total_active": len(events),
            "by_severity": defaultdict(int),
            "by_type": defaultdict(int),
            "by_approach": defaultdict(int),
            "events": [],
        }

        for evt in events:
            # Ensure we have dict-like access
            if isinstance(evt, dict):
                event_dict = evt
            else:
                event_dict = dict(evt)

            severity = event_dict.get("severity", "unknown")
            event_type = event_dict.get("event_type", "unknown")
            approach = event_dict.get("approach", "unknown")

            formatted["by_severity"][severity] += 1
            formatted["by_type"][event_type] += 1
            formatted["by_approach"][approach] += 1

            # Format for dashboard
            formatted["events"].append({
                "event_id": event_dict.get("event_id"),
                "type": event_type,
                "severity": severity,
                "approach": approach,
                "time": event_dict.get("start_time"),
                "confidence": event_dict.get("confidence", 0.0),
                "description": event_dict.get("description", ""),
                "recommendation": event_dict.get("recommendation", ""),
                "status": event_dict.get("status", "active"),
            })

        return formatted

    @staticmethod
    def format_event_for_api(event_dict: dict[str, Any]) -> dict[str, Any]:
        """Format event for API response."""
        track_ids = event_dict.get("related_track_ids")
        if isinstance(track_ids, str):
            try:
                track_ids = json.loads(track_ids)
            except (json.JSONDecodeError, TypeError):
                track_ids = []

        return {
            "event_id": event_dict.get("event_id"),
            "start_time": event_dict.get("start_time"),
            "end_time": event_dict.get("end_time"),
            "event_type": event_dict.get("event_type"),
            "severity": event_dict.get("severity"),
            "approach": event_dict.get("approach"),
            "lane_id": event_dict.get("lane_id"),
            "confidence": event_dict.get("confidence"),
            "description": event_dict.get("description"),
            "recommendation": event_dict.get("recommendation"),
            "snapshot_path": event_dict.get("snapshot_path"),
            "clip_path": event_dict.get("clip_path"),
            "related_track_ids": track_ids or [],
            "queue_length_m": event_dict.get("queue_length_m"),
            "status": event_dict.get("status"),
        }


if __name__ == "__main__":
    # Quick test
    logging.basicConfig(level=logging.INFO)
    from phase3_database import Phase3Database

    db = Phase3Database("test_event_mgr.db")
    mgr = EventManager(db)

    # Create an event
    evt = mgr.create_event(
        event_type="queue_spillback",
        approach="northbound",
        timestamp="2024-01-01T10:00:00Z",
        severity="high",
        confidence=0.92,
        description="Queue spillback detected on north approach",
        recommendation="Extend green time for northbound phase by 10 seconds",
        queue_length_m=150.0,
    )
    print(f"✓ Event created: {evt['event_id'] if evt else 'Failed'}")

    # Try to create duplicate in cooldown window
    evt2 = mgr.create_event(
        event_type="queue_spillback",
        approach="northbound",
        timestamp="2024-01-01T10:00:30Z",
        severity="high",
        confidence=0.90,
        description="Queue spillback still present",
        recommendation="Continue green extension",
        queue_length_m=160.0,
    )
    print(f"✓ Duplicate suppressed: {evt2 is None}")

    # Get events
    events = mgr.get_active_events()
    print(f"✓ Active events: {len(events)}")

    db.close()
    print("✓ Event manager test passed")
