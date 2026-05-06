"""Vehicle entry counting, utilization, and short-horizon risk analytics."""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Deque

try:
    from ..cli.zone_support import DIRECTIONS, DIRECTION_APPROACHES, zone_for_point
except ImportError:
    from cli.zone_support import DIRECTIONS, DIRECTION_APPROACHES, zone_for_point


WINDOWS_MS = {
    "1m": 60_000,
    "5m": 300_000,
    "15m": 900_000,
}


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class ZoneEntryEvent:
    timestamp_ms: int
    track_id: str
    zone_id: str
    direction: str | None
    approach_ids: tuple[str, ...]
    source: str = "video_zone_crossing"

    def to_dict(self) -> dict[str, Any]:
        return {
            "timestamp_ms": self.timestamp_ms,
            "track_id": self.track_id,
            "zone_id": self.zone_id,
            "direction": self.direction,
            "approach_ids": list(self.approach_ids),
            "source": self.source,
        }


class ZoneEntryCounter:
    """Counts object entries when tracked vehicles cross into polygon zones."""

    def __init__(self, zones: list[dict[str, Any]], cooldown_ms: int = 2_000, history_ms: int = 900_000) -> None:
        self.zones = zones
        self.cooldown_ms = cooldown_ms
        self.history_ms = history_ms
        self._track_zone: dict[str, str | None] = {}
        self._last_event_ms: dict[tuple[str, str], int] = {}
        self._events: Deque[ZoneEntryEvent] = deque()

    def ingest(self, timestamp_ms: int, detections: list[dict[str, Any]]) -> list[dict[str, Any]]:
        events: list[ZoneEntryEvent] = []
        for det in detections:
            if det.get("class_name") == "person":
                continue
            track_id = str(det.get("track_id") or "")
            center = det.get("center_norm") or {}
            if not track_id or center.get("x") is None or center.get("y") is None:
                continue
            zone = zone_for_point(float(center["x"]), float(center["y"]), self.zones)
            zone_id = zone.get("zone_id") if zone else None
            previous_zone_id = self._track_zone.get(track_id)
            if zone and zone_id != previous_zone_id and zone.get("count_on_entry", True):
                last_key = (track_id, str(zone_id))
                last_ts = self._last_event_ms.get(last_key, -10**12)
                if timestamp_ms - last_ts >= self.cooldown_ms:
                    event = ZoneEntryEvent(
                        timestamp_ms=timestamp_ms,
                        track_id=track_id,
                        zone_id=str(zone_id),
                        direction=zone.get("direction"),
                        approach_ids=tuple(str(item) for item in zone.get("approach_ids", [])),
                    )
                    events.append(event)
                    self._events.append(event)
                    self._last_event_ms[last_key] = timestamp_ms
            self._track_zone[track_id] = str(zone_id) if zone_id else None
        self._evict(timestamp_ms)
        return [event.to_dict() for event in events]

    def rolling_counts(self, now_ms: int) -> dict[str, Any]:
        self._evict(now_ms)
        by_direction = {direction: {name: 0 for name in WINDOWS_MS} for direction in DIRECTIONS}
        by_approach = {
            approach_id: {name: 0 for name in WINDOWS_MS}
            for approaches in DIRECTION_APPROACHES.values()
            for approach_id in approaches
        }
        for event in self._events:
            age = now_ms - event.timestamp_ms
            for name, window_ms in WINDOWS_MS.items():
                if age > window_ms:
                    continue
                if event.direction in by_direction:
                    by_direction[event.direction][name] += 1
                for approach_id in event.approach_ids:
                    by_approach.setdefault(approach_id, {key: 0 for key in WINDOWS_MS})
                    by_approach[approach_id][name] += 1
        return {"directions": by_direction, "approaches": by_approach, "event_count": len(self._events)}

    def recent_events(self, limit: int = 20) -> list[dict[str, Any]]:
        return [event.to_dict() for event in list(self._events)[-limit:]]

    def _evict(self, now_ms: int) -> None:
        cutoff = now_ms - self.history_ms
        while self._events and self._events[0].timestamp_ms < cutoff:
            self._events.popleft()


def _video_counts_from_stats(video_stats: dict[str, Any] | None, direction: str) -> dict[str, int] | None:
    stats = (video_stats or {}).get("stats", video_stats or {})
    bucket = stats.get(direction, {}) if isinstance(stats, dict) else {}
    if not bucket:
        return None
    keys = ("entry_count_1m", "entry_count_5m", "entry_count_15m")
    if not any(key in bucket for key in keys):
        return None
    return {
        "1m": int(bucket.get("entry_count_1m", 0)),
        "5m": int(bucket.get("entry_count_5m", 0)),
        "15m": int(bucket.get("entry_count_15m", 0)),
    }


def _flow_counts_from_history(history: list[dict[str, Any]], direction: str) -> dict[str, int]:
    flow = 0.0
    for point in reversed(history or []):
        per_direction = point.get("per_direction", {})
        if direction in per_direction:
            flow = float(per_direction[direction].get("flow_veh_h", 0.0) or 0.0)
            break
    return {
        "1m": round(flow / 60.0),
        "5m": round(flow * 5.0 / 60.0),
        "15m": round(flow * 15.0 / 60.0),
    }


def _risk_state(score: float) -> str:
    if score >= 0.78:
        return "severe_risk"
    if score >= 0.58:
        return "high_risk"
    if score >= 0.38:
        return "watch"
    return "stable"


