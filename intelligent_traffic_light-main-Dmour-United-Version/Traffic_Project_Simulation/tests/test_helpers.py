"""Smoke tests for the small pure helpers introduced in the refactor."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))


def test_parse_lane_id_valid():
    from core.live_support import parse_lane_id

    assert parse_lane_id("edge_5") == ("edge", 5)
    assert parse_lane_id("150999182#0_2") == ("150999182#0", 2)


def test_parse_lane_id_invalid():
    from core.live_support import parse_lane_id

    assert parse_lane_id("") is None
    assert parse_lane_id("nounderscore") is None
    assert parse_lane_id("edge_abc") is None


def test_format_direction_short():
    from core.live_support import format_direction_short

    assert format_direction_short("northbound") == "north"
    assert format_direction_short(None) == "unknown"
    assert format_direction_short("") == "unknown"


def test_decode_polyline_round_trip():
    from core.live_support import decode_polyline

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


def test_build_approach_capacity_profiles_uses_geometry():
    from core.live_support import build_approach_capacity_profiles

    config = {
        "simulation": {
            "google_base_capacity_veh_h": 220,
            "vehicle_length_meters": 7.5,
        }
    }
    geometry = {
        "approaches": {
            "northbound": {"monitor_lanes": ["n_0", "n_1"], "route_length_m": 320.0},
            "southbound": {"monitor_lanes": ["s_0"], "route_length_m": 180.0},
            "eastbound": {"monitor_lanes": ["e_0", "e_1", "e_2"], "route_length_m": 260.0},
            "westbound": {"monitor_lanes": ["w_0", "w_1"], "route_length_m": 240.0},
        },
        "lanes": [
            {"id": "n_0", "length_m": 140.0, "width_m": 3.5},
            {"id": "n_1", "length_m": 150.0, "width_m": 3.5},
            {"id": "s_0", "length_m": 90.0, "width_m": 3.0},
            {"id": "e_0", "length_m": 110.0, "width_m": 3.2},
            {"id": "e_1", "length_m": 115.0, "width_m": 3.2},
            {"id": "e_2", "length_m": 120.0, "width_m": 3.2},
            {"id": "w_0", "length_m": 105.0, "width_m": 3.1},
            {"id": "w_1", "length_m": 110.0, "width_m": 3.1},
        ],
    }

    profiles = build_approach_capacity_profiles(config, geometry)
    assert set(profiles) == {"northbound", "southbound", "eastbound", "westbound"}
    assert profiles["northbound"]["capacity_veh_h"] > profiles["southbound"]["capacity_veh_h"]
    assert profiles["eastbound"]["monitor_lane_count"] == 3
    assert profiles["northbound"]["capacity_basis"]["model"] == "geometry_scaled_capacity_v1"


def test_build_live_demand_exposes_capacity_and_saturation():
    from core.live_support import build_live_demand

    config = {
        "simulation": {
            "google_base_capacity_veh_h": 220,
            "base_flow_floor_veh_h": 40,
            "demand_sensitivity": 1.0,
            "max_flow_veh_h": 600,
            "vehicle_length_meters": 7.5,
        },
        "_cached_network_geometry": {
            "approaches": {
                direction: {"monitor_lanes": [f"{direction}_0", f"{direction}_1"], "route_length_m": 240.0}
                for direction in ("northbound", "southbound", "eastbound", "westbound")
            },
            "lanes": [
                {"id": f"{direction}_{idx}", "length_m": 120.0 + idx * 5.0, "width_m": 3.2}
                for direction in ("northbound", "southbound", "eastbound", "westbound")
                for idx in (0, 1)
            ],
        },
    }
    snapshot = {
        "source": "mock",
        "approaches": {
            direction: {
                "speed_ratio": 0.55,
                "delay_ratio": 0.45,
                "avg_speed_kmh": 18.0,
                "free_flow_speed_kmh": 33.0,
                "jam_share": 0.30,
                "slow_share": 0.20,
                "congestion_level": "heavy",
            }
            for direction in ("northbound", "southbound", "eastbound", "westbound")
        },
    }

    demand_state = build_live_demand(config, snapshot)
    north = demand_state["demand"]["northbound"]
    assert north["capacity_veh_h"] > 0
    assert north["saturation_ratio"] > 0
    assert north["monitor_lane_count"] == 2
    assert north["capacity_basis"]["model"] == "geometry_scaled_capacity_v1"


def test_build_detector_historical_analytics_shape():
    from core.live_support import DetectorCalibrator, build_detector_historical_analytics

    payload = build_detector_historical_analytics(DetectorCalibrator())
    assert payload["source"] == "detector_data"
    assert len(payload["weekdays"]) == 7
    assert len(payload["hours"]) == 24
    north = payload["directions"]["northbound"]
    assert len(north["heatmap"]) == 7
    assert len(north["heatmap"][0]) == 24
    assert isinstance(north["top_hours"], list)
    assert "hourly_profile" in north
    assert "approaches" in payload
    assert "1" in payload["approaches"]
    assert payload["approaches"]["1"]["direction"] == "northbound"
    assert "hourly_profile" in payload["approaches"]["1"]


def test_peak_hours_sorted_descending():
    from core.live_support import DetectorCalibrator, build_detector_historical_analytics

    payload = build_detector_historical_analytics(DetectorCalibrator())
    entries = payload["directions"]["eastbound"]["top_hours"]
    if len(entries) >= 2:
        assert entries[0]["mean_veh_h"] >= entries[1]["mean_veh_h"]
    approach_entries = payload["approaches"]["12"]["top_hours"]
    if len(approach_entries) >= 2:
        assert approach_entries[0]["mean_veh_h"] >= approach_entries[1]["mean_veh_h"]
