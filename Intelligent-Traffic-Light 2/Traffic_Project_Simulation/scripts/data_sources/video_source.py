"""Video (YOLO live stream) data source.

Connects to the LiveVideoStreamProcessor (see scripts/live_video/stream_processor.py)
and converts its per-approach vehicle counts and stop ratios into the standard snapshot
schema. Used either standalone or fused with Google in CompositeDataSource.
"""

from __future__ import annotations

import logging
from typing import Any

from live_support import now_iso

from .base import CONGESTION_DEFAULT, DataSource, SnapshotPayload

logger = logging.getLogger("its.data_sources.video")


class VideoDataSource(DataSource):
    name = "video_yolo"

    def __init__(self, processor: Any | None = None, free_flow_kmh: float = 35.0) -> None:
        self.processor = processor
        self.free_flow_kmh = free_flow_kmh

    def attach(self, processor: Any) -> None:
        """Bind a running LiveVideoStreamProcessor instance."""
        self.processor = processor

    def is_healthy(self) -> bool:
        if self.processor is None:
            return False
        try:
            return bool(self.processor.is_running())
        except Exception:  # noqa: BLE001
            return False

    def fetch_snapshot(
        self,
        center: dict[str, float],
        probe_distance_meters: dict[str, float] | None = None,
    ) -> SnapshotPayload:
        approaches: dict[str, dict[str, Any]] = {}
        if self.processor is None or not self.is_healthy():
            for direction in ("northbound", "southbound", "eastbound", "westbound"):
                approaches[direction] = {**CONGESTION_DEFAULT}
            return SnapshotPayload(
                timestamp=now_iso(),
                source=self.name,
                center=center,
                approaches=approaches,
                error="Live video processor not available.",
            )

        stats = self.processor.get_per_direction_stats()
        for direction in ("northbound", "southbound", "eastbound", "westbound"):
            stat = stats.get(direction, {})
            vehicle_count = int(stat.get("vehicle_count", 0))
            stop_ratio = float(stat.get("stopped_ratio", 0.0))
            normal_share = max(0.0, 1.0 - stop_ratio)
            avg_speed = self.free_flow_kmh * normal_share
            speed_ratio = max(0.05, normal_share)
            congestion = (
                "free" if speed_ratio >= 0.85 else
                "light" if speed_ratio >= 0.65 else
                "moderate" if speed_ratio >= 0.45 else
                "heavy" if speed_ratio >= 0.25 else "severe"
            )
            approaches[direction] = {
                **CONGESTION_DEFAULT,
                "speed_ratio": round(speed_ratio, 2),
                "avg_speed_kmh": round(avg_speed, 1),
                "free_flow_speed_kmh": round(self.free_flow_kmh, 1),
                "delay_s": round((1.0 - speed_ratio) * 60.0, 1),
                "delay_ratio": round(1.0 - speed_ratio, 2),
                "congestion_level": congestion,
                "normal_share": round(normal_share, 2),
                "slow_share": round(stop_ratio * 0.5, 2),
                "jam_share": round(stop_ratio * 0.5, 2),
                "vehicle_count": vehicle_count,
                "stopped_ratio": round(stop_ratio, 2),
            }
        return SnapshotPayload(
            timestamp=now_iso(),
            source=self.name,
            center=center,
            approaches=approaches,
            metadata={"video_processor": self.processor.describe() if hasattr(self.processor, "describe") else {}},
        )
