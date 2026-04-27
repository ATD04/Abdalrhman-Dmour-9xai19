"""Google Routes API data source — wraps the existing GoogleTrafficFetcher."""

from __future__ import annotations

import logging
from typing import Any

from live_support import GoogleTrafficFetcher

from .base import DataSource, SnapshotPayload

logger = logging.getLogger("its.data_sources.google")


class GoogleDataSource(DataSource):
    name = "google_routes"

    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config
        self.fetcher: GoogleTrafficFetcher | None = None
        try:
            sa_path = config["paths"].get("google_service_account")
            if sa_path and sa_path.exists():
                self.fetcher = GoogleTrafficFetcher(config)
                logger.info("Google Routes data source initialized")
        except Exception as exc:  # noqa: BLE001
            logger.warning("Google Routes init failed: %s", exc)
            self.fetcher = None

    def is_healthy(self) -> bool:
        return self.fetcher is not None

    def fetch_snapshot(
        self,
        center: dict[str, float],
        probe_distance_meters: dict[str, float] | None = None,
    ) -> SnapshotPayload:
        if self.fetcher is None:
            raise RuntimeError("Google Routes service-account is not configured.")
        probes = probe_distance_meters or self.config["google"]["probe_distance_meters"]
        raw = self.fetcher.fetch_snapshot(center, probes)
        return SnapshotPayload.from_dict(raw)

    def describe(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "healthy": self.is_healthy(),
            "service_account_configured": self.fetcher is not None,
        }
