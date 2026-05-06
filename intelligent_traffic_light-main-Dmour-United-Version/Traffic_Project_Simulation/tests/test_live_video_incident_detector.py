"""Tests for optional YOLOv8 crash/fire incident detection."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))


def _zones():
    return [{
        "zone_id": "north_zone",
        "direction": "northbound",
        "points_norm": [[0.1, 0.1], [0.6, 0.1], [0.6, 0.6], [0.1, 0.6]],
        "enabled": True,
        "render_order": 1,
    }]


def test_collision_requires_temporal_confirmation():
    from live_video.incident_detector import VisionIncidentDetector

    detector = VisionIncidentDetector(enabled=True, weights=None, zones=_zones())
    detection = {
        "class_name": "crashed_vehicle",
        "confidence": 0.70,
        "center_norm": {"x": 0.3, "y": 0.3},
    }
    assert detector.ingest_detections([detection], timestamp_s=10.0) == []
    assert detector.ingest_detections([detection], timestamp_s=11.0) == []
    events = detector.ingest_detections([detection], timestamp_s=12.0)
    assert len(events) == 1
    assert events[0]["incident_type"] == "collision"
    assert events[0]["event_type"] == "incident_crash"
    assert events[0]["direction"] == "northbound"
    assert events[0]["severity"] == "CRITICAL"


def test_fire_requires_two_high_confidence_hits_and_dedupes():
    from live_video.incident_detector import VisionIncidentDetector

    detector = VisionIncidentDetector(enabled=True, weights=None, zones=_zones(), dedup_window_s=30)
    low = {"class_name": "fire", "confidence": 0.40, "center_norm": {"x": 0.3, "y": 0.3}}
    high = {"class_name": "fire", "confidence": 0.90, "center_norm": {"x": 0.3, "y": 0.3}}
    assert detector.ingest_detections([low], timestamp_s=20.0) == []
    assert detector.ingest_detections([high], timestamp_s=21.0) == []
    first = detector.ingest_detections([high], timestamp_s=22.0)
    assert len(first) == 1
    assert first[0]["incident_type"] == "fire"
    assert detector.ingest_detections([high], timestamp_s=23.0) == []


def test_detector_describes_safe_degraded_state():
    from live_video.incident_detector import VisionIncidentDetector

    detector = VisionIncidentDetector(enabled=False, weights=None, zones=[])
    assert detector.load() is False
    desc = detector.describe()
    assert desc["enabled"] is False
    assert desc["loaded"] is False
    assert "disabled" in desc["load_error"].lower()
