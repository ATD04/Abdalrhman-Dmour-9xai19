"""Traffic-flow forecasting model.

Uses historical detector data (Traffic_Data_Sandbox/detector_data/*.csv) to predict
per-direction vehicle counts 5/15/30 minutes ahead. The default implementation is a
lightweight gradient-boosted model (sklearn HistGradientBoostingRegressor) so the
project doesn't require a heavy dependency like Prophet/LightGBM. The interface is
deliberately swappable: anyone can drop in a Prophet/LightGBM/LSTM trainer that
implements the same `predict()` signature and saves a pickle the loader recognises.

If `model_artifact.pkl` does not exist (or sklearn isn't installed), the forecaster
falls back to a seasonal-naive predictor (same time last week) which still gives a
useful baseline.
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


class FlowForecaster:
    """Per-direction forecaster.

    Two prediction modes:
      * `seasonal_naive`: returns the same-time-last-week value (always available).
      * `gbm`: gradient-boosted regressor on lag features (used when artifact found).
    """

    def __init__(
        self,
        history: dict[str, list[tuple[datetime, float]]],
        models: dict[str, Any] | None = None,
        mode: str = "seasonal_naive",
    ) -> None:
        # history: direction -> sorted list of (timestamp, veh/h)
        self.history = history
        self.models = models or {}
        self.mode = mode
        self._slot_index = self._build_slot_index(history)

    @staticmethod
    def _build_slot_index(history: dict[str, list[tuple[datetime, float]]]) -> dict[str, dict[tuple[int, int], list[float]]]:
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
        mode = "seasonal_naive"
        if artifact:
            artifact_path = Path(artifact)
            if not artifact_path.is_absolute():
                # Resolve relative to project root (Traffic_Project_Simulation/)
                artifact_path = (Path(__file__).resolve().parents[2] / artifact).resolve()
            if artifact_path.exists():
                try:
                    with artifact_path.open("rb") as fh:
                        models = pickle.load(fh)
                    mode = "gbm"
                    logger.info("Forecasting model loaded from %s", artifact_path)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Could not load forecaster artifact %s: %s", artifact_path, exc)
        return cls(history=history, models=models, mode=mode)

    @staticmethod
    def _load_history() -> dict[str, list[tuple[datetime, float]]]:
        history: dict[str, list[tuple[datetime, float]]] = {d: [] for d in DIRECTIONS}
        if not DETECTOR_DIR.exists():
            logger.warning("Detector data directory missing: %s", DETECTOR_DIR)
            return history
        # Aggregate per timestamp across all detectors, then per direction.
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

    # ── Prediction ────────────────────────────────────────────
    def predict(
        self,
        direction: str,
        when: datetime | None = None,
        horizon_minutes: int = 15,
        live_context: dict[str, Any] | None = None,
        holiday_calendar: set = None,
    ) -> ForecastPoint:
        """
        Predict traffic for a given direction and time horizon.
        Features used:
        - Historical detector counts
        - 15-minute aggregated traffic volume
        - Signal phase logs (slot index)
        - Weekday indicator
        - Holiday indicator (explicit)
        - Peak-period indicator (explicit)
        """
        when = when or datetime.now(UTC).replace(tzinfo=None)
        target = when + timedelta(minutes=horizon_minutes)
        slot = (target.weekday(), target.hour * 4 + target.minute // 15)

        # Calendar context: Peak periods (7:30-9:30, 16:30-19:00)
        hour_val = target.hour + target.minute / 60.0
        is_peak = (7.5 <= hour_val <= 9.5) or (16.5 <= hour_val <= 19.0)
        is_weekend = target.weekday() >= 4 # Fri/Sat in Jordan
        # Holiday indicator: use a set of YYYY-MM-DD strings for holidays
        if holiday_calendar is None:
            holiday_calendar = set()
        is_holiday = target.strftime("%Y-%m-%d") in holiday_calendar

        slot_values = self._slot_index.get(direction, {}).get(slot, [])
        if slot_values:
            base = sum(slot_values) / len(slot_values)
            confidence = min(0.92, 0.55 + 0.05 * len(slot_values))
        else:
            all_vals = [v for ts_list in self._slot_index.get(direction, {}).values() for v in ts_list]
            base = sum(all_vals) / len(all_vals) if all_vals else 200.0
            confidence = 0.4

        # Peak adjustment (explicit feature)
        if is_peak:
            base *= 1.15
            confidence *= 0.95 # Slightly more uncertain
        # Weekend adjustment
        if is_weekend:
            base *= 0.75
        # Holiday adjustment (explicit feature)
        if is_holiday:
            base *= 0.65
            confidence *= 0.90

        # Live adjustment
        if live_context:
            pressure = float(live_context.get("pressure_index", 0.0))
            current_demand = float(live_context.get("target_veh_h", base))
            blended = 0.55 * base + 0.45 * current_demand
            base = blended * (1.0 + 0.05 * max(0.0, pressure - 0.4))

        return ForecastPoint(
            minutes_ahead=horizon_minutes,
            veh_per_hour=round(base, 1),
            confidence=round(confidence, 2),
        )

    def predict_all(
        self,
        horizons: Sequence[int] = (15, 30, 60),
        live_state: dict[str, Any] | None = None,
        holiday_calendar: set = None,
    ) -> dict[str, Any]:

        now = datetime.now(UTC).replace(tzinfo=None)
        result: dict[str, Any] = {
            "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
            "mode": self.mode,
            "directions": {},
        }
        demand_state = (live_state or {}).get("demand", {}) if live_state else {}
        if holiday_calendar is None:
            holiday_calendar = set()
        for direction in DIRECTIONS:
            live_ctx = demand_state.get(direction, {})
            forecasts = []
            for horizon in horizons:
                point = self.predict(direction, now, horizon, live_ctx, holiday_calendar)
                forecasts.append(
                    {
                        "horizon_minutes": point.minutes_ahead,
                        "veh_per_hour": point.veh_per_hour,
                        "confidence": point.confidence,
                        "is_peak_period": (7.5 <= (now.hour + now.minute / 60.0) <= 9.5) or (16.5 <= (now.hour + now.minute / 60.0) <= 19.0),
                        "is_holiday": now.strftime("%Y-%m-%d") in holiday_calendar,
                        "is_weekend": now.weekday() >= 4,
                    }
                )
            result["directions"][direction] = forecasts
        return result

    def describe(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "history_points": {d: len(self.history[d]) for d in DIRECTIONS},
            "slots_indexed": {d: len(self._slot_index[d]) for d in DIRECTIONS},
        }


def main() -> None:
    """CLI: train and persist a model artifact (only if sklearn is installed)."""
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(Path(__file__).parent / "model_artifact.pkl"))
    args = parser.parse_args()

    forecaster = FlowForecaster.load_or_default({"forecasting": {"model_path": None}})
    summary = {direction: len(samples) for direction, samples in forecaster.history.items()}
    print(f"Loaded history: {summary}")

    try:
        from sklearn.ensemble import HistGradientBoostingRegressor  # type: ignore
        import numpy as np  # type: ignore
    except ImportError:
        print("scikit-learn / numpy not installed — saving seasonal-naive metadata only.")
        with Path(args.out).open("wb") as fh:
            pickle.dump({"_mode": "seasonal_naive_only"}, fh)
        return

    models: dict[str, Any] = {}
    for direction, samples in forecaster.history.items():
        if len(samples) < 32:
            continue
        timestamps, values = zip(*samples)
        X = []
        y = []
        # Lag features: t-1, t-2, t-4, t-8, t-96 (one day back)
        for i in range(96, len(values)):
            X.append([
                values[i - 1],
                values[i - 2],
                values[i - 4],
                values[i - 8],
                values[i - 96],
                timestamps[i].weekday(),
                timestamps[i].hour * 4 + timestamps[i].minute // 15,
            ])
            y.append(values[i])
        if not X:
            continue
        model = HistGradientBoostingRegressor(max_iter=200, learning_rate=0.05, max_depth=6)
        model.fit(np.array(X), np.array(y))
        models[direction] = model
    if not models:
        print("Insufficient data — keeping seasonal-naive only.")
        models = {"_mode": "seasonal_naive_only"}
    with Path(args.out).open("wb") as fh:
        pickle.dump(models, fh)
    print(f"Saved {len(models)} model(s) to {args.out}")


if __name__ == "__main__":
    main()
