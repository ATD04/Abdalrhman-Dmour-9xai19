"""Tests for the Replay payload and HTTP endpoint."""

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


def _history() -> list[dict]:
    directions = {
        "northbound": {"queue_m": 10.0, "flow_veh_h": 320.0, "avg_speed_kmh": 28.0, "google_delay_s": 35.0},
        "southbound": {"queue_m": 8.0, "flow_veh_h": 280.0, "avg_speed_kmh": 29.0, "google_delay_s": 24.0},
        "eastbound": {"queue_m": 6.0, "flow_veh_h": 240.0, "avg_speed_kmh": 32.0, "google_delay_s": 18.0},
        "westbound": {"queue_m": 5.0, "flow_veh_h": 220.0, "avg_speed_kmh": 34.0, "google_delay_s": 12.0},
    }
    return [
        {
            "wall_time": "2026-05-06T10:00:00+03:00",
            "sim_time_s": 100.0,
            "vehicle_count": 18,
            "total_queue_m": 29.0,
            "avg_network_speed_kmh": 30.8,
            "phase_label": "North + South",
            "active_directions": ["northbound", "southbound"],
            "adaptive_active": True,
            "per_direction": directions,
            "events": [{"type": "heavy_congestion", "incident_type": "severe_congestion", "severity": "HIGH"}],
        },
        {
            "wall_time": "2026-05-06T10:00:05+03:00",
            "sim_time_s": 105.0,
            "vehicle_count": 23,
            "total_queue_m": 55.0,
            "avg_network_speed_kmh": 24.9,
            "phase_label": "East",
            "active_directions": ["eastbound"],
            "adaptive_active": True,
            "per_direction": {
                "northbound": {"queue_m": 21.0, "flow_veh_h": 390.0, "avg_speed_kmh": 20.0, "google_delay_s": 76.0},
                "southbound": {"queue_m": 12.0, "flow_veh_h": 300.0, "avg_speed_kmh": 26.0, "google_delay_s": 35.0},
                "eastbound": {"queue_m": 14.0, "flow_veh_h": 260.0, "avg_speed_kmh": 25.0, "google_delay_s": 30.0},
                "westbound": {"queue_m": 8.0, "flow_veh_h": 220.0, "avg_speed_kmh": 28.0, "google_delay_s": 18.0},
            },
            "anomaly_incidents": [{"incident_type": "anomaly_spike", "severity": "MEDIUM"}],
            "video_incidents": [{"incident_type": "collision", "severity": "CRITICAL", "direction": "northbound"}],
        },
    ]


def test_build_replay_payload_enriches_snapshots_with_deltas_and_markers():
    from core.replay import build_replay_payload

    payload = build_replay_payload(_history())

    assert payload["schema_version"] == 2
    assert payload["count"] == 2
    assert payload["snapshots"][0]["index"] == 0
    assert payload["snapshots"][1]["timeline_label"] == "10:00:05"
    assert payload["snapshots"][1]["delta"]["queue_total_m"] == 26.0
    assert payload["snapshots"][1]["direction_rows"][0]["delta"]["queue_m"] == 11.0
    assert "phase_change" in payload["snapshots"][1]["marker_types"]
    assert "incident" in payload["available_marker_types"]
    assert payload["summary"]["marker_counts"]["phase_change"] == 1
    assert payload["summary"]["duration_s"] == 5.0


def test_replay_http_endpoint_returns_oldest_first_payload():
    from core.start_live_simulation import LiveHandler

    class ReplayEngine:
        manifest = {"simulation_center": {"lat": 31.96387, "lon": 35.88957}}
        controller_tls_id = "tls_test"

        def get_history(self):
            return _history()

    handler = partial(LiveHandler, engine=ReplayEngine(), chat_service=None)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        base = f"http://127.0.0.1:{server.server_address[1]}"
        with request.urlopen(base + "/api/replay", timeout=5) as response:  # noqa: S310
            payload = json.loads(response.read().decode("utf-8"))
        assert payload["snapshots"][0]["wall_time"] == "2026-05-06T10:00:00+03:00"
        assert payload["snapshots"][-1]["wall_time"] == "2026-05-06T10:00:05+03:00"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
