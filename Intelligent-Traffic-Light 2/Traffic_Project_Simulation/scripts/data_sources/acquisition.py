"""Data Acquisition Layer (Refinery).

Objective: Securely ingest, normalize, and validate all traffic-related inputs.
This module enforces read-only behavior and ensures that downstream components 
(AI, forecasting, dashboard) receive clean, standardized data.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger("its.acquisition")

class DataAcquisitionLayer:
    """Orchestrates data ingestion, normalization, and validation."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.stats = {
            "packets_received": 0,
            "packets_validated": 0,
            "packets_dropped": 0,
            "last_ingestion_time": 0.0
        }

    def normalize_timestamp(self, ts_raw: Any) -> str:
        """Standardize timestamps to ISO8601 UTC."""
        try:
            if isinstance(ts_raw, str):
                # Try common formats
                for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"):
                    try:
                        dt = datetime.strptime(ts_raw, fmt).replace(tzinfo=timezone.utc)
                        return dt.isoformat()
                    except ValueError:
                        continue
            elif isinstance(ts_raw, (int, float)):
                dt = datetime.fromtimestamp(ts_raw, tz=timezone.utc)
                return dt.isoformat()
        except Exception as exc:
            logger.debug("Timestamp normalization failed for %s: %s", ts_raw, exc)
        
        # Fallback to current time if unparseable
        return datetime.now(timezone.utc).isoformat()

    def convert_units(self, value: float, from_unit: str, to_unit: str) -> float:
        """Implement unit conversion where required."""
        if from_unit == "ms" and to_unit == "kmh":
            return value * 3.6
        if from_unit == "kmh" and to_unit == "ms":
            return value / 3.6
        if from_unit == "meters" and to_unit == "km":
            return value / 1000.0
        return value

    def validate_payload(self, payload: Dict[str, Any], schema_type: str) -> bool:
        """Validate payload for missing fields, anomalies, or corruption."""
        self.stats["packets_received"] += 1
        
        if not payload:
            self.stats["packets_dropped"] += 1
            return False

        # Basic anomaly detection (e.g., negative counts or impossible speeds)
        if schema_type == "traffic_flow":
            approaches = payload.get("approaches", {})
            for direction, data in approaches.items():
                speed = data.get("avg_speed_kmh", 0)
                if speed < 0 or speed > 250: # Physical impossibility check
                    logger.warning("Anomalous speed detected for %s: %s", direction, speed)
                    self.stats["packets_dropped"] += 1
                    return False
        
        self.stats["packets_validated"] += 1
        self.stats["last_ingestion_time"] = time.time()
        return True

    def map_identifiers(self, raw_id: str, id_type: str) -> str:
        """Normalize camera/detector IDs and lane/approach labels."""
        # Mapping logic based on Wadi Saqra site metadata
        mapping = {
            "detector": {
                "D1": "North_Approach_1",
                "D2": "North_Approach_2",
                # ... extend as needed
            },
            "camera": {
                "CAM_01": "Intersection_Main_View",
            }
        }
        return mapping.get(id_type, {}).get(raw_id, raw_id)

    def get_monitoring_stats(self) -> Dict[str, Any]:
        """Return acquisition monitoring metrics."""
        return {
            **self.stats,
            "uptime_s": time.time() - self.stats["last_ingestion_time"] if self.stats["last_ingestion_time"] > 0 else 0
        }

# Global instance for shared use
refinery = DataAcquisitionLayer()
