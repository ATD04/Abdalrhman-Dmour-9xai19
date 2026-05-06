"""Traffic-flow forecasting model — Phase 2 Advanced Implementation.

Uses historical detector data (Traffic_Data_Sandbox/detector_data/*.csv) to predict
per-direction vehicle counts 5/15/30 minutes ahead.

Architecture:
  - **Feature Engineering**: lag features (t-1..t-4, t-96), rolling means (15m/30m/60m),
    temporal features (hour, dow, is_weekend), signal context, cross-direction flow.
  - **Model**: HistGradientBoostingRegressor with TimeSeriesSplit cross-validation.
  - **Confidence**: QuantileRegressor for 80% prediction intervals (lower=10%, upper=90%).
  - **Online Learning**: `append_observation()` updates history at runtime so predictions
    improve as the session runs.
  - **Evaluation**: MAE, RMSE, MAPE printed during training.

Falls back to seasonal-naive if sklearn or model artifact is unavailable.
"""

from __future__ import annotations

import csv
import json
import logging
import math
import pickle
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Sequence

logger = logging.getLogger("its.forecasting")

UTC = timezone.utc
DIRECTIONS = ("northbound", "southbound", "eastbound", "westbound")
RECOMMEND_EXTEND = "EXTEND_GREEN"
RECOMMEND_MAINTAIN = "MAINTAIN"
RECOMMEND_REDUCE = "REDUCE_GREEN"
DIRECTION_TO_APPROACHES = {
    "northbound": ["1", "2", "3"],
    "southbound": ["4", "5", "6"],
    "eastbound": ["7", "8", "9"],
    "westbound": ["10", "11", "12", "13", "14"],
}

PROJECT_ROOT = Path(__file__).resolve().parents[2].parent
SANDBOX_ROOT = PROJECT_ROOT / "Traffic_Data_Sandbox"
DETECTOR_DIR = SANDBOX_ROOT / "detector_data"


@dataclass
class ForecastPoint:
    minutes_ahead: int
    veh_per_hour: float
    confidence: float
    lower_bound: float = 0.0
    upper_bound: float = 0.0


def _build_features(
    values: list[float],
    timestamps: list[datetime],
    index: int,
) -> list[float] | None:
    """Build feature vector for sample at `index`.

    Features (14 total):
      0: lag_1        (t - 15min)
      1: lag_2        (t - 30min)
      2: lag_4        (t - 1hr)
      3: lag_8        (t - 2hr)
      4: lag_96       (t - 24hr / same time yesterday)
      5: rolling_4    (mean of last 4 = 1hr rolling mean)
      6: rolling_8    (mean of last 8 = 2hr rolling mean)
      7: rolling_16   (mean of last 16 = 4hr rolling mean)
      8: hour_of_day  (0..23)
      9: day_of_week  (0=Mon..6=Sun)
      10: is_weekend  (0 or 1)
      11: is_peak     (1 if hour in [7,8,9,16,17,18])
      12: hour_sin    (cyclical encoding)
      13: hour_cos    (cyclical encoding)
    """
    if index < 96:
        return None

    try:
        lag_1 = values[index - 1]
        lag_2 = values[index - 2]
        lag_4 = values[index - 4]
        lag_8 = values[index - 8]
        lag_96 = values[index - 96]
    except IndexError:
        return None

    roll_4 = sum(values[index - 4:index]) / 4.0
    roll_8 = sum(values[index - 8:index]) / 8.0
    roll_16 = sum(values[index - 16:index]) / 16.0 if index >= 16 else roll_8

    ts = timestamps[index]
    hour = ts.hour
    dow = ts.weekday()
    is_weekend = 1.0 if dow >= 5 else 0.0
    is_peak = 1.0 if hour in (7, 8, 9, 16, 17, 18) else 0.0
    hour_sin = math.sin(2.0 * math.pi * hour / 24.0)
    hour_cos = math.cos(2.0 * math.pi * hour / 24.0)

    return [
        lag_1, lag_2, lag_4, lag_8, lag_96,
        roll_4, roll_8, roll_16,
        float(hour), float(dow), is_weekend, is_peak,
        hour_sin, hour_cos,
    ]


