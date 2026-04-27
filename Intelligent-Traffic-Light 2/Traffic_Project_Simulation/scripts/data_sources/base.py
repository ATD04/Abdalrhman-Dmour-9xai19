"""Base interface every traffic data source must implement."""

from __future__ import annotations

import abc
import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger("its.data_sources")

# Required keys in each direction's snapshot — keep in sync with downstream consumers.
SNAPSHOT_DIRECTION_KEYS: tuple[str, ...] = (
    "speed_ratio",
    "avg_speed_kmh",
    "free_flow_speed_kmh",
    "delay_s",
    "delay_ratio",
    "duration_s",
    "static_duration_s",
    "congestion_level",
    "polyline",
    "traffic_segments",
    "normal_share",
    "slow_share",
    "jam_share",
)

CONGESTION_DEFAULT = {
    "speed_ratio": 0.85,
    "avg_speed_kmh": 30.0,
    "free_flow_speed_kmh": 35.0,
    "delay_s": 0.0,
    "delay_ratio": 0.0,
    "duration_s": 0.0,
    "static_duration_s": 0.0,
    "congestion_level": "free",
    "polyline": [],
    "traffic_segments": [],
    "normal_share": 0.85,
    "slow_share": 0.10,
    "jam_share": 0.05,
}


@dataclass
class SnapshotPayload:
    """Standardised snapshot returned by every DataSource.

    `approaches` keys match DIRECTIONS (northbound / southbound / eastbound / westbound).
    `source` is a short identifier that tells downstream code which provider produced
    the data (used for badges and provenance).
    """

    timestamp: str
    source: str
    center: dict[str, float]
    approaches: dict[str, dict[str, Any]]
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        payload = {
            "timestamp": self.timestamp,
            "source": self.source,
            "center": self.center,
            "approaches": self.approaches,
        }
        if self.error:
            payload["error"] = self.error
        if self.metadata:
            payload["metadata"] = self.metadata
        return payload

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "SnapshotPayload":
        return cls(
            timestamp=raw.get("timestamp", ""),
            source=raw.get("source", "unknown"),
            center=raw.get("center", {}),
            approaches=raw.get("approaches", {}),
            error=raw.get("error"),
            metadata=raw.get("metadata", {}),
        )


class DataSource(abc.ABC):
    """Abstract interface every concrete data source implements."""

    name: str = "base"

    @abc.abstractmethod
    def fetch_snapshot(
        self,
        center: dict[str, float],
        probe_distance_meters: dict[str, float] | None = None,
    ) -> SnapshotPayload:
        """Return a fresh snapshot. Raises on transient errors so the engine can fall back."""

    def is_healthy(self) -> bool:
        """Return True if the source is currently usable."""
        return True

    def describe(self) -> dict[str, Any]:
        """Return diagnostic information shown in the dashboard's About panel."""
        return {"name": self.name, "healthy": self.is_healthy()}
