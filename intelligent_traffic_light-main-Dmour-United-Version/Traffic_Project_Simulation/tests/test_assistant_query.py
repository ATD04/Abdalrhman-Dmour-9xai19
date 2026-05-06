"""Tests for grounded assistant query answers."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))


def _live_state() -> dict:
    return {
        "google_snapshot": {
            "northbound": {"congestion_level": "heavy", "delay_s": 75.0, "avg_speed_kmh": 18.5},
            "southbound": {"congestion_level": "light", "delay_s": 12.0, "avg_speed_kmh": 31.0},
            "eastbound": {"congestion_level": "moderate", "delay_s": 28.0, "avg_speed_kmh": 24.0},
            "westbound": {"congestion_level": "severe", "delay_s": 95.0, "avg_speed_kmh": 12.0},
        },
        "metrics": {
            "northbound": {"queue_m": 84.0},
            "southbound": {"queue_m": 12.0},
            "eastbound": {"queue_m": 41.0},
            "westbound": {"queue_m": 120.0},
        },
        "signal_plan": {
            "phase_label": "North + South",
            "active_directions": ["northbound", "southbound"],
        },
        "insights": {
            "recommendation": "Prioritize the westbound approach because it has the longest queue.",
            "events": [{"incident_type": "queue_spillback", "direction": "westbound", "severity": "HIGH"}],
        },
        "anomaly": {
            "incidents": [
                {
                    "type": "severe_congestion",
                    "direction": "northbound",
                    "severity": "HIGH",
                    "recommendation": "Heavy congestion on northbound corridor. Consider upstream metering.",
                }
            ]
        },
    }


def _history() -> list[dict]:
    return [
        {"per_direction": {"northbound": {"queue_m": 80.0}}},
        {"per_direction": {"northbound": {"queue_m": 60.0}}},
        {"per_direction": {"northbound": {"queue_m": 100.0}}},
    ]


def _peak_hours() -> dict:
    return {
        "directions": {
            "eastbound": [
                {"weekday": "Tuesday", "hour": 8, "mean_veh_h": 1254.0},
                {"weekday": "Thursday", "hour": 8, "mean_veh_h": 1169.0},
            ]
        }
    }


def test_current_congestion_answer():
    from cli.assistant_query import answer_query

    result = answer_query("Is there congestion at the northbound approach right now?", _live_state(), _history(), _peak_hours())
    assert result["cannot_answer_reason"] is None
    assert "northbound" in result["answer"]
    assert result["time_scope"] == "current_live_state"


def test_average_queue_answer():
    from cli.assistant_query import answer_query

    result = answer_query("What is the average queue on northbound over the last 5 minutes?", _live_state(), _history(), _peak_hours())
    assert result["cannot_answer_reason"] is None
    assert "average queue" in result["answer"].lower()
    assert result["time_scope"] == "last_5_minutes"


def test_peak_hours_answer():
    from cli.assistant_query import answer_query

    result = answer_query("What are the peak hours for eastbound?", _live_state(), _history(), _peak_hours())
    assert result["cannot_answer_reason"] is None
    assert "Tuesday" in result["answer"]
    assert result["time_scope"] == "historical_detector_data"


def test_refusal_for_unsupported_query():
    from cli.assistant_query import answer_query

    result = answer_query("How many incidents occurred this week?", _live_state(), _history(), _peak_hours())
    assert result["answer"] is None
    assert result["cannot_answer_reason"] is not None
