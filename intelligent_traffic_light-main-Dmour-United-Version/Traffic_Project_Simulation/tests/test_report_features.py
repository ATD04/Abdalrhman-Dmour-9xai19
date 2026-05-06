"""Tests for deterministic Reports payloads and APIs."""

from __future__ import annotations

import json
import sys
import threading
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib import request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))


class _FakeVideoProcessor:
    def describe(self) -> dict:
        return {
            "enabled": True,
            "running": True,
            "incident_detector": {"enabled": True, "loaded": False, "load_error": "weights unavailable"},
        }


class _ReportEngine:
    manifest = {"simulation_center": {"lat": 31.96387, "lon": 35.88957}}
    controller_tls_id = "tls_test"

    def __init__(self):
        from forecasting.flow_forecaster import FlowForecaster

        self.config = {"forecasting": {"model_path": None}, "llm": {"enabled": False}}
        self.forecaster = FlowForecaster.load_or_default({"forecasting": {"model_path": None}})
        self.video_processor = _FakeVideoProcessor()

    def get_state(self):
        return {
            "status": "running",
            "wall_time": "2026-05-06T10:10:00+03:00",
            "source": "detector+google",
            "adaptive_active": True,
            "signal_plan": {"phase_label": "North + South"},
            "metrics": {
                "northbound": {"queue_m": 82.0, "flow_veh_h": 620.0, "avg_speed_kmh": 18.0},
                "southbound": {"queue_m": 36.0, "flow_veh_h": 380.0, "avg_speed_kmh": 24.0},
                "eastbound": {"queue_m": 22.0, "flow_veh_h": 300.0, "avg_speed_kmh": 28.0},
                "westbound": {"queue_m": 54.0, "flow_veh_h": 470.0, "avg_speed_kmh": 19.0},
            },
            "google_snapshot": {
                "northbound": {"delay_s": 168.0, "congestion_level": "heavy"},
                "southbound": {"delay_s": 45.0, "congestion_level": "moderate"},
                "eastbound": {"delay_s": 26.0, "congestion_level": "light"},
                "westbound": {"delay_s": 132.0, "congestion_level": "severe"},
            },
            "demand": {
                "northbound": {"pressure_index": 0.86, "saturation_ratio": 1.12, "target_veh_h": 920, "storage_capacity_vehicles": 26},
                "southbound": {"pressure_index": 0.48, "saturation_ratio": 0.76, "target_veh_h": 410, "storage_capacity_vehicles": 24},
                "eastbound": {"pressure_index": 0.30, "saturation_ratio": 0.52, "target_veh_h": 290, "storage_capacity_vehicles": 20},
                "westbound": {"pressure_index": 0.74, "saturation_ratio": 0.96, "target_veh_h": 510, "storage_capacity_vehicles": 18},
            },
            "insights": {
                "total_queue_m": 194.0,
                "avg_network_speed_kmh": 22.3,
                "dominant_queue_direction": "northbound",
                "events": [{
                    "type": "spillback",
                    "incident_type": "queue_spillback",
                    "severity": "CRITICAL",
                    "direction": "northbound",
                    "message": "Queue spillback is active on the northbound approach.",
                }],
            },
            "anomaly": {
                "incidents": [{
                    "incident_type": "anomaly_spike",
                    "severity": "MEDIUM",
                    "direction": "westbound",
                    "message": "Westbound anomaly score exceeded threshold.",
                }],
            },
            "video_incidents": [{
                "incident_type": "collision",
                "severity": "CRITICAL",
                "direction": "northbound",
                "message": "Vision detector confirmed a collision in the northbound zone.",
            }],
            "alert_dispatch": {"enabled": False, "pending_count": 0},
        }

    def get_history(self):
        return [
            {
                "wall_time": "2026-05-06T10:05:00+03:00",
                "per_direction": {
                    "northbound": {"queue_m": 50.0, "avg_speed_kmh": 24.0, "flow_veh_h": 510.0},
                    "southbound": {"queue_m": 28.0, "avg_speed_kmh": 26.0, "flow_veh_h": 340.0},
                    "eastbound": {"queue_m": 18.0, "avg_speed_kmh": 30.0, "flow_veh_h": 260.0},
                    "westbound": {"queue_m": 40.0, "avg_speed_kmh": 22.0, "flow_veh_h": 410.0},
                },
                "events": [{
                    "incident_type": "congestion_surge",
                    "severity": "HIGH",
                    "direction": "westbound",
                    "message": "Westbound corridor delay jumped sharply.",
                }],
            },
            {
                "wall_time": "2026-05-06T10:10:00+03:00",
                "per_direction": {
                    "northbound": {"queue_m": 82.0, "avg_speed_kmh": 18.0, "flow_veh_h": 620.0},
                    "southbound": {"queue_m": 36.0, "avg_speed_kmh": 24.0, "flow_veh_h": 380.0},
                    "eastbound": {"queue_m": 22.0, "avg_speed_kmh": 28.0, "flow_veh_h": 300.0},
                    "westbound": {"queue_m": 54.0, "avg_speed_kmh": 19.0, "flow_veh_h": 470.0},
                },
            },
        ]