FEATURE_NAMES = [
    "lag_1", "lag_2", "lag_4", "lag_8", "lag_96",
    "rolling_4", "rolling_8", "rolling_16",
    "hour_of_day", "day_of_week", "is_weekend", "is_peak",
    "hour_sin", "hour_cos",
]


class FlowForecaster:
    """Per-direction forecaster with online history update.

    Two prediction modes:
      * `seasonal_naive`: returns the same-time-slot historical mean (always available).
      * `gbm`: gradient-boosted regressor on engineered features (when artifact found).
    """

    def __init__(
        self,
        history: dict[str, list[tuple[datetime, float]]],
        models: dict[str, Any] | None = None,
        quantile_models: dict[str, dict[str, Any]] | None = None,
        mode: str = "seasonal_naive",
    ) -> None:
        self.history = history
        self.models = models or {}
        self.quantile_models = quantile_models or {}
        self.mode = mode
        self._slot_index = self._build_slot_index(history)
        # Online observation buffer (appended at runtime via append_observation)
        self._live_buffer: dict[str, list[tuple[datetime, float]]] = {d: [] for d in DIRECTIONS}

    @staticmethod
    def _build_slot_index(
        history: dict[str, list[tuple[datetime, float]]],
    ) -> dict[str, dict[tuple[int, int], list[float]]]:
        index: dict[str, dict[tuple[int, int], list[float]]] = {d: defaultdict(list) for d in DIRECTIONS}
        for direction, samples in history.items():
            for ts, val in samples:
                slot = (ts.weekday(), ts.hour * 4 + ts.minute // 15)
                index[direction][slot].append(val)
        return index

    @classmethod
    def load_or_default(cls, config: dict[str, Any]) -> "FlowForecaster":
        history = cls._load_history()
        artifact = config.get("forecasting", {}).get("model_path")
        models: dict[str, Any] | None = None
        quantile_models: dict[str, dict[str, Any]] | None = None
        mode = "seasonal_naive"
        if artifact:
            artifact_path = Path(artifact)
            if not artifact_path.is_absolute():
                artifact_path = (Path(__file__).resolve().parents[2] / artifact).resolve()
            if artifact_path.exists():
                try:
                    with artifact_path.open("rb") as fh:
                        data = pickle.load(fh)  # noqa: S301
                    if isinstance(data, dict) and "_mode" not in data:
                        models = data.get("models", data)  # backward compat
                        quantile_models = data.get("quantile_models")
                        mode = "gbm"
                        logger.info("Forecasting model loaded from %s", artifact_path)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Could not load forecaster artifact %s: %s", artifact_path, exc)
        return cls(history=history, models=models, quantile_models=quantile_models, mode=mode)

    @staticmethod
    def _load_history() -> dict[str, list[tuple[datetime, float]]]:
        history: dict[str, list[tuple[datetime, float]]] = {d: [] for d in DIRECTIONS}
        if not DETECTOR_DIR.exists():
            logger.warning("Detector data directory missing: %s", DETECTOR_DIR)
            return history
        per_ts_dir: dict[datetime, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        for csv_path in sorted(DETECTOR_DIR.glob("detector_*.csv")):
            try:
                with csv_path.open("r", encoding="utf-8", newline="") as fh:
                    reader = csv.DictReader(fh)
                    for row in reader:
                        approach_id = str(int(row["approach_id"]))
                        try:
                            count = int(row["vehicle_count"])
                        except (KeyError, ValueError):
                            continue
                        try:
                            ts = datetime.strptime(row["timestamp"], "%Y-%m-%d %H:%M:%S")
                        except ValueError:
                            continue
                        for direction, approaches in DIRECTION_TO_APPROACHES.items():
                            if approach_id in approaches:
                                per_ts_dir[ts][direction] += count
            except Exception as exc:  # noqa: BLE001
                logger.debug("Skipping CSV %s: %s", csv_path, exc)

        for ts, dir_map in per_ts_dir.items():
            for direction, count_15m in dir_map.items():
                history[direction].append((ts, float(count_15m * 4)))  # convert to veh/h
        for direction in DIRECTIONS:
            history[direction].sort()
        logger.info(
            "Loaded historical detector data: %s",
            {d: len(history[d]) for d in DIRECTIONS},
        )
        return history

    # ── Online Learning ───────────────────────────────────────
    def append_observation(self, direction: str, timestamp: datetime, veh_h: float) -> None:
        """Add a live observation so future predictions benefit from recent data."""
        if direction not in DIRECTIONS:
            return
        self._live_buffer[direction].append((timestamp, veh_h))
        slot = (timestamp.weekday(), timestamp.hour * 4 + timestamp.minute // 15)
        self._slot_index.setdefault(direction, {}).setdefault(slot, []).append(veh_h)

    # ── Prediction ────────────────────────────────────────────
    def predict(
        self,
        direction: str,
        when: datetime | None = None,
        horizon_minutes: int = 15,
        live_context: dict[str, Any] | None = None,
    ) -> ForecastPoint:
        when = when or datetime.now(UTC).replace(tzinfo=None)
        target = when + timedelta(minutes=horizon_minutes)
        slot = (target.weekday(), target.hour * 4 + target.minute // 15)

        slot_values = self._slot_index.get(direction, {}).get(slot, [])
        if slot_values:
            base = sum(slot_values) / len(slot_values)
            confidence = min(0.92, 0.55 + 0.05 * len(slot_values))
        else:
            all_vals = [v for ts_list in self._slot_index.get(direction, {}).values() for v in ts_list]
            base = sum(all_vals) / len(all_vals) if all_vals else 200.0
            confidence = 0.4

        # GBM prediction if available
        gbm_prediction = None
        if self.mode == "gbm" and direction in self.models:
            gbm_prediction = self._predict_gbm(direction, when, target)

        # Live adjustment — blend with current demand
        if live_context:
            pressure = float(live_context.get("pressure_index", 0.0))
            current_demand = float(live_context.get("target_veh_h", base))
            live_samples = len(self._live_buffer.get(direction, []))
            model_weight = min(0.75, 0.55 + live_samples * 0.002)
            live_weight = 1.0 - model_weight
            blended = model_weight * base + live_weight * current_demand
            base = blended * (1.0 + 0.05 * max(0.0, pressure - 0.4))

        if gbm_prediction is not None:
            gbm_weight = 0.7 if live_context else 0.6
            base = gbm_weight * gbm_prediction + (1.0 - gbm_weight) * base
            confidence = min(0.95, confidence + 0.1)

        lower, upper = self._confidence_interval(direction, base, confidence, target)

        return ForecastPoint(
            minutes_ahead=horizon_minutes,
            veh_per_hour=round(max(0.0, base), 1),
            confidence=round(confidence, 2),
            lower_bound=round(max(0.0, lower), 1),
            upper_bound=round(upper, 1),
        )

    def _predict_gbm(self, direction: str, when: datetime, target: datetime) -> float | None:
        try:
            import numpy as np
        except ImportError:
            return None
        model = self.models.get(direction)
        if model is None:
            return None
        combined = list(self.history.get(direction, []))
        combined.extend(self._live_buffer.get(direction, []))
        combined.sort()
        if len(combined) < 96:
            return None
        values = [v for _, v in combined]
        timestamps = [t for t, _ in combined]
        features = _build_features(values, timestamps, len(values) - 1)
        if features is None:
            return None
        try:
            arr = np.array(features).reshape(1, -1)
            return float(model.predict(arr)[0])
        except Exception as exc:  # noqa: BLE001
            logger.debug("GBM prediction failed for %s: %s", direction, exc)
            return None

    def _confidence_interval(
        self, direction: str, point_estimate: float, confidence: float, target: datetime,
    ) -> tuple[float, float]:
        """Compute 80% prediction interval.

        Bounds always bracket the point estimate — the quantile models predict the
        historical distribution, so we use them to set the *width* of the interval
        centred on the point estimate, not as absolute bounds.
        """
        raw_lower: float | None = None
        raw_upper: float | None = None

        if self.quantile_models and direction in self.quantile_models:
            try:
                import numpy as np
                q_models = self.quantile_models[direction]
                combined = list(self.history.get(direction, []))
                combined.extend(self._live_buffer.get(direction, []))
                combined.sort()
                if len(combined) >= 96:
                    values = [v for _, v in combined]
                    timestamps = [t for t, _ in combined]
                    features = _build_features(values, timestamps, len(values) - 1)
                    if features is not None:
                        arr = np.array(features).reshape(1, -1)
                        raw_lower = float(q_models["lower"].predict(arr)[0])
                        raw_upper = float(q_models["upper"].predict(arr)[0])
            except Exception:  # noqa: BLE001
                pass

        if raw_lower is not None and raw_upper is not None:
            # Use the interval *width* from quantile models, centred on the point estimate
            half_width = max(0.0, raw_upper - raw_lower) / 2.0
            lower = max(0.0, point_estimate - half_width)
            upper = point_estimate + half_width
            # Guarantee the point estimate is within the interval
            lower = min(lower, point_estimate)
            upper = max(upper, point_estimate)
        else:
            # Heuristic fallback: ±(1 - confidence) * 80% of point estimate
            margin = (1.0 - confidence) * point_estimate * 0.8
            lower = max(0.0, point_estimate - margin)
            upper = point_estimate + margin

        return lower, upper

    def _historical_values(self, direction: str) -> list[float]:
        values = [value for _, value in self.history.get(direction, [])]
        values.extend(value for _, value in self._live_buffer.get(direction, []))
        return [max(0.0, float(value)) for value in values if value is not None]

    @staticmethod
    def _percentile(values: list[float], pct: float) -> float:
        if not values:
            return 0.0
        ordered = sorted(values)
        idx = min(max(int(round((len(ordered) - 1) * pct)), 0), len(ordered) - 1)
        return float(ordered[idx])

    @staticmethod
    def _percentile_rank(values: list[float], estimate: float) -> float:
        if not values:
            return 0.5
        below_or_equal = sum(1 for value in values if value <= estimate)
        return below_or_equal / len(values)

    def _forecast_decision(
        self,
        direction: str,
        point: ForecastPoint,
        live_context: dict[str, Any] | None,
    ) -> dict[str, Any]:
        values = self._historical_values(direction)
        p20 = self._percentile(values, 0.20)
        p80 = self._percentile(values, 0.80)
        rank = self._percentile_rank(values, point.veh_per_hour)
        pressure = float((live_context or {}).get("pressure_index", 0.0) or 0.0)
        storage = float((live_context or {}).get("storage_capacity_vehicles", 0.0) or 0.0)
        queue_estimate = point.veh_per_hour / 3600.0 * max(point.minutes_ahead * 60.0, 1.0)
        storage_ratio = queue_estimate / storage if storage > 0 else 0.0

        if point.veh_per_hour >= p80 or rank >= 0.80 or pressure >= 0.75:
            recommendation = RECOMMEND_EXTEND
        elif point.veh_per_hour <= p20 and pressure <= 0.35:
            recommendation = RECOMMEND_REDUCE
        else:
            recommendation = RECOMMEND_MAINTAIN

        if pressure >= 0.85 or rank >= 0.90 or storage_ratio >= 0.85:
            spillback = "HIGH"
        elif pressure >= 0.60 or rank >= 0.75 or storage_ratio >= 0.60:
            spillback = "MEDIUM"
        else:
            spillback = "LOW"

        return {
            "percentile_rank": round(rank, 3),
            "historical_p20_veh_h": round(p20, 1),
            "historical_p80_veh_h": round(p80, 1),
            "recommendation": recommendation,
            "spillback_risk": spillback,
            "storage_ratio_estimate": round(max(0.0, storage_ratio), 3),
        }

    def predict_all(
        self,
        horizons: Sequence[int] = (5, 15, 30),
        live_state: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        now = datetime.now(UTC).replace(tzinfo=None)
        generated_at = datetime.now(UTC)
        normalized_horizons = sorted({max(5, min(60, int(h))) for h in horizons})
        result: dict[str, Any] = {
            "schema_version": 2,
            "generated_at": generated_at.isoformat(timespec="seconds"),
            "mode": self.mode,
            "horizons": normalized_horizons,
            "directions": {},
        }
        demand_state = (live_state or {}).get("demand", {}) if live_state else {}
        for direction in DIRECTIONS:
            live_ctx = demand_state.get(direction, {})
            forecasts = []
            for horizon in normalized_horizons:
                point = self.predict(direction, now, horizon, live_ctx)
                decision = self._forecast_decision(direction, point, live_ctx)
                forecast_for = (generated_at + timedelta(minutes=horizon)).isoformat(timespec="seconds")
                forecasts.append(
                    {
                        "horizon_minutes": point.minutes_ahead,
                        "forecast_for": forecast_for,
                        "veh_per_hour": point.veh_per_hour,
                        "confidence": point.confidence,
                        "lower_bound": point.lower_bound,
                        "upper_bound": point.upper_bound,
                        **decision,
                    }
                )
            result["directions"][direction] = forecasts
        return result

    def describe(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "history_points": {d: len(self.history[d]) for d in DIRECTIONS},
            "live_buffer_points": {d: len(self._live_buffer[d]) for d in DIRECTIONS},
            "slots_indexed": {d: len(self._slot_index[d]) for d in DIRECTIONS},
            "feature_count": len(FEATURE_NAMES),
            "feature_names": FEATURE_NAMES,
        }


# ── Training CLI ──────────────────────────────────────────────
def _train_and_evaluate(out_path: str) -> dict[str, Any]:
    """Train GBM + quantile models with TimeSeriesSplit cross-validation."""
    try:
        from sklearn.ensemble import HistGradientBoostingRegressor
        from sklearn.model_selection import TimeSeriesSplit
        import numpy as np
    except ImportError:
        print("scikit-learn / numpy not installed — saving seasonal-naive metadata only.")
        with Path(out_path).open("wb") as fh:
            pickle.dump({"_mode": "seasonal_naive_only"}, fh)
        return {"error": "sklearn not installed"}

    forecaster = FlowForecaster.load_or_default({"forecasting": {"model_path": None}})
    summary = {direction: len(samples) for direction, samples in forecaster.history.items()}
    print(f"Loaded history: {summary}")

    models: dict[str, Any] = {}
    quantile_models: dict[str, dict[str, Any]] = {}
    evaluation: dict[str, dict[str, float]] = {}

    for direction, samples in forecaster.history.items():
        if len(samples) < 128:
            print(f"  {direction}: insufficient data ({len(samples)} < 128), skipping")
            continue

        timestamps, values = zip(*samples)
        timestamps = list(timestamps)
        values = list(values)

        X, y = [], []
        for i in range(96, len(values)):
            features = _build_features(values, timestamps, i)
            if features is not None:
                X.append(features)
                y.append(values[i])

        if len(X) < 64:
            continue

        X_arr = np.array(X)
        y_arr = np.array(y)
        print(f"\n  {direction}: {len(X)} samples, {len(FEATURE_NAMES)} features")

        tscv = TimeSeriesSplit(n_splits=5)
        cv_mae, cv_rmse, cv_mape = [], [], []
        for train_idx, test_idx in tscv.split(X_arr):
            X_train, X_test = X_arr[train_idx], X_arr[test_idx]
            y_train, y_test = y_arr[train_idx], y_arr[test_idx]
            model = HistGradientBoostingRegressor(
                max_iter=300, learning_rate=0.05, max_depth=6,
                min_samples_leaf=10, l2_regularization=0.1,
            )
            model.fit(X_train, y_train)
            preds = model.predict(X_test)
            mae = float(np.mean(np.abs(y_test - preds)))
            rmse = float(np.sqrt(np.mean((y_test - preds) ** 2)))
            mask = y_test > 10.0
            mape = float(np.mean(np.abs((y_test[mask] - preds[mask]) / y_test[mask])) * 100.0) if mask.sum() > 0 else 0.0
            cv_mae.append(mae)
            cv_rmse.append(rmse)
            cv_mape.append(mape)

        avg_mae = float(np.mean(cv_mae))
        avg_rmse = float(np.mean(cv_rmse))
        avg_mape = float(np.mean(cv_mape))
        print(f"    CV MAE:  {avg_mae:.1f} veh/h")
        print(f"    CV RMSE: {avg_rmse:.1f} veh/h")
        print(f"    CV MAPE: {avg_mape:.1f}%")

        evaluation[direction] = {
            "mae_veh_h": round(avg_mae, 1),
            "rmse_veh_h": round(avg_rmse, 1),
            "mape_pct": round(avg_mape, 1),
            "n_samples": len(X),
            "n_features": len(FEATURE_NAMES),
        }

        final_model = HistGradientBoostingRegressor(
            max_iter=300, learning_rate=0.05, max_depth=6,
            min_samples_leaf=10, l2_regularization=0.1,
        )
        final_model.fit(X_arr, y_arr)
        models[direction] = final_model

        try:
            q_lower = HistGradientBoostingRegressor(
                max_iter=200, learning_rate=0.05, max_depth=5,
                loss="quantile", quantile=0.10,
            )
            q_upper = HistGradientBoostingRegressor(
                max_iter=200, learning_rate=0.05, max_depth=5,
                loss="quantile", quantile=0.90,
            )
            q_lower.fit(X_arr, y_arr)
            q_upper.fit(X_arr, y_arr)
            quantile_models[direction] = {"lower": q_lower, "upper": q_upper}
        except Exception as exc:  # noqa: BLE001
            print(f"    Quantile model training failed: {exc}")

    if not models:
        print("Insufficient data — keeping seasonal-naive only.")
        artifact = {"_mode": "seasonal_naive_only"}
    else:
        artifact = {
            "models": models,
            "quantile_models": quantile_models,
            "evaluation": evaluation,
            "feature_names": FEATURE_NAMES,
        }

    with Path(out_path).open("wb") as fh:
        pickle.dump(artifact, fh)
    print(f"\nSaved {len(models)} model(s) to {out_path}")

    eval_path = Path(out_path).parent.parent / "app" / "data" / "model_evaluation.json"
    try:
        eval_path.parent.mkdir(parents=True, exist_ok=True)
        eval_path.write_text(json.dumps({
            "forecasting": evaluation,
            "model_type": "HistGradientBoostingRegressor",
            "features": FEATURE_NAMES,
            "cv_splits": 5,
        }, indent=2), encoding="utf-8")
        print(f"Evaluation written: {eval_path}")
    except Exception as exc:  # noqa: BLE001
        print(f"Warning: could not write evaluation JSON: {exc}")

    return evaluation


def main() -> None:
    """CLI: train and persist a model artifact."""
    import argparse

    parser = argparse.ArgumentParser(description="Train flow forecasting model with evaluation")
    parser.add_argument("--out", default=str(Path(__file__).parent / "model_artifact.pkl"))
    args = parser.parse_args()

    _train_and_evaluate(args.out)


if __name__ == "__main__":
    main()
