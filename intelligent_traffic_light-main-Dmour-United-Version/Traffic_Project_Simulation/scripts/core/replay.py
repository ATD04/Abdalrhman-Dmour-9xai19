"""Replay payload builder for the live dashboard."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

DIRECTIONS = ("northbound", "southbound", "eastbound", "westbound")


def _num(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _marker(marker_type: str, label: str, detail: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"type": marker_type, "label": label, "detail": detail or {}}


def _parse_time(value: Any) -> datetime | None:
    if not value:
        return None
    text = str(value)
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _timeline_label(wall_time: Any, sim_time_s: Any) -> str:
    parsed = _parse_time(wall_time)
    if parsed is not None:
        return parsed.strftime("%H:%M:%S")
    if sim_time_s is not None:
        return f"t+{int(round(_num(sim_time_s)))}s"
    return "--"


def _dedupe_markers(markers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped = []
    seen: set[str] = set()
    for marker in markers:
        key = json.dumps(
            {
                "type": marker.get("type"),
                "label": marker.get("label"),
                "detail": marker.get("detail", {}),
            },
            sort_keys=True,
            default=str,
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(marker)
    return deduped


def _direction_snapshot(
    direction: str,
    current: dict[str, Any],
    previous: dict[str, Any] | None = None,
) -> dict[str, Any]:
    prev = previous or {}
    queue_m = round(_num(current.get("queue_m")), 1)
    flow_veh_h = round(_num(current.get("flow_veh_h")), 1)
    avg_speed_kmh = round(_num(current.get("avg_speed_kmh")), 1)
    google_delay_s = round(_num(current.get("google_delay_s", current.get("delay_s"))), 1)
    return {
        "direction": direction,
        "queue_m": queue_m,
        "flow_veh_h": flow_veh_h,
        "avg_speed_kmh": avg_speed_kmh,
        "google_delay_s": google_delay_s,
        "delta": {
            "queue_m": round(queue_m - _num(prev.get("queue_m")), 1),
            "flow_veh_h": round(flow_veh_h - _num(prev.get("flow_veh_h")), 1),
            "avg_speed_kmh": round(avg_speed_kmh - _num(prev.get("avg_speed_kmh")), 1),
            "google_delay_s": round(google_delay_s - _num(prev.get("google_delay_s", prev.get("delay_s"))), 1),
        },
    }


def normalize_replay_snapshot(
    point: dict[str, Any],
    previous: dict[str, Any] | None = None,
    *,
    index: int = 0,
    first_sim_time_s: float | None = None,
    first_wall_time: datetime | None = None,
) -> dict[str, Any]:
    per_direction = point.get("per_direction") or point.get("metrics") or {}
    metrics = {}
    direction_rows = []
    for direction in DIRECTIONS:
        data = per_direction.get(direction, {}) or {}
        previous_data = ((previous or {}).get("metrics") or {}).get(direction, {})
        row = _direction_snapshot(direction, data, previous_data)
        metrics[direction] = {
            "queue_m": row["queue_m"],
            "flow_veh_h": row["flow_veh_h"],
            "avg_speed_kmh": row["avg_speed_kmh"],
            "google_delay_s": row["google_delay_s"],
        }
        direction_rows.append(row)

    queue_total = _num(point.get("queue_total_m", point.get("total_queue_m")))
    avg_speed = _num(point.get("network_avg_speed_kmh", point.get("avg_network_speed_kmh")))
    phase_label = point.get("phase_label")
    markers = list(point.get("markers") or [])
    sim_time_s = _num(point.get("sim_time_s"), default=0.0)
    wall_time = point.get("wall_time")
    parsed_wall_time = _parse_time(wall_time)

    previous_phase = previous.get("phase_label") if previous else None
    if phase_label and previous_phase and phase_label != previous_phase:
        markers.append(_marker("phase_change", f"phase -> {phase_label}", {"from": previous_phase, "to": phase_label}))

    previous_queue = _num((previous or {}).get("queue_total_m"))
    previous_speed = _num((previous or {}).get("network_avg_speed_kmh"))
    queue_delta = round(queue_total - previous_queue, 1)
    speed_delta = round(avg_speed - previous_speed, 1)
    if previous and queue_delta >= 20.0:
        markers.append(_marker("queue_jump", f"queue +{round(queue_delta)} m", {"delta_queue_m": queue_delta}))
    if previous and speed_delta <= -5.0:
        markers.append(_marker("speed_drop", f"speed {speed_delta:.1f} km/h", {"delta_speed_kmh": speed_delta}))

    for event in point.get("events", []) or []:
        label = event.get("incident_type") or event.get("event_type") or event.get("type") or "event"
        markers.append(_marker("event", str(label), event))
    for incident in point.get("anomaly_incidents", []) or []:
        label = incident.get("type") or incident.get("incident_type") or "anomaly"
        markers.append(_marker("anomaly_spike", str(label), incident))
    for incident in point.get("video_incidents", []) or []:
        label = incident.get("incident_type") or incident.get("type") or "visual incident"
        markers.append(_marker("incident", str(label), incident))
    markers = _dedupe_markers(markers)

    if parsed_wall_time is not None and first_wall_time is not None:
        elapsed_wall = round((parsed_wall_time - first_wall_time).total_seconds(), 1)
    elif first_sim_time_s is not None:
        elapsed_wall = round(sim_time_s - first_sim_time_s, 1)
    else:
        elapsed_wall = 0.0

    return {
        "index": index,
        "wall_time": point.get("wall_time"),
        "timeline_label": _timeline_label(wall_time, sim_time_s),
        "elapsed_s": max(0.0, elapsed_wall),
        "sim_time_s": point.get("sim_time_s"),
        "source": point.get("source"),
        "vehicle_count": int(_num(point.get("vehicle_count"), 0)),
        "queue_total_m": round(queue_total, 1),
        "network_avg_speed_kmh": round(avg_speed, 1),
        "dominant_queue_direction": point.get("dominant_queue_direction"),
        "phase_label": phase_label,
        "active_directions": point.get("active_directions") or [],
        "cycle_length_s": point.get("cycle_length_s"),
        "adaptive_active": bool(point.get("adaptive_active", False)),
        "delta": {
            "vehicle_count": int(_num(point.get("vehicle_count"), 0) - _num((previous or {}).get("vehicle_count"), 0)),
            "queue_total_m": queue_delta,
            "network_avg_speed_kmh": speed_delta,
        },
        "metrics": metrics,
        "direction_rows": direction_rows,
        "markers": markers,
        "marker_types": sorted({marker["type"] for marker in markers if marker.get("type")}),
    }


def build_replay_payload(history: list[dict[str, Any]]) -> dict[str, Any]:
    snapshots = []
    previous = None
    first_point = history[0] if history else {}
    first_sim_time_s = _num(first_point.get("sim_time_s")) if history else None
    first_wall_time = _parse_time(first_point.get("wall_time")) if history else None
    marker_counts: dict[str, int] = {}
    for index, point in enumerate(history):
        snapshot = normalize_replay_snapshot(
            point,
            previous,
            index=index,
            first_sim_time_s=first_sim_time_s,
            first_wall_time=first_wall_time,
        )
        snapshots.append(snapshot)
        for marker_type in snapshot["marker_types"]:
            marker_counts[marker_type] = marker_counts.get(marker_type, 0) + 1
        previous = snapshot
    available_marker_types = sorted(marker_counts)
    max_queue = max((snapshot["queue_total_m"] for snapshot in snapshots), default=0.0)
    min_speed = min((snapshot["network_avg_speed_kmh"] for snapshot in snapshots), default=0.0)
    max_vehicle_count = max((snapshot["vehicle_count"] for snapshot in snapshots), default=0)
    duration_s = round((snapshots[-1]["elapsed_s"] - snapshots[0]["elapsed_s"]) if len(snapshots) >= 2 else 0.0, 1)
    return {
        "schema_version": 2,
        "count": len(snapshots),
        "available_marker_types": available_marker_types,
        "summary": {
            "oldest_wall_time": snapshots[0]["wall_time"] if snapshots else None,
            "newest_wall_time": snapshots[-1]["wall_time"] if snapshots else None,
            "duration_s": max(0.0, duration_s),
            "max_queue_total_m": round(max_queue, 1),
            "min_network_avg_speed_kmh": round(min_speed, 1),
            "max_vehicle_count": int(max_vehicle_count),
            "marker_counts": marker_counts,
        },
        "snapshots": snapshots,
    }
