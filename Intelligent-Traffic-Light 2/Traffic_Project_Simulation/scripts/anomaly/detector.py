"""Anomaly detection over the per-direction live state.

Two operating modes:
  * `iforest` — uses an Isolation Forest trained on baseline detector data
    (Traffic_Data_Sandbox/detector_data/*.csv). Triggered when scikit-learn is
    available and a model artifact has been generated.
  * `statistical` — robust z-score over the rolling window (Median Absolute Deviation).
    Always available, no dependencies beyond stdlib.

Each call to `score()` returns a per-direction dict with `score ∈ [0,1]`, an `is_anomaly`
flag, and a short human-readable reason.
"""

from __future__ import annotations

import csv
import logging
import math
import pickle
from collections import defaultdict, deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Deque

logger = logging.getLogger("its.anomaly")

DIRECTIONS = ("northbound", "southbound", "eastbound", "westbound")

DETECTOR_DIR = Path(__file__).resolve().parents[2].parent / "Traffic_Data_Sandbox" / "detector_data"


@dataclass
class AnomalyResult:
    direction: str
    score: float
    is_anomaly: bool
    reason: str
    metric_snapshot: dict[str, float]


class AnomalyDetector:
    def __init__(
        self,
        models: dict[str, Any] | None = None,
        threshold: float = 0.65,
        window_size: int = 60,
    ) -> None:
        self.models = models or {}
        self.threshold = threshold
        self.window_size = window_size
        self.history: dict[str, Deque[dict[str, float]]] = {
            d: deque(maxlen=window_size) for d in DIRECTIONS
        }

    @classmethod
    def load_or_default(cls, config: dict[str, Any]) -> "AnomalyDetector":
        block = config.get("anomaly", {})
        threshold = float(block.get("anomaly_threshold", 0.65))
        models: dict[str, Any] | None = None
        artifact = block.get("model_path")
        if artifact:
            artifact_path = Path(artifact)
            if not artifact_path.is_absolute():
                # Resolve relative to project root (Traffic_Project_Simulation/)
                artifact_path = (Path(__file__).resolve().parents[2] / artifact).resolve()
            if artifact_path.exists():
                try:
                    with artifact_path.open("rb") as fh:
                        models = pickle.load(fh)
                    logger.info("Anomaly detector models loaded from %s", artifact_path)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Anomaly artifact load failed: %s", exc)
        return cls(models=models, threshold=threshold)

    # ── Inference ─────────────────────────────────────────────
    def score(self, live_state: dict[str, Any]) -> dict[str, Any]:
        metrics = live_state.get("metrics", {}) or {}
        google_snapshot = live_state.get("google_snapshot", {}) or {}
        results: dict[str, AnomalyResult] = {}
        feature_vectors: dict[str, list[float]] = {}

        for direction in DIRECTIONS:
            metric = metrics.get(direction, {})
            google = google_snapshot.get(direction, {})
            features = [
                float(metric.get("queue_vehicles", 0)),
                float(metric.get("queue_m", 0.0)),
                float(metric.get("avg_speed_kmh", 0.0)),
                float(metric.get("flow_veh_h", 0.0)),
                float(metric.get("density", 0.0)),
                float(google.get("delay_s", 0.0)),
                float(google.get("speed_ratio", 1.0)),
            ]
            feature_vectors[direction] = features
            sample = {
                "queue_vehicles": features[0],
                "queue_m": features[1],
                "speed": features[2],
                "flow": features[3],
                "google_delay": features[5],
            }
            self.history[direction].append(sample)

        # Try ML scoring first; fall back to statistical scoring
        ml_results = self._score_ml(feature_vectors)
        for direction in DIRECTIONS:
            if ml_results and direction in ml_results:
                results[direction] = ml_results[direction]
            else:
                results[direction] = self._score_statistical(direction, feature_vectors[direction])

        anomalies = [r for r in results.values() if r.is_anomaly]
        return {
            "any_anomaly": bool(anomalies),
            "directions": {
                d: {
                    "score": round(r.score, 3),
                    "is_anomaly": r.is_anomaly,
                    "reason": r.reason,
                    "metrics": r.metric_snapshot,
                }
                for d, r in results.items()
            },
            "summary": (
                f"{len(anomalies)} anomalous direction(s) detected"
                if anomalies else
                "Network state within normal bounds"
            ),
            "mode": "iforest" if self.models else "statistical",
        }

    # ── ML scoring ────────────────────────────────────────────
    def _score_ml(self, feature_vectors: dict[str, list[float]]) -> dict[str, AnomalyResult] | None:
        if not self.models or "_mode" in self.models:
            return None
        try:
            import numpy as np  # type: ignore
        except ImportError:
            return None
        out: dict[str, AnomalyResult] = {}
        for direction, vector in feature_vectors.items():
            model = self.models.get(direction)
            if model is None:
                continue
            try:
                arr = np.array(vector).reshape(1, -1)
                # Isolation Forest decision_function: higher = more normal
                # Map to [0,1] anomaly score (1 = anomalous)
                decision = float(model.decision_function(arr)[0])
                score = 1.0 / (1.0 + math.exp(decision * 5.0))  # squash via sigmoid
                is_anom = score >= self.threshold
                reason = "Isolation Forest detected outlier feature combination" if is_anom else "Within learned normal envelope"
                out[direction] = AnomalyResult(
                    direction=direction,
                    score=score,
                    is_anomaly=is_anom,
                    reason=reason,
                    metric_snapshot={
                        "queue_vehicles": vector[0],
                        "queue_m": vector[1],
                        "avg_speed_kmh": vector[2],
                    },
                )
            except Exception as exc:  # noqa: BLE001
                logger.debug("ML scoring failed for %s: %s", direction, exc)
        return out or None

    # ── Statistical scoring ───────────────────────────────────
    def _score_statistical(self, direction: str, vector: list[float]) -> AnomalyResult:
        history = self.history[direction]
        if len(history) < 8:
            return AnomalyResult(
                direction=direction,
                score=0.0,
                is_anomaly=False,
                reason="Warming up — need more history for confident scoring.",
                metric_snapshot={"queue_vehicles": vector[0], "queue_m": vector[1], "avg_speed_kmh": vector[2]},
            )
        queue_vals = [h["queue_vehicles"] for h in history]
        # Only include speed samples where vehicles were actually present (speed > 2 km/h)
        speed_vals = [h["speed"] for h in history if h["speed"] > 2.0]
        queue_med = _median(queue_vals)
        queue_mad = _mad(queue_vals, queue_med) or 1.0

        cur_queue = vector[0]
        cur_speed = vector[2]
        z_queue = abs(cur_queue - queue_med) / max(queue_mad, 1.0)

        # Only score speed anomaly if we have meaningful history and current traffic
        z_speed = 0.0
        if len(speed_vals) >= 6 and cur_speed > 2.0:
            speed_med = _median(speed_vals)
            speed_mad = _mad(speed_vals, speed_med) or 1.0
            z_speed = abs(cur_speed - speed_med) / max(speed_mad, 1.0)
        else:
            speed_med = 0.0

        score = min(1.0, max(z_queue, z_speed) / 6.0)
        is_anom = score >= self.threshold
        reason = "Within bounds"
        if is_anom:
            if z_queue > z_speed:
                reason = f"Queue length deviated {z_queue:.1f}σ from rolling median ({cur_queue:.0f} vs {queue_med:.0f})."
            else:
                reason = f"Speed dropped {z_speed:.1f}σ below rolling median ({cur_speed:.1f} vs {speed_med:.1f} km/h)."
        return AnomalyResult(
            direction=direction,
            score=score,
            is_anomaly=is_anom,
            reason=reason,
            metric_snapshot={
                "queue_vehicles": cur_queue,
                "queue_m": vector[1],
                "avg_speed_kmh": cur_speed,
            },
        )


