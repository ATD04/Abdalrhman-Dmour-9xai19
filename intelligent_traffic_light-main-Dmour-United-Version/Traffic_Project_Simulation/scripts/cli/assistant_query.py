"""Grounded assistant answers for live and historical traffic questions."""

from __future__ import annotations

import re
from typing import Any

DIRECTION_ALIASES = {
    "northbound": ("northbound", "north"),
    "southbound": ("southbound", "south"),
    "eastbound": ("eastbound", "east"),
    "westbound": ("westbound", "west"),
}


def answer_query(
    query: str,
    live_state: dict[str, Any],
    history: list[dict[str, Any]],
    peak_hours: dict[str, Any] | None = None,
) -> dict[str, Any]:
    query = (query or "").strip()
    if not query:
        return _refusal("The query is empty.")

    q = query.lower()
    direction = _extract_direction(q)

    if "peak" in q and "hour" in q:
        return _answer_peak_hours(direction, peak_hours)

    if "average queue" in q or ("queue" in q and "last" in q):
        return _answer_average_queue(q, direction, history)

    if ("incident" in q or "alert" in q) and any(token in q for token in ("week", "month", "yesterday", "last tuesday", "between ")):
        return _refusal("This assistant does not have weekly or arbitrary historical incident archives yet.")

    if "incident" in q or "alert" in q:
        return _answer_incidents(live_state)

    if "recommend" in q:
        return _answer_recommendation(direction, live_state)

    if "signal" in q:
        return _answer_signal(direction, live_state)

    if "congestion" in q or "delay" in q:
        return _answer_congestion(direction, live_state)

    return _refusal("This assistant only supports current congestion, signal, queue, incident, recommendation, and peak-hour queries.")


def _extract_direction(query: str) -> str | None:
    for direction, aliases in DIRECTION_ALIASES.items():
        if any(re.search(rf"\b{alias}\b", query) for alias in aliases):
            return direction
    return None


def _refusal(reason: str) -> dict[str, Any]:
    return {
        "answer": None,
        "evidence": [],
        "time_scope": None,
        "confidence": 0.0,
        "cannot_answer_reason": reason,
    }


def _success(answer: str, evidence: list[dict[str, Any]], time_scope: str, confidence: float = 0.9) -> dict[str, Any]:
    return {
        "answer": answer,
        "evidence": evidence,
        "time_scope": time_scope,
        "confidence": round(confidence, 2),
        "cannot_answer_reason": None,
    }


def _answer_peak_hours(direction: str | None, peak_hours: dict[str, Any] | None) -> dict[str, Any]:
    if not direction:
        return _refusal("Peak-hour queries must specify a direction.")
    if not peak_hours or not peak_hours.get("directions"):
        return _refusal("Historical peak-hour analytics are not available.")
    entries = peak_hours["directions"].get(direction, [])
    if not entries:
        return _refusal(f"No peak-hour data is available for {direction}.")
    top = entries[0]
    answer = f"The busiest recorded period for {direction} is {top['weekday']} at {top['hour']:02d}:00, with a mean flow of {round(top['mean_veh_h'])} veh/h."
    return _success(
        answer,
        [{"source": "detector_peak_hours", "direction": direction, "top_hour": top}],
        "historical_detector_data",
        0.93,
    )


def _answer_average_queue(query: str, direction: str | None, history: list[dict[str, Any]]) -> dict[str, Any]:
    if not direction:
        return _refusal("Average-queue queries must specify a direction.")
    minutes_match = re.search(r"last\s+(\d+)\s+minute", query)
    minutes = int(minutes_match.group(1)) if minutes_match else 10
    if not history:
        return _refusal("No live history is available yet.")
    sample_count = max(1, min(len(history), minutes * 60))
    points = history[-sample_count:]
    values = [float(point.get("per_direction", {}).get(direction, {}).get("queue_m", 0.0)) for point in points]
    avg_queue = sum(values) / len(values) if values else 0.0
    return _success(
        f"The average queue on {direction} over the last {minutes} minute(s) is {round(avg_queue, 1)} m.",
        [{"source": "live_history", "direction": direction, "samples": len(values), "average_queue_m": round(avg_queue, 1)}],
        f"last_{minutes}_minutes",
        0.87,
    )


