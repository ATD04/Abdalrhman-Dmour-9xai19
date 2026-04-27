"""Factory: builds a CompositeDataSource based on the live_config 'data_sources' block.

If the block is missing, falls back to (Google with Detector fallback) — which matches
the historical behavior of the engine.
"""

from __future__ import annotations

import logging
from typing import Any

from .base import DataSource
from .composite import CompositeDataSource
from .detector_source import DetectorDataSource
from .google_source import GoogleDataSource
from .video_source import VideoDataSource

logger = logging.getLogger("its.data_sources.factory")

_NAME_TO_SOURCE = {
    "google": GoogleDataSource,
    "detector": DetectorDataSource,
    "video": VideoDataSource,
}


def _instantiate(name: str, config: dict[str, Any]) -> DataSource | None:
    if name not in _NAME_TO_SOURCE:
        logger.warning("Unknown data source '%s'", name)
        return None
    cls = _NAME_TO_SOURCE[name]
    if cls is VideoDataSource:
        # Video processor is optional and attached later via .attach()
        return VideoDataSource()
    try:
        return cls(config)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not initialize source %s: %s", name, exc)
        return None


def build_data_source(config: dict[str, Any]) -> CompositeDataSource:
    block = config.get("data_sources") or {}
    primary_name = block.get("primary", "google")
    fallback_names = block.get("fallback_chain", ["detector"])
    fusion_enabled = bool(block.get("fusion_enabled", False))
    fusion_weights = block.get("fusion_weights", {})

    primary = _instantiate(primary_name, config)
    if primary is None:
        # If primary fails, demote first fallback to primary
        for name in fallback_names:
            primary = _instantiate(name, config)
            if primary is not None:
                primary_name = name
                fallback_names = [n for n in fallback_names if n != name]
                break

    fallbacks: list[DataSource] = []
    for name in fallback_names:
        if name == primary_name:
            continue
        candidate = _instantiate(name, config)
        if candidate is not None:
            fallbacks.append(candidate)

    if primary is None:
        # Hard fallback — at least give the engine a healthy detector source
        primary = DetectorDataSource(config)

    composite = CompositeDataSource(
        primary=primary,
        fallbacks=fallbacks,
        fusion_enabled=fusion_enabled,
        fusion_weights=fusion_weights,
    )
    logger.info(
        "Composite data source ready (primary=%s, fallbacks=%s, fusion=%s)",
        primary.name,
        [s.name for s in fallbacks],
        fusion_enabled,
    )
    return composite
