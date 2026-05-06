"""Tests for the backtesting utility."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))


def test_backtest_runs_and_returns_structure():
    """backtester.backtest() should return a dict with required keys."""
    from utils.backtester import backtest

    result = backtest(horizon_minutes=15)
    assert isinstance(result, dict)
    assert "overall_mae_veh_h" in result
    assert "directions" in result
    assert "backtest_timestamp" in result
    assert "horizon_minutes" in result
    assert result["horizon_minutes"] == 15


def test_backtest_directions_covered():
    from utils.backtester import backtest, DIRECTIONS

    result = backtest(horizon_minutes=15)
    for direction in DIRECTIONS:
        assert direction in result["directions"]


def test_backtest_mae_reasonable():
    """Overall MAE should be below 200 veh/h (sanity check)."""
    from utils.backtester import backtest

    result = backtest(horizon_minutes=15)
    assert result["overall_mae_veh_h"] < 200.0, \
        f"MAE {result['overall_mae_veh_h']} is unreasonably high — check forecaster"


def test_backtest_writes_json():
    from utils.backtester import backtest, APP_DATA

    backtest(horizon_minutes=15)
    eval_path = APP_DATA / "model_evaluation.json"
    assert eval_path.exists()
    data = json.loads(eval_path.read_text(encoding="utf-8"))
    assert "overall_mae_veh_h" in data


def test_backtest_direction_metrics_sane():
    from utils.backtester import backtest

    result = backtest(horizon_minutes=15)
    for direction, res in result["directions"].items():
        if "error" in res:
            continue
        assert res["mae_veh_h"] >= 0
        assert res["rmse_veh_h"] >= res["mae_veh_h"] - 0.1  # RMSE >= MAE (geometric)
        assert res["n_predictions"] > 0
        assert 0 <= res["mape_pct"] < 200  # sanity cap


def test_forecast_bounds_always_bracket_estimate():
    """All forecast bounds must satisfy lower <= estimate <= upper."""
    from forecasting.flow_forecaster import FlowForecaster
    from datetime import datetime, timezone

    cfg = {"forecasting": {"model_path": str(ROOT / "scripts" / "forecasting" / "model_artifact.pkl")}}
    fc = FlowForecaster.load_or_default(cfg)
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    violations = []
    for direction in ("northbound", "southbound", "eastbound", "westbound"):
        for horizon in (5, 15, 30):
            pt = fc.predict(direction, when=now, horizon_minutes=horizon)
            if not (pt.lower_bound <= pt.veh_per_hour <= pt.upper_bound):
                violations.append(
                    f"{direction} {horizon}min: "
                    f"{pt.lower_bound:.1f} <= {pt.veh_per_hour:.1f} <= {pt.upper_bound:.1f}"
                )
    assert not violations, "Forecast bound violations:\n" + "\n".join(violations)
