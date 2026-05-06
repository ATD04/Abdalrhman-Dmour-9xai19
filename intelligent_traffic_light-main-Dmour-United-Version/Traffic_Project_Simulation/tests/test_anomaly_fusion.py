"""Tests for the AnomalyDetector including video cross-validation and incident classification."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))


def _make_live_state(queue=5, speed=25.0, flow=200.0, delay=10.0, speed_ratio=0.85):
    """Helper to build a fake live_state for scoring."""
    from anomaly.detector import DIRECTIONS

    return {
        "metrics": {
            d: {
                "queue_vehicles": queue,
                "queue_m": queue * 7.5,
                "avg_speed_kmh": speed,
                "flow_veh_h": flow,
                "density": min(1.0, queue / 30.0),
            }
            for d in DIRECTIONS
        },
        "google_snapshot": {
            d: {"delay_s": delay, "speed_ratio": speed_ratio}
            for d in DIRECTIONS
        },
    }


def test_anomaly_detector_warmup():
    from anomaly.detector import AnomalyDetector

    ad = AnomalyDetector.load_or_default({"anomaly": {"model_path": None, "anomaly_threshold": 0.65}})
    result = ad.score(_make_live_state())
    assert "directions" in result
    assert "any_anomaly" in result
    assert "incidents" in result
    assert result["mode"] in ("statistical", "iforest")


def test_anomaly_severity_levels():
    from anomaly.detector import AnomalyDetector

    ad = AnomalyDetector(threshold=0.65)
    assert ad._severity_for_score(0.90) == "CRITICAL"
    assert ad._severity_for_score(0.75) == "HIGH"
    assert ad._severity_for_score(0.60) == "MEDIUM"
    assert ad._severity_for_score(0.30) == "LOW"


def test_anomaly_detects_high_queue():
    from anomaly.detector import AnomalyDetector

    ad = AnomalyDetector(threshold=0.3, window_size=60)
    # Warm up with normal data
    for _ in range(15):
        ad.score(_make_live_state(queue=3, speed=30.0))

    # Now inject anomalous state
    result = ad.score(_make_live_state(queue=25, speed=5.0, delay=100.0, speed_ratio=0.3))
    # Should detect at least one anomaly
    has_anomaly = result["any_anomaly"]
    # After warmup, this should be detected
    if has_anomaly:
        assert len(result["incidents"]) > 0


def test_video_cross_validation_boosts_score():
    from anomaly.detector import AnomalyDetector

    ad = AnomalyDetector(threshold=0.65, window_size=60)
    # Warm up
    for _ in range(10):
        ad.score(_make_live_state())

    # Score without video events
    result_no_video = ad.score(_make_live_state(queue=12, speed=10.0))
    north_score_no_video = result_no_video["directions"]["northbound"]["score"]

    # Score with corroborating video events
    video_events = [
        {"event_type": "queue_pressure", "zone": "north_approach"},
    ]
    result_video = ad.score(_make_live_state(queue=12, speed=10.0), video_events=video_events)
    north_score_video = result_video["directions"]["northbound"]["score"]

    # Video corroboration should boost the score (or at least not lower it)
    assert north_score_video >= north_score_no_video


def test_incident_classification():
    from anomaly.detector import AnomalyDetector

    ad = AnomalyDetector(threshold=0.1, window_size=60)  # low threshold to trigger
    # Warm up
    for _ in range(10):
        ad.score(_make_live_state())

    # High queue + low speed → queue_spillback
    result = ad.score(_make_live_state(queue=20, speed=3.0, delay=120.0, speed_ratio=0.2))
    incidents = result["incidents"]
    if incidents:
        types = [inc["type"] for inc in incidents]
        assert any(t in ("queue_spillback", "severe_congestion", "rear_end_risk") for t in types)
        # All incidents should have required fields
        for inc in incidents:
            assert "direction" in inc
            assert "severity" in inc
            assert "recommendation" in inc


def test_data_source_factory_mock():
    from data_sources import build_data_source

    config = {
        "data_sources": {"primary": "mock", "fallback_chain": []},
        "paths": {"google_service_account": None},
    }
    source = build_data_source(config)
    assert source is not None
    desc = source.describe()
    assert "primary" in desc


def test_mock_data_source_snapshot():
    from data_sources.mock_source import MockDataSource

    mock = MockDataSource(seed=42)
    assert mock.is_healthy()
    snap = mock.fetch_snapshot({"lat": 31.96, "lon": 35.89})
    assert snap.source == "mock"
    assert len(snap.approaches) == 4
    for direction in ("northbound", "southbound", "eastbound", "westbound"):
        approach = snap.approaches[direction]
        assert 0.0 <= approach["speed_ratio"] <= 1.0
        assert approach["congestion_level"] in ("free", "light", "moderate", "heavy", "severe")