class _InvalidJsonOllama:
    provider = "ollama"
    model = "gemma4:latest"

    def health(self) -> dict:
        return {"ready": True, "provider": self.provider, "model": self.model, "reason": None}

    def generate_answer(self, prompt: str) -> str:
        del prompt
        return "not valid json"


def _json_request(url: str, method: str = "GET", payload: dict | None = None) -> tuple[int, dict]:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method=method,
    )
    with request.urlopen(req, timeout=5) as response:  # noqa: S310 - local test server
        return response.status, json.loads(response.read().decode("utf-8"))


def test_report_builder_creates_required_sections_and_persists(tmp_path):
    from core.reporting import SituationReportBuilder

    path = tmp_path / "latest_situation_report.json"
    builder = SituationReportBuilder({}, report_path=path)
    report = builder.build(_ReportEngine(), persist=True)

    assert path.exists()
    assert report["schema_version"] == 1
    assert report["metadata"]["generation_mode"] == "deterministic_rule_based"
    assert report["sections"]["status"]["summary"]
    assert len(report["sections"]["approaches"]) == 4
    assert report["sections"]["actions"][0]["priority"] <= report["sections"]["actions"][-1]["priority"]
    assert report["sections"]["forecasts"]["available"] is True


def test_report_builder_falls_back_when_llm_returns_invalid_json(tmp_path):
    from core.reporting import SituationReportBuilder

    builder = SituationReportBuilder(
        {},
        report_path=tmp_path / "latest_situation_report.json",
        ollama_client=_InvalidJsonOllama(),
    )
    report = builder.build(_ReportEngine(), prefer_llm=True, persist=False)

    assert report["metadata"]["llm"]["requested"] is True
    assert report["metadata"]["llm"]["used"] is False
    assert "deterministic report" in report["metadata"]["llm"]["reason"].lower()
    assert report["metadata"]["generation_mode"] == "deterministic_rule_based"


def test_report_http_endpoints_generate_and_return_latest(tmp_path):
    import core.start_live_simulation as server_module
    from core.start_live_simulation import LiveHandler

    original_path = server_module.SITUATION_REPORT_PATH
    server_module.SITUATION_REPORT_PATH = tmp_path / "latest_situation_report.json"

    handler = partial(LiveHandler, engine=_ReportEngine(), chat_service=None)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        base = f"http://127.0.0.1:{server.server_address[1]}"
        status, generated = _json_request(base + "/api/report/generate", method="POST", payload={"prefer_llm": True})
        assert status == 201
        assert generated["metadata"]["llm"]["requested"] is True
        assert server_module.SITUATION_REPORT_PATH.exists()

        latest_status, latest = _json_request(base + "/api/report/latest")
        assert latest_status == 200
        assert latest["metadata"]["report_id"] == generated["metadata"]["report_id"]
        assert latest["sections"]["health"]["forecasting"]["available"] is True
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
        server_module.SITUATION_REPORT_PATH = original_path
