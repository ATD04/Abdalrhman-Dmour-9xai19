"""Tests for grounded chat retrieval tools."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))


class FakeEngine:
    def get_state(self):
        return {
            "wall_time": "2026-05-03T12:24:11+03:00",
            "source": "detector_data",
            "google_snapshot": {
                "northbound": {"congestion_level": "heavy", "delay_s": 156.9, "avg_speed_kmh": 15.2},
                "westbound": {"congestion_level": "severe", "delay_s": 371.4, "avg_speed_kmh": 10.1},
            },
            "metrics": {
                "northbound": {"queue_m": 84.0, "flow_veh_h": 600.0, "avg_speed_kmh": 18.0},
                "westbound": {"queue_m": 120.0, "flow_veh_h": 468.0, "avg_speed_kmh": 10.0},
            },
            "demand": {"northbound": {"capacity_veh_h": 528.0, "saturation_ratio": 1.136}},
            "signal_plan": {"phase_label": "North + South", "active_directions": ["northbound", "southbound"]},
            "signal_recommendation": {"mode": "three_phase", "phases": []},
            "insights": {"recommendation": "Prioritize westbound.", "events": []},
            "anomaly": {"incidents": [], "directions": {}},
            "emissions": {"co2_g_per_h": 1234.5},
            "data_provenance": {"queue_m": "Stopped vehicles multiplied by length."},
        }

    def get_history(self):
        return [
            {"wall_time": "2026-05-03T12:20:00+03:00", "per_direction": {"northbound": {"queue_m": 60, "avg_speed_kmh": 18, "flow_veh_h": 500}}},
            {"wall_time": "2026-05-03T12:20:01+03:00", "per_direction": {"northbound": {"queue_m": 80, "avg_speed_kmh": 16, "flow_veh_h": 520}}},
        ]

    def get_historical_analytics(self):
        return {
            "source": "detector_data",
            "directions": {
                "northbound": {
                    "top_hours": [{"weekday": "Saturday", "weekday_index": 5, "hour": 0, "mean_veh_h": 1159.5}],
                    "heatmap": [[None] * 24 for _ in range(7)],
                }
            },
        }

    def get_peak_hours(self):
        analytics = self.get_historical_analytics()
        return {
            "source": analytics["source"],
            "directions": {
                direction: data["top_hours"]
                for direction, data in analytics["directions"].items()
            },
        }

    def get_network_geometry(self):
        return {"approaches": {"northbound": {"monitor_lanes": ["n_0"]}}}


def _retrieval():
    from chat.citations import ReferenceRegistry
    from chat.retrieval import TrafficRetrieval

    return TrafficRetrieval(FakeEngine(), ReferenceRegistry())


def test_live_direction_metrics_has_citation():
    result = _retrieval().get_live_direction_metrics("الشمال")
    assert result["data"]["direction"] == "northbound"
    assert result["citations"]
    assert result["citations"][0]["source_type"] == "live_state"


def test_live_history_window_aggregates_queue():
    result = _retrieval().get_live_history_window("north", 5)
    assert result["data"]["average_queue_m"] == 70.0
    assert result["time_scope"] == "live"


def test_peak_hours_from_engine_analytics():
    result = _retrieval().get_peak_hours("northbound")
    assert result["data"]["top_hours"][0]["weekday"] == "Saturday"
    assert result["citations"][0]["source_type"] == "detector_peak_hours"


def test_historical_incidents_reads_project_data():
    result = _retrieval().find_historical_incidents("northbound")
    assert result["data"]["count"] >= 1
    assert any(row["incident_id"] == "INC_004" for row in result["data"]["incidents"])


def test_collect_evidence_rejects_out_of_scope_city():
    result = _retrieval().collect_evidence("What is traffic in Irbid?")
    assert result["refusal_reason"]
    assert result["citations"] == []
