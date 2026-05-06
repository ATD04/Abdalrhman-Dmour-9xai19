"""Tests for vehicle entry counts, utilization, and risk analytics."""

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
sys.path.insert(0, str(ROOT / "tests"))

from test_chat_retrieval import FakeEngine  # noqa: E402


def test_zone_entry_counter_counts_crossing_once_with_cooldown():
    from utils.traffic_counts import ZoneEntryCounter

    zones = [{
        "zone_id": "north",
        "direction": "northbound",
        "approach_ids": ["1", "2", "3"],
        "points_norm": [[0.2, 0.2], [0.6, 0.2], [0.6, 0.6], [0.2, 0.6]],
        "enabled": True,
        "count_on_entry": True,
    }]
    counter = ZoneEntryCounter(zones, cooldown_ms=2_000)
    assert counter.ingest(0, [{"track_id": "car-1", "class_name": "car", "center_norm": {"x": 0.1, "y": 0.3}}]) == []
    first = counter.ingest(100, [{"track_id": "car-1", "class_name": "car", "center_norm": {"x": 0.3, "y": 0.3}}])
    assert len(first) == 1
    assert first[0]["direction"] == "northbound"
    assert counter.ingest(500, [{"track_id": "car-1", "class_name": "car", "center_norm": {"x": 0.4, "y": 0.4}}]) == []
    assert counter.rolling_counts(1_000)["directions"]["northbound"]["1m"] == 1


def test_build_traffic_count_snapshot_exposes_direction_and_approach_rows():
    from utils.traffic_counts import build_traffic_count_snapshot

    live_state = {
        "metrics": {
            "northbound": {"queue_vehicles": 15, "queue_m": 112.5},
            "southbound": {"queue_vehicles": 2, "queue_m": 15.0},
            "eastbound": {"queue_vehicles": 0, "queue_m": 0.0},
            "westbound": {"queue_vehicles": 9, "queue_m": 67.5},
        },
        "demand": {
            "northbound": {"pressure_index": 0.7, "saturation_ratio": 1.2, "storage_capacity_vehicles": 20},
            "southbound": {"pressure_index": 0.2, "saturation_ratio": 0.4, "storage_capacity_vehicles": 25},
            "eastbound": {"pressure_index": 0.1, "saturation_ratio": 0.3, "storage_capacity_vehicles": 10},
            "westbound": {"pressure_index": 0.6, "saturation_ratio": 1.0, "storage_capacity_vehicles": 12},
        },
        "google_snapshot": {
            "northbound": {"normal_share": 0.4, "slow_share": 0.35, "jam_share": 0.25},
            "southbound": {"normal_share": 0.8, "slow_share": 0.15, "jam_share": 0.05},
            "eastbound": {"normal_share": 0.9, "slow_share": 0.08, "jam_share": 0.02},
            "westbound": {"normal_share": 0.5, "slow_share": 0.3, "jam_share": 0.2},
        },
    }
    history = [{
        "per_direction": {
            "northbound": {"flow_veh_h": 600},
            "southbound": {"flow_veh_h": 120},
            "eastbound": {"flow_veh_h": 60},
            "westbound": {"flow_veh_h": 300},
        }
    }]
    snapshot = build_traffic_count_snapshot(live_state, history)
    north = snapshot["directions"]["northbound"]
    assert north["entry_count_5m"] == 50
    assert north["queue_utilization_pct"] == 75.0
    assert north["congested_pct"] == 60.0
    assert north["risk_score"] > snapshot["directions"]["eastbound"]["risk_score"]
    assert snapshot["approaches"]["1"]["direction"] == "northbound"
    assert snapshot["approaches"]["1"]["entry_count_5m"] > 0


def _get_json(url: str) -> dict:
    with request.urlopen(url, timeout=5) as response:  # noqa: S310 - local test server
        return json.loads(response.read().decode("utf-8"))


def test_traffic_counts_http_endpoint_returns_snapshot():
    from core.start_live_simulation import LiveHandler

    handler = partial(LiveHandler, engine=FakeEngine(), chat_service=None)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        payload = _get_json(base + "/api/analytics/traffic-counts")
        assert payload["directions"]["northbound"]["entry_count_5m"] >= 0
        assert payload["directions"]["northbound"]["risk_score"] >= 0
        assert "1" in payload["approaches"]
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
