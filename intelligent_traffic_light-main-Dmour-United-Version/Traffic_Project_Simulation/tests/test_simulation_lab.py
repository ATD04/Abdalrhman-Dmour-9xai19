"""Tests for Simulation Lab what-if sandbox."""

from __future__ import annotations

import json
import sys
import threading
import time
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib import request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "tests"))

from test_chat_retrieval import FakeEngine  # noqa: E402


def _live_state() -> dict:
    return {
        "metrics": {
            "northbound": {"queue_vehicles": 12, "flow_veh_h": 400},
            "southbound": {"queue_vehicles": 8, "flow_veh_h": 380},
            "eastbound": {"queue_vehicles": 2, "flow_veh_h": 220},
            "westbound": {"queue_vehicles": 20, "flow_veh_h": 500},
        },
        "demand": {
            "northbound": {"target_veh_h": 600, "capacity_veh_h": 900, "storage_capacity_vehicles": 30},
            "southbound": {"target_veh_h": 520, "capacity_veh_h": 900, "storage_capacity_vehicles": 30},
            "eastbound": {"target_veh_h": 260, "capacity_veh_h": 500, "storage_capacity_vehicles": 20},
            "westbound": {"target_veh_h": 700, "capacity_veh_h": 500, "storage_capacity_vehicles": 24},
        },
        "signal_plan": {"applied_greens": {"northbound": 25, "southbound": 25, "eastbound": 20, "westbound": 15}},
        "signal_recommendation": {"phases": []},
    }


def test_what_if_is_deterministic_for_same_seed():
    from simulation.simulation_lab import run_what_if

    payload = {"ns_green": 25, "e_green": 20, "w_green": 35, "duration_s": 120, "seed": 11}
    first = run_what_if(payload, _live_state())
    second = run_what_if(payload, _live_state())
    assert first["candidate"]["avg_queue_m"] == second["candidate"]["avg_queue_m"]
    assert first["candidate"]["vehicle_snapshots"] == second["candidate"]["vehicle_snapshots"]


def test_candidate_green_time_changes_westbound_metric():
    from simulation.simulation_lab import run_what_if

    shorter = run_what_if({"ns_green": 25, "e_green": 20, "w_green": 12, "duration_s": 180}, _live_state())
    longer = run_what_if({"ns_green": 25, "e_green": 20, "w_green": 45, "duration_s": 180}, _live_state())
    assert longer["candidate"]["direction_breakdown"]["westbound"]["avg_queue_m"] < shorter["candidate"]["direction_breakdown"]["westbound"]["avg_queue_m"]


def test_sumo_request_falls_back_to_math_when_runner_fails(monkeypatch):
    from simulation import simulation_lab

    def _boom(*args, **kwargs):
        raise RuntimeError("sumo bootstrap failed")

    monkeypatch.setattr(simulation_lab, "_run_sumo_scenario", _boom)
    result = simulation_lab.run_scenario(
        _live_state(),
        {"ns_green": 25, "e_green": 20, "w_green": 35},
        120,
        engine="sumo",
    )
    assert result["engine_requested"] == "sumo"
    assert result["engine_used"] == "math"
    assert "sumo bootstrap failed" in (result["engine_fallback_reason"] or "")


def test_sumo_request_uses_sumo_runner_when_available(monkeypatch):
    from simulation import simulation_lab

    monkeypatch.setattr(simulation_lab, "_run_sumo_scenario", lambda *args, **kwargs: {
        "cycle_s": 80.0,
        "avg_queue_m": 22.0,
        "max_queue_m": 40.0,
        "throughput_veh": 64.0,
        "avg_delay_s": 17.5,
        "intersection_los": "B",
        "time_to_clear_s": 55,
        "spillback_events": [],
        "direction_breakdown": {direction: {"avg_delay_s": 10.0, "avg_queue_m": 5.0, "v_over_c": 0.5, "los": "B"} for direction in simulation_lab.DIRECTIONS},
        "vehicle_snapshots": [{"t": 0, "phase": "ns_green", "directions": {}, "vehicles": []}],
        "safety_warnings": [],
    })
    result = simulation_lab.run_scenario(
        _live_state(),
        {"ns_green": 25, "e_green": 20, "w_green": 35},
        120,
        engine="sumo",
    )
    assert result["engine_requested"] == "sumo"
    assert result["engine_used"] == "sumo"
    assert result["engine_fallback_reason"] is None


