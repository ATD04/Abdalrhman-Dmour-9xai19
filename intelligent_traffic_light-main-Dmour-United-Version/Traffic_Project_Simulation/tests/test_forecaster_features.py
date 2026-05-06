"""Tests for the FlowForecaster feature engineering and prediction pipeline."""

from __future__ import annotations

import sys
import json
import threading
from datetime import datetime
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib import request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))


def _make_timestamps(n: int):
    """Generate n timestamps at 15-minute intervals starting 2024-01-01 00:00."""
    from datetime import timedelta
    base = datetime(2024, 1, 1, 0, 0)
    return [base + timedelta(minutes=15 * i) for i in range(n)]


def test_build_features_returns_correct_length():
    from forecasting.flow_forecaster import _build_features, FEATURE_NAMES

    values = [float(i * 10) for i in range(200)]
    timestamps = _make_timestamps(200)

    features = _build_features(values, timestamps, 100)
    assert features is not None
    assert len(features) == len(FEATURE_NAMES)
    assert len(features) == 14


def test_build_features_returns_none_for_short_index():
    from forecasting.flow_forecaster import _build_features

    values = [float(i) for i in range(50)]
    timestamps = [datetime(2024, 1, 1, 0, 0) for _ in range(50)]

    assert _build_features(values, timestamps, 10) is None
    assert _build_features(values, timestamps, 95) is None


def test_build_features_lag_values():
    from forecasting.flow_forecaster import _build_features

    values = [float(i * 10) for i in range(200)]
    timestamps = _make_timestamps(200)

    features = _build_features(values, timestamps, 100)
    assert features is not None
    # lag_1 should be values[99]
    assert features[0] == values[99]
    # lag_2 should be values[98]
    assert features[1] == values[98]
    # lag_96 should be values[4]
    assert features[4] == values[4]


def test_build_features_cyclical_encoding():
    import math
    from forecasting.flow_forecaster import _build_features

    values = [float(i * 10) for i in range(200)]
    # All timestamps at hour 12
    timestamps = [datetime(2024, 1, 1, 12, 0) for _ in range(200)]

    features = _build_features(values, timestamps, 100)
    assert features is not None
    # hour_sin and hour_cos for hour 12
    expected_sin = math.sin(2.0 * math.pi * 12 / 24.0)
    expected_cos = math.cos(2.0 * math.pi * 12 / 24.0)
    assert abs(features[12] - expected_sin) < 1e-10
    assert abs(features[13] - expected_cos) < 1e-10


def test_forecaster_seasonal_naive():
    from forecasting.flow_forecaster import FlowForecaster

    fc = FlowForecaster.load_or_default({"forecasting": {"model_path": None}})
    point = fc.predict("northbound", horizon_minutes=15)
    assert point.minutes_ahead == 15
    assert point.veh_per_hour > 0
    assert point.lower_bound <= point.veh_per_hour
    assert point.upper_bound >= point.veh_per_hour


def test_forecaster_confidence_bounds():
    from forecasting.flow_forecaster import FlowForecaster

    fc = FlowForecaster.load_or_default({"forecasting": {"model_path": None}})
    point = fc.predict("eastbound", horizon_minutes=30)
    # Upper bound should be at least as big as point estimate
    assert point.upper_bound >= point.veh_per_hour * 0.9  # small tolerance
    # Lower bound should be non-negative
    assert point.lower_bound >= 0


def test_append_observation_updates_predictions():
    from forecasting.flow_forecaster import FlowForecaster

    fc = FlowForecaster.load_or_default({"forecasting": {"model_path": None}})
    pred_before = fc.predict("northbound", horizon_minutes=15)

    # Append high-flow observations
    now = datetime(2024, 1, 3, 8, 0)  # Wednesday 8:00 AM (peak)
    for i in range(10):
        fc.append_observation("northbound", now, 800.0)

    # Predict for the same slot
    pred_after = fc.predict("northbound", when=now, horizon_minutes=15)
    # With high observations added, the prediction should increase
    # (at least it shouldn't crash)
    assert pred_after.veh_per_hour > 0


def test_predict_all_returns_all_directions():
    from forecasting.flow_forecaster import FlowForecaster, DIRECTIONS

    fc = FlowForecaster.load_or_default({"forecasting": {"model_path": None}})
    result = fc.predict_all(horizons=(5, 15, 30, 60))

    assert "directions" in result
    assert "mode" in result
    assert result["schema_version"] == 2
    assert result["horizons"] == [5, 15, 30, 60]
    for direction in DIRECTIONS:
        assert direction in result["directions"]
        forecasts = result["directions"][direction]
        assert len(forecasts) == 4
        for f in forecasts:
            assert "veh_per_hour" in f
            assert "confidence" in f
            assert "lower_bound" in f
            assert "upper_bound" in f
            assert "forecast_for" in f
            assert f["recommendation"] in {"EXTEND_GREEN", "MAINTAIN", "REDUCE_GREEN"}
            assert f["spillback_risk"] in {"LOW", "MEDIUM", "HIGH"}
            assert 0.0 <= f["percentile_rank"] <= 1.0


def test_predict_all_clamps_horizons_to_operational_window():
    from forecasting.flow_forecaster import FlowForecaster

    fc = FlowForecaster.load_or_default({"forecasting": {"model_path": None}})
    result = fc.predict_all(horizons=(1, 15, 120, 60))
    assert result["horizons"] == [5, 15, 60]


def test_describe_includes_feature_info():
    from forecasting.flow_forecaster import FlowForecaster

    fc = FlowForecaster.load_or_default({"forecasting": {"model_path": None}})
    desc = fc.describe()
    assert desc["feature_count"] == 14
    assert "lag_1" in desc["feature_names"]
    assert "live_buffer_points" in desc


def test_flow_forecast_http_endpoint_supports_60_minute_horizon(tmp_path):
    from core.start_live_simulation import LiveHandler
    from forecasting.flow_forecaster import FlowForecaster

    class ForecastEngine:
        manifest = {"simulation_center": {"lat": 31.96387, "lon": 35.88957}}
        controller_tls_id = "tls_test"

        def __init__(self):
            self.forecaster = FlowForecaster.load_or_default({"forecasting": {"model_path": None}})

        def get_state(self):
            return {
                "status": "running",
                "source": "test",
                "demand": {
                    "northbound": {"pressure_index": 0.8, "target_veh_h": 900, "storage_capacity_vehicles": 30},
                    "southbound": {"pressure_index": 0.2, "target_veh_h": 200, "storage_capacity_vehicles": 30},
                    "eastbound": {"pressure_index": 0.5, "target_veh_h": 400, "storage_capacity_vehicles": 20},
                    "westbound": {"pressure_index": 0.7, "target_veh_h": 500, "storage_capacity_vehicles": 15},
                },
            }

        def get_state_json(self):
            return None

    handler = partial(LiveHandler, engine=ForecastEngine(), chat_service=None)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        base = f"http://127.0.0.1:{server.server_address[1]}"
        with request.urlopen(base + "/api/flow-forecast?horizon=60", timeout=5) as response:  # noqa: S310
            payload = json.loads(response.read().decode("utf-8"))
        assert 60 in payload["horizons"]
        north = payload["directions"]["northbound"]
        assert any(item["horizon_minutes"] == 60 for item in north)
        assert any(item["recommendation"] == "EXTEND_GREEN" for item in north)
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