def _median(values: list[float]) -> float:
    ordered = sorted(values)
    n = len(ordered)
    if n == 0:
        return 0.0
    if n % 2 == 1:
        return ordered[n // 2]
    return 0.5 * (ordered[n // 2 - 1] + ordered[n // 2])


def _mad(values: list[float], med: float) -> float:
    deviations = sorted(abs(v - med) for v in values)
    n = len(deviations)
    if n == 0:
        return 0.0
    if n % 2 == 1:
        return deviations[n // 2]
    return 0.5 * (deviations[n // 2 - 1] + deviations[n // 2])


# ── Training CLI ─────────────────────────────────────────────
def _train(args: Any) -> None:
    try:
        from sklearn.ensemble import IsolationForest  # type: ignore
        import numpy as np  # type: ignore
    except ImportError:
        print("scikit-learn / numpy not installed — saving statistical-only artifact.")
        with Path(args.out).open("wb") as fh:
            pickle.dump({"_mode": "statistical_only"}, fh)
        return

    if not DETECTOR_DIR.exists():
        print(f"Detector directory not found: {DETECTOR_DIR}")
        return
    direction_data: dict[str, list[list[float]]] = {d: [] for d in DIRECTIONS}
    per_ts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for csv_path in sorted(DETECTOR_DIR.glob("detector_*.csv")):
        with csv_path.open("r", encoding="utf-8", newline="") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                approach_id = str(int(row["approach_id"]))
                try:
                    count = int(row["vehicle_count"])
                except (KeyError, ValueError):
                    continue
                ts = row["timestamp"]
                for direction, approaches in {
                    "northbound": ["1", "2", "3"],
                    "southbound": ["4", "5", "6"],
                    "eastbound": ["7", "8", "9"],
                    "westbound": ["10", "11", "12", "13", "14"],
                }.items():
                    if approach_id in approaches:
                        per_ts[ts][direction] += count
    for ts, dir_map in per_ts.items():
        for direction, count in dir_map.items():
            # Synthetic features: count, queue proxy, speed proxy, flow, density, delay, speed_ratio
            queue_vehicles = count // 10
            queue_m = queue_vehicles * 7.5
            avg_speed = max(5.0, 35.0 - queue_vehicles * 0.4)
            flow = count * 4.0
            density = min(1.0, queue_vehicles / 30.0)
            delay = max(0.0, count * 0.05)
            speed_ratio = max(0.05, 1.0 - density)
            direction_data[direction].append([
                float(queue_vehicles), float(queue_m), float(avg_speed),
                float(flow), float(density), float(delay), float(speed_ratio)
            ])

    models: dict[str, Any] = {}
    for direction, X in direction_data.items():
        if len(X) < 32:
            continue
        clf = IsolationForest(n_estimators=120, contamination=0.06, random_state=42)
        clf.fit(np.array(X))
        models[direction] = clf
    if not models:
        models = {"_mode": "statistical_only"}
    with Path(args.out).open("wb") as fh:
        pickle.dump(models, fh)
    print(f"Saved anomaly model artifact: {args.out}")


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(Path(__file__).parent / "model_artifact.pkl"))
    args = parser.parse_args()
    _train(args)


if __name__ == "__main__":
    main()