def test_sumo_runner_startup_avoids_duplicate_remote_port(monkeypatch, tmp_path):
    from simulation import simulation_lab

    class _FakeTrafficLights:
        def getIDList(self):
            return []

        def setProgram(self, *_args, **_kwargs):
            return None

        def setPhase(self, *_args, **_kwargs):
            return None

    class _FakeEdges:
        def getLastStepHaltingNumber(self, *_args, **_kwargs):
            return 0

        def getLastStepVehicleIDs(self, *_args, **_kwargs):
            return []

    class _FakeVehicles:
        def getWaitingTime(self, *_args, **_kwargs):
            return 0.0

    class _FakeConnection:
        def __init__(self):
            self.trafficlight = _FakeTrafficLights()
            self.edge = _FakeEdges()
            self.vehicle = _FakeVehicles()
            self.closed = False

        def simulationStep(self):
            return None

        def close(self):
            self.closed = True

    class _FakeTraci:
        def __init__(self):
            self.cmd = None
            self.num_retries = None
            self.do_switch = None
            self.connection = _FakeConnection()

        def start(self, cmd, label=None, numRetries=None, doSwitch=None):  # noqa: N803 - match TraCI kwargs
            self.cmd = list(cmd)
            self.num_retries = numRetries
            self.do_switch = doSwitch

        def getConnection(self, _label):
            return self.connection

    fake_traci = _FakeTraci()
    monkeypatch.setattr(simulation_lab, "traci", fake_traci)
    net_path = tmp_path / "wadi.net.xml"
    net_path.write_text("<net/>", encoding="utf-8")
    monkeypatch.setattr(simulation_lab, "load_live_config", lambda: {
        "sumo": {"binary": "sumo"},
        "paths": {"network_net": net_path},
    })

    result = simulation_lab._run_sumo_scenario(
        _live_state(),
        {"ns_green": 25, "e_green": 20, "w_green": 35},
        5,
    )

    assert "--remote-port" not in (fake_traci.cmd or [])
    assert fake_traci.num_retries == 1
    assert fake_traci.do_switch is False
    assert fake_traci.connection.closed is True
    assert result["direction_breakdown"]["northbound"]["source_name"] == "SUMO Micro-Simulation (Headless)"


def test_what_if_rejects_unsafe_green_time():
    from simulation.simulation_lab import WhatIfValidationError, validate_request

    try:
        validate_request({"ns_green": 3, "duration_s": 60}, _live_state())
    except WhatIfValidationError as exc:
        assert "between 7 and 90" in str(exc)
    else:
        raise AssertionError("Expected validation error")


def _json_request(url: str, method: str = "GET", payload: dict | None = None) -> dict:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method=method,
    )
    with request.urlopen(req, timeout=5) as response:  # noqa: S310 - local test server
        return json.loads(response.read().decode("utf-8"))


def test_what_if_http_job_lifecycle():
    from core.start_live_simulation import LiveHandler

    handler = partial(LiveHandler, engine=FakeEngine(), chat_service=None)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        job = _json_request(base + "/api/simulation/what-if", method="POST", payload={
            "ns_green": 25,
            "e_green": 20,
            "w_green": 35,
            "duration_s": 60,
        })
        assert job["status"] in {"running", "completed"}

        fetched = job
        deadline = time.time() + 5.0
        while fetched["status"] == "running" and time.time() < deadline:
            time.sleep(0.05)
            fetched = _json_request(base + f"/api/simulation/what-if/{job['job_id']}")

        assert fetched["status"] == "completed"
        assert fetched["result"]["baseline"]
        assert fetched["result"]["candidate"]
        assert fetched["result"]["comparison"]
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
