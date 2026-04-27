"""Composite data source — primary + fallback chain + optional weighted fusion.

The composite first tries the primary source. On failure, it walks the fallback chain
in order. If `fusion_enabled` is true and at least two healthy sources are available,
their snapshots are merged using `fusion_weights` for the speed/delay metrics. Polylines
are taken from the highest-priority source that has them.
"""

from __future__ import annotations

import logging
from typing import Any

from live_support import now_iso

from .base import CONGESTION_DEFAULT, DataSource, SnapshotPayload

logger = logging.getLogger("its.data_sources.composite")

_DIRECTIONS = ("northbound", "southbound", "eastbound", "westbound")


class CompositeDataSource(DataSource):
    name = "composite"

    def __init__(
        self,
        primary: DataSource,
        fallbacks: list[DataSource] | None = None,
        *,
        fusion_enabled: bool = False,
        fusion_weights: dict[str, float] | None = None,
    ) -> None:
        self.primary = primary
        self.fallbacks = fallbacks or []
        self.fusion_enabled = fusion_enabled
        self.fusion_weights = fusion_weights or {}
        self._last_good_snapshot: SnapshotPayload | None = None

    def is_healthy(self) -> bool:
        return self.primary.is_healthy() or any(s.is_healthy() for s in self.fallbacks)

    def _try_fetch(self, source: DataSource, center, probes) -> SnapshotPayload | None:
        try:
            snap = source.fetch_snapshot(center, probes)
            if snap.approaches:
                return snap
        except Exception as exc:  # noqa: BLE001
            logger.warning("Source %s failed: %s", source.name, exc)
        return None

    def fetch_snapshot(
        self,
        center: dict[str, float],
        probe_distance_meters: dict[str, float] | None = None,
    ) -> SnapshotPayload:
        # Collect snapshots from sources for fusion / fallback decisions.
        snapshots: list[SnapshotPayload] = []
        primary_snapshot = self._try_fetch(self.primary, center, probe_distance_meters)
        if primary_snapshot:
            snapshots.append(primary_snapshot)

        for source in self.fallbacks:
            snap = self._try_fetch(source, center, probe_distance_meters)
            if snap:
                snapshots.append(snap)
                if not self.fusion_enabled:
                    break  # only need the first healthy fallback

        if not snapshots:
            # No source is producing fresh data — try to reuse last known good
            if self._last_good_snapshot is not None:
                stale = SnapshotPayload(
                    timestamp=now_iso(),
                    source=f"{self._last_good_snapshot.source}_stale",
                    center=center,
                    approaches=self._last_good_snapshot.approaches,
                    error="All sources failed; reusing last known snapshot.",
                )
                return stale
            return self._neutral_snapshot(center, "No data source available.")

        chosen = snapshots[0]
        if self.fusion_enabled and len(snapshots) > 1:
            chosen = self._fuse(snapshots, center)

        # Phase 3: Data Acquisition Layer (Refinery) Integration
        try:
            from .acquisition import refinery
            processed = refinery.process_snapshot(chosen)
            self._last_good_snapshot = processed
            return processed
        except (ImportError, Exception):
            self._last_good_snapshot = chosen
            return chosen

    # ── Fusion ────────────────────────────────────────────────
    def _fuse(self, snapshots: list[SnapshotPayload], center: dict[str, float]) -> SnapshotPayload:
        approaches: dict[str, dict[str, Any]] = {}
        for direction in _DIRECTIONS:
            total_weight = 0.0
            weighted_speed = 0.0
            weighted_delay = 0.0
            free_flow = 0.0
            polyline = []
            traffic_segments = []
            congestion_levels: list[tuple[float, str]] = []

            for snap in snapshots:
                approach = snap.approaches.get(direction)
                if not approach:
                    continue
                weight = float(self.fusion_weights.get(snap.source, 0.0)) or 1.0 / len(snapshots)
                total_weight += weight
                weighted_speed += float(approach.get("avg_speed_kmh", 0.0)) * weight
                weighted_delay += float(approach.get("delay_s", 0.0)) * weight
                if not free_flow:
                    free_flow = float(approach.get("free_flow_speed_kmh", 35.0))
                if not polyline:
                    polyline = approach.get("polyline", []) or []
                if not traffic_segments:
                    traffic_segments = approach.get("traffic_segments", []) or []
                congestion_levels.append((weight, approach.get("congestion_level", "free")))

            if total_weight == 0.0:
                approaches[direction] = {**CONGESTION_DEFAULT}
                continue

            avg_speed = weighted_speed / total_weight
            avg_delay = weighted_delay / total_weight
            speed_ratio = round(min(1.0, avg_speed / max(free_flow, 1.0)), 2) if free_flow else 0.85

            # Congestion level — pick the most severe category by weight
            severity_order = {"free": 0, "light": 1, "moderate": 2, "heavy": 3, "severe": 4}
            most_severe = max(
                congestion_levels,
                key=lambda pair: severity_order.get(pair[1], 0),
                default=(0.0, "free"),
            )[1]
            approaches[direction] = {
                **CONGESTION_DEFAULT,
                "avg_speed_kmh": round(avg_speed, 1),
                "free_flow_speed_kmh": round(free_flow, 1),
                "delay_s": round(avg_delay, 1),
                "speed_ratio": speed_ratio,
                "delay_ratio": round(max(0.0, 1.0 - speed_ratio), 2),
                "congestion_level": most_severe,
                "polyline": polyline,
                "traffic_segments": traffic_segments,
            }

        return SnapshotPayload(
            timestamp=now_iso(),
            source=f"fused({'+'.join(s.source for s in snapshots)})",
            center=center,
            approaches=approaches,
            metadata={"fusion_weights": self.fusion_weights, "sources": [s.source for s in snapshots]},
        )

    def _neutral_snapshot(self, center: dict[str, float], error: str) -> SnapshotPayload:
        approaches = {direction: {**CONGESTION_DEFAULT} for direction in _DIRECTIONS}
        return SnapshotPayload(
            timestamp=now_iso(),
            source="no_data",
            center=center,
            approaches=approaches,
            error=error,
        )

    def describe(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "primary": self.primary.name,
            "fallbacks": [s.name for s in self.fallbacks],
            "fusion_enabled": self.fusion_enabled,
            "fusion_weights": self.fusion_weights,
            "healthy": self.is_healthy(),
        }