def _answer_incidents(live_state: dict[str, Any]) -> dict[str, Any]:
    insights = live_state.get("insights", {}) or {}
    anomaly = live_state.get("anomaly", {}) or {}
    events = list(insights.get("events", []) or [])
    incidents = list(anomaly.get("incidents", []) or [])
    count = len(events) + len(incidents)
    answer = f"There are {count} active incident or alert item(s) in the current state."
    return _success(
        answer,
        [{"source": "live_state", "insights_events": len(events), "anomaly_incidents": len(incidents)}],
        "current_live_state",
        0.9,
    )


def _answer_recommendation(direction: str | None, live_state: dict[str, Any]) -> dict[str, Any]:
    insights = live_state.get("insights", {}) or {}
    anomaly = live_state.get("anomaly", {}) or {}
    if direction:
        for incident in anomaly.get("incidents", []) or []:
            if incident.get("direction") == direction and incident.get("recommendation"):
                return _success(
                    incident["recommendation"],
                    [{"source": "anomaly_incident", "direction": direction, "incident": incident}],
                    "current_live_state",
                    0.9,
                )
    recommendation = insights.get("recommendation")
    if recommendation:
        return _success(
            recommendation,
            [{"source": "insights", "recommendation": recommendation}],
            "current_live_state",
            0.84,
        )
    return _refusal("No recommendation is available yet.")


def _answer_signal(direction: str | None, live_state: dict[str, Any]) -> dict[str, Any]:
    plan = live_state.get("signal_plan", {}) or {}
    active_directions = plan.get("active_directions", []) or []
    if not plan:
        return _refusal("Signal-plan data is not available.")
    if direction:
        moving = direction in active_directions
        answer = f"The {direction} approach is currently {'green/moving' if moving else 'not active in the current phase'}."
        return _success(
            answer,
            [{"source": "signal_plan", "direction": direction, "active_directions": active_directions, "phase_label": plan.get("phase_label")}],
            "current_live_state",
            0.91,
        )
    answer = f"The current signal phase is '{plan.get('phase_label', 'unknown')}', serving {', '.join(active_directions) if active_directions else 'no mapped directions'}."
    return _success(
        answer,
        [{"source": "signal_plan", "phase_label": plan.get("phase_label"), "active_directions": active_directions}],
        "current_live_state",
        0.91,
    )


def _answer_congestion(direction: str | None, live_state: dict[str, Any]) -> dict[str, Any]:
    google_snapshot = live_state.get("google_snapshot", {}) or {}
    metrics = live_state.get("metrics", {}) or {}
    if direction:
        google = google_snapshot.get(direction, {})
        metric = metrics.get(direction, {})
        if not google:
            return _refusal(f"No live congestion data is available for {direction}.")
        answer = (
            f"{direction} is currently {google.get('congestion_level', 'unknown')} with "
            f"{round(float(google.get('delay_s', 0.0)))} s extra delay, "
            f"{round(float(google.get('avg_speed_kmh', 0.0)), 1)} km/h corridor speed, "
            f"and {round(float(metric.get('queue_m', 0.0)), 1)} m queue."
        )
        return _success(
            answer,
            [{"source": "live_state", "direction": direction, "google": google, "metrics": metric}],
            "current_live_state",
            0.94,
        )

    ranked = []
    for candidate, google in google_snapshot.items():
        ranked.append((float(google.get("delay_s", 0.0)), candidate))
    if not ranked:
        return _refusal("No live congestion data is available.")
    ranked.sort(reverse=True)
    _, worst = ranked[0]
    return _answer_congestion(worst, live_state)
