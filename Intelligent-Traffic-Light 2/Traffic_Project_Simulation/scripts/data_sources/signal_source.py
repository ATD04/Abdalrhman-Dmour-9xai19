"""Signal timing log ingestion.

Reads historical signal state logs to provide context for optimization and forecasting.
"""

from __future__ import annotations

import csv
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .base import DataSource, SnapshotPayload
from live_support import now_iso, SANDBOX_ROOT

logger = logging.getLogger("its.data_sources.signal")

class SignalLogSource(DataSource):
    name = "signal_log"

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.log_path = SANDBOX_ROOT / "signal_logs" / "signal_timing_logs.csv"
        self._history: List[Dict[str, Any]] = []
        self._load()

    def _load(self):
        if not self.log_path.exists():
            logger.warning("Signal timing log missing: %s", self.log_path)
            return

        try:
            with self.log_path.open("r", encoding="utf-8") as fh:
                reader = csv.DictReader(fh)
                for row in reader:
                    self._history.append(row)
            logger.info("Loaded %d signal log entries", len(self._history))
        except Exception as exc:
            logger.error("Failed to load signal logs: %s", exc)

    def is_healthy(self) -> bool:
        return self.log_path.exists()

    def fetch_snapshot(self, center: Dict[str, float], probe_distance_meters: Optional[Dict[str, float]] = None) -> SnapshotPayload:
        # For simplicity in this build, we return the last known state from the log
        # In a live system, this would be the current operational state.
        latest = self._history[-1] if self._history else {}
        
        return SnapshotPayload(
            timestamp=now_iso(),
            source=self.name,
            center=center,
            approaches={},
            metadata={"latest_signal_state": latest}
        )

    def get_recent_logs(self, limit: int = 10) -> List[Dict[str, Any]]:
        return self._history[-limit:]
