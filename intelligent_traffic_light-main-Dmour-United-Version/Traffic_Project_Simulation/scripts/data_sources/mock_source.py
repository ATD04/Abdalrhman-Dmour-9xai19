"""Mock data source for testing — produces synthetic traffic snapshots without SUMO or Google.

Uses the same diurnal model as mock_live_data.py. Registered as 'mock' in the factory.
"""

from __future__ import annotations

import math
import random
from datetime import datetime, timezone
from typing import Any

from .base import CONGESTION_DEFAULT, DataSource, SnapshotPayload

_DIRECTIONS = ("northbound", "southbound", "eastbound", "westbound")
_DIR_WEIGHTS = {"northbound": 1.0, "southbound": 0.95, "eastbound": 1.05, "westbound": 1.15}
_CONGESTION_BANDS = (
    (0.88, "free"),
    (0.72, "light"),
    (0.56, "moderate"),
    (0.40, "heavy"),
    (0.00, "severe"),
)


def _congestion_label(speed_ratio: float) -> str:
    for threshold, label in _CONGESTION_BANDS:
        if speed_ratio >= threshold:
            return label
    return "severe"


class MockDataSource(DataSource):
    """Generates synthetic traffic that follows realistic diurnal patterns."""

    name = "mock"

    def __init__(self, seed: int = 7) -> None:
        self._rng = random.Random(seed)

    def is_healthy(self) -> bool:
        return True

    def fetch_snapshot(
        self,
        center: dict[str, float],
        probe_distance_meters: dict[str, float] | None = None,
    ) -> SnapshotPayload:
        now = datetime.now(timezone.utc)
        h = now.hour + now.minute / 60.0
        # Diurnal pattern: Gaussian peaks at morning (8h) and evening (17h) rush
        load = 0.4 + 0.45 * math.exp(-((h - 8) ** 2) / 6) + 0.5 * math.exp(-((h - 17) ** 2) / 4)

        approaches: dict[str, dict[str, Any]] = {}
        for direction in _DIRECTIONS:
            w = _DIR_WEIGHTS.get(direction, 1.0)
            noise = self._rng.gauss(0.0, 0.03)
            speed_ratio = max(0.18, min(1.0, 1.0 - load * w * 0.7 + noise))
            delay_s = max(0.0, (1.0 - speed_ratio) * 200.0)
            avg_speed = speed_ratio * 40.0

            approaches[direction] = {
                "origin": center,
                "destination": center,
                "distance_m": 1200,
                "duration_s": 120.0 + delay_s,
                "static_duration_s": 120.0,
                "delay_s": round(delay_s, 1),
                "delay_ratio": round(delay_s / 120.0, 3),
                "avg_speed_kmh": round(avg_speed, 1),
                "free_flow_speed_kmh": 40.0,
                "speed_ratio": round(speed_ratio, 3),
                "congestion_level": _congestion_label(speed_ratio),
                "polyline": [],
                "traffic_segments": [],
                "normal_share": round(max(0.0, speed_ratio - 0.1), 2),
                "slow_share": round(min(0.3, (1.0 - speed_ratio) * 0.6), 2),
                "jam_share": round(min(0.3, (1.0 - speed_ratio) * 0.4), 2),
            }

        return SnapshotPayload(
            timestamp=now.isoformat(timespec="seconds"),
            source="mock",
            center=center,
            approaches=approaches,
        )

    def describe(self) -> dict[str, Any]:
        return {"type": "mock", "description": "Synthetic diurnal pattern for testing"}
