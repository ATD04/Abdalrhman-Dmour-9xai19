"""Smoke tests for the small pure helpers introduced in the refactor."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))


def test_parse_lane_id_valid():
    from live_support import parse_lane_id

    assert parse_lane_id("edge_5") == ("edge", 5)
    assert parse_lane_id("150999182#0_2") == ("150999182#0", 2)


def test_parse_lane_id_invalid():
    from live_support import parse_lane_id

    assert parse_lane_id("") is None
    assert parse_lane_id("nounderscore") is None
    assert parse_lane_id("edge_abc") is None


def test_format_direction_short():
    from live_support import format_direction_short

    assert format_direction_short("northbound") == "north"
    assert format_direction_short(None) == "unknown"
    assert format_direction_short("") == "unknown"


def test_decode_polyline_round_trip():
    from live_support import decode_polyline

    # Standard test from Google docs
    points = decode_polyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")
    assert len(points) == 3
    expected = [(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)]
    for p, (lat, lon) in zip(points, expected):
        assert abs(p["lat"] - lat) < 1e-3, p
        assert abs(p["lon"] - lon) < 1e-3, p


def test_forecaster_seasonal_naive():
    from forecasting.flow_forecaster import FlowForecaster

    fc = FlowForecaster.load_or_default({"forecasting": {"model_path": None}})
    point = fc.predict("northbound", horizon_minutes=15)
    assert point.minutes_ahead == 15
    assert point.veh_per_hour > 0


def test_anomaly_detector_warmup():
    from anomaly.detector import AnomalyDetector

    ad = AnomalyDetector.load_or_default({"anomaly": {"model_path": None, "anomaly_threshold": 0.65}})
    fake_state = {
        "metrics": {
            "northbound": {"queue_vehicles": 0, "queue_m": 0, "avg_speed_kmh": 35, "flow_veh_h": 200, "density": 0.1},
            "southbound": {"queue_vehicles": 0, "queue_m": 0, "avg_speed_kmh": 30, "flow_veh_h": 180, "density": 0.1},
            "eastbound":  {"queue_vehicles": 0, "queue_m": 0, "avg_speed_kmh": 28, "flow_veh_h": 150, "density": 0.1},
            "westbound":  {"queue_vehicles": 0, "queue_m": 0, "avg_speed_kmh": 32, "flow_veh_h": 220, "density": 0.1},
        },
        "google_snapshot": {
            "northbound": {"delay_s": 5, "speed_ratio": 0.92},
            "southbound": {"delay_s": 8, "speed_ratio": 0.88},
            "eastbound":  {"delay_s": 12, "speed_ratio": 0.80},
            "westbound":  {"delay_s": 6, "speed_ratio": 0.91},
        },
    }
    result = ad.score(fake_state)
    assert "directions" in result
    assert "any_anomaly" in result
    assert result["mode"] in ("statistical", "iforest")


def test_data_source_factory():
    from data_sources import build_data_source

    minimal_config = {
        "data_sources": {"primary": "detector", "fallback_chain": []},
        "paths": {"google_service_account": None},
    }
    source = build_data_source(minimal_config)
    assert source is not None
    description = source.describe()
    assert "primary" in description
