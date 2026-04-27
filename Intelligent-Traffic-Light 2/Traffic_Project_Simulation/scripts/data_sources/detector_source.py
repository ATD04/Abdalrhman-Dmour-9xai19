"""Detector data source — uses historical CSVs (and prepares for live detector feed)."""

from __future__ import annotations

import logging
from typing import Any

from live_support import (
    DetectorCalibrator,
    build_detector_fallback_snapshot,
    now_iso,
)

from .base import CONGESTION_DEFAULT, DataSource, SnapshotPayload

logger = logging.getLogger("its.data_sources.detector")


class DetectorDataSource(DataSource):
    name = "detector_data"

    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config
        self._calibrator: DetectorCalibrator | None = None
        try:
            self._calibrator = DetectorCalibrator()
            logger.info("Detector calibrator loaded from sandbox CSVs")
        except Exception as exc:  # noqa: BLE001
            logger.warning("DetectorCalibrator init failed: %s", exc)

    def is_healthy(self) -> bool:
        return self._calibrator is not None

    def fetch_snapshot(
        self,
        center: dict[str, float],
        probe_distance_meters: dict[str, float] | None = None,
    ) -> SnapshotPayload:
        if self._calibrator is None:
            return SnapshotPayload(
                timestamp=now_iso(),
                source=self.name,
                center=center,
                approaches={},
                error="DetectorCalibrator unavailable; no historical CSVs found.",
            )
        try:
            raw = build_detector_fallback_snapshot(self.config, center, self._calibrator)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Detector snapshot build failed: %s", exc)
            return SnapshotPayload(
                timestamp=now_iso(),
                source=self.name,
                center=center,
                approaches={},
                error=f"Detector snapshot failed: {exc}",
            )
        # Mark the source explicitly even if helper changes its identifier later.
        raw["source"] = self.name
        # Defensive defaults — consumers expect every direction to be present.
        approaches = raw.get("approaches", {})
        for direction in ("northbound", "southbound", "eastbound", "westbound"):
            approaches.setdefault(direction, {**CONGESTION_DEFAULT})
        raw["approaches"] = approaches
        return SnapshotPayload.from_dict(raw)
