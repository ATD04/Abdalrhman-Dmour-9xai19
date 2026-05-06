"""Backtesting module for the FlowForecaster.

Runs the forecaster over historical detector CSVs with a sliding window, computing
MAE, RMSE, MAPE, and 95th-percentile errors broken down by direction, hour (peak/off-peak),
and day. Saves results to `app/data/model_evaluation.json`.
"""

from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

# Allow imports from scripts/
SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
if str(SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_ROOT))

from forecasting.flow_forecaster import FlowForecaster, DIRECTIONS  # noqa: E402

PEAK_HOURS = {7, 8, 9, 16, 17, 18}
APP_DATA = SCRIPTS_ROOT.parent / "app" / "data"


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = min(int(len(ordered) * pct / 100.0), len(ordered) - 1)
    return ordered[idx]


def backtest(horizon_minutes: int = 15) -> dict[str, Any]:
    """Run a leave-future-out backtest over all detector data.

    For each timestamp t (starting after enough history for the forecaster), predict
    flow at t + horizon and compare to actual flow at that timestamp.
    """
    forecaster = FlowForecaster.load_or_default({"forecasting": {"model_path": None}})

    results: dict[str, dict[str, Any]] = {}
    overall_errors: list[float] = []

    for direction in DIRECTIONS:
        samples = forecaster.history.get(direction, [])
        if len(samples) < 128:
            results[direction] = {"error": f"insufficient data ({len(samples)})"}
            continue

        # Build a lookup: timestamp → veh/h
        ts_to_value = {ts: val for ts, val in samples}
        sorted_ts = sorted(ts_to_value.keys())
        horizon_delta = timedelta(minutes=horizon_minutes)

        errors: list[float] = []
        abs_errors: list[float] = []
        pct_errors: list[float] = []
        peak_errors: list[float] = []
        offpeak_errors: list[float] = []
        by_hour: dict[int, list[float]] = {h: [] for h in range(24)}

        # Walk through timestamps starting from index 96 (need history)
        for i in range(96, len(sorted_ts)):
            ts = sorted_ts[i]
            target_ts = ts + horizon_delta
            actual = ts_to_value.get(target_ts)
            if actual is None:
                continue

            point = forecaster.predict(direction, when=ts, horizon_minutes=horizon_minutes)
            predicted = point.veh_per_hour
            error = predicted - actual
            abs_err = abs(error)

            errors.append(error)
            abs_errors.append(abs_err)
            overall_errors.append(abs_err)

            if actual > 10.0:
                pct_errors.append(abs_err / actual * 100.0)

            if ts.hour in PEAK_HOURS:
                peak_errors.append(abs_err)
            else:
                offpeak_errors.append(abs_err)

            by_hour[ts.hour].append(abs_err)

        if not abs_errors:
            results[direction] = {"error": "no valid prediction pairs"}
            continue

        n = len(abs_errors)
        mae = sum(abs_errors) / n
        rmse = math.sqrt(sum(e ** 2 for e in errors) / n)
        mape = sum(pct_errors) / len(pct_errors) if pct_errors else 0.0
        p95 = _percentile(abs_errors, 95)

        results[direction] = {
            "n_predictions": n,
            "horizon_minutes": horizon_minutes,
            "mae_veh_h": round(mae, 1),
            "rmse_veh_h": round(rmse, 1),
            "mape_pct": round(mape, 1),
            "p95_error_veh_h": round(p95, 1),
            "peak_mae": round(sum(peak_errors) / len(peak_errors), 1) if peak_errors else None,
            "offpeak_mae": round(sum(offpeak_errors) / len(offpeak_errors), 1) if offpeak_errors else None,
            "by_hour": {
                str(h): round(sum(vals) / len(vals), 1) if vals else None
                for h, vals in by_hour.items()
            },
        }

    overall_mae = sum(overall_errors) / len(overall_errors) if overall_errors else 0.0
    output = {
        "backtest_timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "horizon_minutes": horizon_minutes,
        "overall_mae_veh_h": round(overall_mae, 1),
        "directions": results,
    }

    # Write to app/data
    out_path = APP_DATA / "model_evaluation.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"Backtest complete → {out_path}")
    print(f"  Overall MAE: {overall_mae:.1f} veh/h across {len(overall_errors)} predictions")
    for direction, res in results.items():
        if "mae_veh_h" in res:
            print(f"  {direction}: MAE={res['mae_veh_h']}, RMSE={res['rmse_veh_h']}, MAPE={res['mape_pct']}%")

    return output


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="Backtest the flow forecasting model")
    parser.add_argument("--horizon", type=int, default=15, help="Forecast horizon in minutes")
    args = parser.parse_args()
    backtest(args.horizon)


if __name__ == "__main__":
    main()