def _direction_payload(
    direction: str,
    live_state: dict[str, Any],
    history: list[dict[str, Any]],
    video_stats: dict[str, Any] | None,
) -> dict[str, Any]:
    metrics = live_state.get("metrics", {}).get(direction, {})
    demand = live_state.get("demand", {}).get(direction, {})
    google = live_state.get("google_snapshot", {}).get(direction, {})
    video_counts = _video_counts_from_stats(video_stats, direction)
    counts = video_counts or _flow_counts_from_history(history, direction)
    count_source = "video_zone_crossing" if video_counts is not None else "live_history_flow_estimate"

    normal_share = clamp(float(google.get("normal_share", demand.get("normal_share", 0.0)) or 0.0))
    slow_share = clamp(float(google.get("slow_share", demand.get("slow_share", 0.0)) or 0.0))
    jam_share = clamp(float(google.get("jam_share", demand.get("jam_share", 0.0)) or 0.0))
    total_share = max(normal_share + slow_share + jam_share, 1e-6)
    free_pct = round(normal_share / total_share * 100.0, 1)
    slow_pct = round(slow_share / total_share * 100.0, 1)
    jam_pct = round(jam_share / total_share * 100.0, 1)
    congested_pct = round(slow_pct + jam_pct, 1)

    queue_vehicles = float(metrics.get("queue_vehicles", 0.0) or 0.0)
    storage_capacity = max(float(demand.get("storage_capacity_vehicles", 0.0) or 0.0), 0.0)
    if storage_capacity > 0:
        queue_utilization_pct = round(clamp(queue_vehicles / storage_capacity) * 100.0, 1)
        storage_remaining = max(0.0, storage_capacity - queue_vehicles)
    else:
        approach_length = max(float(demand.get("approach_length_m", 0.0) or 0.0), 1.0)
        queue_utilization_pct = round(clamp(float(metrics.get("queue_m", 0.0) or 0.0) / approach_length) * 100.0, 1)
        storage_remaining = None

    pressure = clamp(float(demand.get("pressure_index", 0.0) or 0.0))
    saturation = clamp(float(demand.get("saturation_ratio", 0.0) or 0.0) / 1.5)
    queue_util = queue_utilization_pct / 100.0
    count_pressure = clamp(counts["5m"] / 45.0)
    risk_score = round(clamp((pressure * 0.28) + (saturation * 0.27) + (queue_util * 0.25) + ((congested_pct / 100.0) * 0.12) + (count_pressure * 0.08)), 3)

    drivers = []
    if queue_utilization_pct >= 70:
        drivers.append("queue storage is nearly consumed")
    if float(demand.get("saturation_ratio", 0.0) or 0.0) >= 1.0:
        drivers.append("demand exceeds estimated capacity")
    if congested_pct >= 35:
        drivers.append("corridor speed intervals show slow or jammed traffic")
    if counts["5m"] >= 30:
        drivers.append("recent vehicle entries are elevated")
    if not drivers:
        drivers.append("all monitored pressure indicators are within operating range")

    return {
        "direction": direction,
        "entry_count_1m": counts["1m"],
        "entry_count_5m": counts["5m"],
        "entry_count_15m": counts["15m"],
        "count_source": count_source,
        "free_pct": free_pct,
        "slow_pct": slow_pct,
        "jam_pct": jam_pct,
        "congested_pct": congested_pct,
        "queue_utilization_pct": queue_utilization_pct,
        "storage_used_vehicles": round(queue_vehicles, 1),
        "storage_capacity_vehicles": round(storage_capacity, 1) if storage_capacity else None,
        "storage_remaining_vehicles": round(storage_remaining, 1) if storage_remaining is not None else None,
        "risk_score": risk_score,
        "expected_state_5m": _risk_state(risk_score),
        "expected_state_15m": _risk_state(round(clamp(risk_score + (pressure * 0.12) + (saturation * 0.08)), 3)),
        "drivers": drivers,
        "source_provenance": {
            "counts": count_source,
            "congestion_share": "google_snapshot.normal_share/slow_share/jam_share with demand fallback",
            "queue_utilization": "SUMO queue vehicles divided by geometry-scaled storage capacity",
            "risk": "weighted pressure, saturation, queue utilization, congestion share, and entry rate",
        },
    }


def build_traffic_count_snapshot(
    live_state: dict[str, Any],
    history: list[dict[str, Any]],
    video_stats: dict[str, Any] | None = None,
) -> dict[str, Any]:
    directions = {
        direction: _direction_payload(direction, live_state, history, video_stats)
        for direction in DIRECTIONS
    }
    approaches: dict[str, dict[str, Any]] = {}
    for direction, approach_ids in DIRECTION_APPROACHES.items():
        direction_payload = directions[direction]
        divisor = max(len(approach_ids), 1)
        for approach_id in approach_ids:
            approaches[approach_id] = {
                "approach_id": approach_id,
                "direction": direction,
                "entry_count_1m": round(direction_payload["entry_count_1m"] / divisor),
                "entry_count_5m": round(direction_payload["entry_count_5m"] / divisor),
                "entry_count_15m": round(direction_payload["entry_count_15m"] / divisor),
                "free_pct": direction_payload["free_pct"],
                "slow_pct": direction_payload["slow_pct"],
                "jam_pct": direction_payload["jam_pct"],
                "congested_pct": direction_payload["congested_pct"],
                "queue_utilization_pct": direction_payload["queue_utilization_pct"],
                "risk_score": direction_payload["risk_score"],
                "expected_state_5m": direction_payload["expected_state_5m"],
                "expected_state_15m": direction_payload["expected_state_15m"],
                "drivers": direction_payload["drivers"],
                "source_provenance": {
                    **direction_payload["source_provenance"],
                    "approach_distribution": "direction value distributed evenly across configured approach ids",
                },
            }
    return {
        "generated_at": now_iso(),
        "source": "traffic_count_analytics_v1",
        "directions": directions,
        "approaches": approaches,
    }
