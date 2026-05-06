"""HCM-calibrated signal-timing what-if sandbox for the dashboard.

Implements:
  - HCM 2010 Chapter 16 uniform + incremental delay model
  - Webster (1958) optimal cycle calculation
  - Deterministic queue propagation with proper saturation flow
  - Per-direction Level of Service grading (HCM Table 16-2)
  - Safety validation per HCM and MUTCD minimums
  - Pedestrian clearance time checks
"""

from __future__ import annotations

import itertools
import math
import time
import uuid
import tempfile
import random
import threading
from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any

import sys
try:
    from ..core.live_support import load_live_config, SUMO_TOOLS
except ImportError:
    from core.live_support import load_live_config, SUMO_TOOLS

if str(SUMO_TOOLS) not in sys.path:
    sys.path.append(str(SUMO_TOOLS))

try:
    import traci
except ImportError:
    traci = None


DIRECTIONS = ("northbound", "southbound", "eastbound", "westbound")
PHASE_DIRECTIONS = {
    "ns_green": ("northbound", "southbound"),
    "e_green": ("eastbound",),
    "w_green": ("westbound",),
}
DEFAULT_GREENS = {"ns_green": 35.0, "e_green": 25.0, "w_green": 25.0}
YELLOW_S = 3.0
ALL_RED_S = 2.0
CLEARANCE_S = YELLOW_S + ALL_RED_S          # 5s per phase
N_PHASES = 3
VEHICLE_LENGTH_M = 6.0                       # avg vehicle + gap
ENGINE_LABELS = {
    "math": "Quick Estimate (HCM)",
    "sumo": "Detailed Digital Twin (SUMO)",
}

# ── HCM calibration constants ──────────────────────────────────────────────
SATURATION_FLOW_VEH_H_LANE = 1800.0         # HCM ideal saturation flow
LANES_PER_APPROACH = {                       # Wadi Saqra field geometry
    "northbound": 2, "southbound": 3, "eastbound": 2, "westbound": 1,
}
STORAGE_CAPACITY_VEH = {                     # max storage before spillback
    "northbound": 28, "southbound": 35, "eastbound": 22, "westbound": 15,
}
# HCM safety minimums
MIN_GREEN_S = 7.0                            # HCM 2010 minimum green
MAX_GREEN_S = 90.0
MIN_CYCLE_S = 60.0
MAX_CYCLE_S = 180.0
PED_CLEARANCE_S = 7.0                        # minimum pedestrian walk interval

# HCM Table 16-2 — Level of Service thresholds (delay in seconds/vehicle)
LOS_THRESHOLDS = [
    (10.0, "A"), (20.0, "B"), (35.0, "C"),
    (55.0, "D"), (80.0, "E"), (float("inf"), "F"),
]


class WhatIfValidationError(ValueError):
    """Raised when a simulation request is outside accepted bounds."""


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _los_grade(delay_s: float) -> str:
    """Return HCM Level of Service letter for a given control delay."""
    for threshold, grade in LOS_THRESHOLDS:
        if delay_s <= threshold:
            return grade
    return "F"


# ── Phase / cycle helpers ──────────────────────────────────────────────────

def _cycle_length(greens: dict[str, float]) -> float:
    return greens["ns_green"] + greens["e_green"] + greens["w_green"] + N_PHASES * CLEARANCE_S


def _phase_sequence(greens: dict[str, float]) -> list[tuple[str, float]]:
    return [
        ("ns_green", greens["ns_green"]),
        ("clearance", CLEARANCE_S),
        ("e_green", greens["e_green"]),
        ("clearance", CLEARANCE_S),
        ("w_green", greens["w_green"]),
        ("clearance", CLEARANCE_S),
    ]


def _phase_at(second: int, greens: dict[str, float]) -> str:
    cycle = _cycle_length(greens)
    pos = second % max(int(round(cycle)), 1)
    cursor = 0.0
    for phase, duration in _phase_sequence(greens):
        cursor += duration
        if pos < cursor:
            return phase
    return "clearance"


def _effective_green(greens: dict[str, float], direction: str) -> float:
    """Effective green time for a direction (including startup lost time of ~2s)."""
    for phase_name, dirs in PHASE_DIRECTIONS.items():
        if direction in dirs:
            raw = greens[phase_name]
            return max(0.0, raw - 2.0)  # startup lost time
    return 0.0


# ── HCM delay model ───────────────────────────────────────────────────────

def _hcm_delay(
    demand_veh_h: float,
    green_s: float,
    cycle_s: float,
    n_lanes: int,
    *,
    analysis_period_h: float = 0.25,
) -> dict[str, float]:
    """HCM 2010 Chapter 16 control delay model.

    Returns dict with d1 (uniform), d2 (incremental), total delay, v/c ratio, and LOS.
    """
    # Saturation flow for the approach
    s = SATURATION_FLOW_VEH_H_LANE * n_lanes  # veh/h for all lanes
    g_over_C = max(green_s, 0.001) / max(cycle_s, 1.0)

    # Capacity of approach
    c = s * g_over_C  # veh/h

    # Volume-to-capacity ratio
    X = demand_veh_h / max(c, 1.0)
    X_clamped = min(X, 1.5)  # prevent numerical explosion

    # d1: Uniform delay (HCM Eq. 16-11)
    if g_over_C >= 0.999:
        d1 = 0.0
    else:
        d1 = 0.5 * cycle_s * (1.0 - g_over_C) ** 2 / max(1.0 - min(X_clamped, 1.0) * g_over_C, 0.001)

    # d2: Incremental delay (HCM Eq. 16-12)
    T = analysis_period_h  # analysis period in hours
    k = 0.50   # incremental delay factor (pre-timed signals)
    I = 1.0    # upstream filtering factor (isolated intersection)
    inner = max((X_clamped - 1.0) ** 2 + 8 * k * I * X_clamped / (c * T), 0.0)
    d2 = 900.0 * T * (X_clamped - 1.0 + math.sqrt(inner))
    d2 = max(d2, 0.0)

    total = d1 + d2

    return {
        "d1_uniform_s": round(d1, 1),
        "d2_incremental_s": round(d2, 1),
        "total_delay_s": round(total, 1),
        "v_over_c": round(X, 3),
        "capacity_veh_h": round(c, 0),
        "saturation_flow_veh_h": round(s, 0),
        "effective_green_ratio": round(g_over_C, 3),
        "los": _los_grade(total),
    }


# ── Scenario engine ───────────────────────────────────────────────────────

def _initial_direction_state(live_state: dict[str, Any], direction: str) -> dict[str, Any]:
    metrics = live_state.get("metrics", {}).get(direction, {})
    demand = live_state.get("demand", {}).get(direction, {})
    google = live_state.get("google_snapshot", {}).get(direction, {})
    
    queue = float(metrics.get("queue_vehicles", 0.0) or 0.0)
    
    # Data Source Strategy: Google API -> YOLO Detectors -> Baseline
    source_name = "Unknown"
    if google and float(google.get("delay_s", 0)) > 0:
        base = {"northbound": 450, "southbound": 520, "eastbound": 380, "westbound": 300}.get(direction, 400)
        target_veh_h = base + (float(google.get("delay_s", 0)) * 2.5)
        source_name = "Google Maps API (Live)"
    elif float(demand.get("target_veh_h", metrics.get("flow_veh_h", 0)) or 0) > 0:
        target_veh_h = float(demand.get("target_veh_h", metrics.get("flow_veh_h", 0)))
        source_name = "YOLO Detectors (Live)"
    else:
        defaults = {"northbound": 450, "southbound": 520, "eastbound": 380, "westbound": 300}
        target_veh_h = float(defaults.get(direction, 400))
        source_name = "Historical Baseline"

    n_lanes = LANES_PER_APPROACH.get(direction, 2)
    storage = STORAGE_CAPACITY_VEH.get(direction, 25)
    sat_flow = SATURATION_FLOW_VEH_H_LANE * n_lanes
    return {
        "queue": max(queue, 0.0),
        "demand_veh_h": target_veh_h,
        "demand_vps": target_veh_h / 3600.0,       # vehicles per second
        "sat_flow_vps": sat_flow / 3600.0,          # saturation discharge rate
        "n_lanes": n_lanes,
        "storage": storage,
        "source_name": source_name,
    }


def _run_sumo_scenario(
    live_state: dict[str, Any],
    greens: dict[str, float],
    duration_s: int,
) -> dict[str, Any]:
    """Run a headless micro-simulation using SUMO for highly accurate delay and queue extraction."""
    if not traci:
        raise WhatIfValidationError("TraCI not installed or SUMO environment not configured.")
        
    config = load_live_config()
    sumo_binary = config["sumo"]["binary"]
    net_file = str(config["paths"]["network_net"])
    
    # Calculate target flows
    demand_veh_h = {}
    for d in DIRECTIONS:
        metrics = live_state.get("metrics", {}).get(d, {})
        flow = metrics.get("flow_veh_h", 0)
        demand = live_state.get("demand", {}).get(d, {})
        target = demand.get("target_veh_h", flow)
        if not target: target = 400
        demand_veh_h[d] = float(target)

    # Create temporary route file
    with tempfile.NamedTemporaryFile(suffix=".rou.xml", mode="w", delete=False) as f:
        rou_file = f.name
        f.write('<routes>\n')
        f.write('  <vType id="car" accel="2.6" decel="4.5" length="5.0" maxSpeed="20.0" />\n')
        
        # Accurate route paths from Wadi Saqra network manifest
        route_edges = {
            "northbound": "150999182#0 150999182#1",
            "southbound": "150999181-AddedOnRampEdge 150999181 150999181-AddedOffRampEdge 1376463188#0 1376463187#1",
            "eastbound": "1473593772#0 150999182#0 150999182#1 150999182#2 150999182#3 688983278 688515257#0",
            "westbound": "51270303#9 150999182#2 150999182#3 688983278 688515257#0 688515257#1 688514650 688515256#0 688515256#1"
        }
        
        for d in DIRECTIONS:
            edges = route_edges.get(d)
            if not edges:
                continue
            f.write(f'  <route id="route_{d}" edges="{edges}"/>\n')
            veh_per_s = demand_veh_h[d] / 3600.0
            total_veh = int(veh_per_s * duration_s)
            if total_veh > 0:
                f.write(f'  <flow id="flow_{d}" type="car" route="route_{d}" begin="0" end="{duration_s}" number="{total_veh}"/>\n')
        f.write('</routes>\n')

    label = f"whatif_{threading.get_ident()}_{int(random.random()*10000)}"
    cmd = [
        sumo_binary,
        "-n", net_file,
        "-r", rou_file,
        "--no-step-log", "true",
        "--step-length", "1.0",
    ]

    conn = None
    try:
        # Let TraCI allocate the port itself. Passing --remote-port here causes
        # duplicate-port errors and can trap the what-if job in repeated retries.
        try:
            traci.start(cmd, label=label, numRetries=1, doSwitch=False)
        except TypeError:
            try:
                traci.start(cmd, label=label, numRetries=1)
            except TypeError:
                traci.start(cmd, label=label)
        conn = traci.getConnection(label)

        tls_id = live_state.get("controller_tls_id", "cluster_10989299571_10989299572_10989299573_10989307263_#11more")
        if tls_id in conn.trafficlight.getIDList():
            conn.trafficlight.setProgram(tls_id, "0")

        delays = {d: [] for d in DIRECTIONS}
        queues = {d: [] for d in DIRECTIONS}
        waiting_times = {d: [] for d in DIRECTIONS}

        # Precise mapping from Wadi Saqra net.xml:
        # Phase 0: NS Green
        # Phase 4: E Green
        # Phase 8: W Green
        phase_order = [("ns_green", 0), ("e_green", 4), ("w_green", 8)]
        current_idx = 0
        phase_clock = 0.0

        snapshots = []

        # Warmup to populate the network
        warmup_s = 60
        for _ in range(warmup_s):
            conn.simulationStep()

        if tls_id in conn.trafficlight.getIDList():
            conn.trafficlight.setPhase(tls_id, phase_order[current_idx][1])
        for step in range(duration_s):
            # Advance override
            phase_clock += 1.0
            current_phase_name, _current_phase_idx = phase_order[current_idx]
            
            # Use candidate green times
            target_green = greens.get(current_phase_name, 35)
            if phase_clock > target_green:
                phase_clock = 0.0
                current_idx = (current_idx + 1) % len(phase_order)
                if tls_id in conn.trafficlight.getIDList():
                    next_phase = phase_order[current_idx][1]
                    conn.trafficlight.setPhase(tls_id, next_phase)
            
            conn.simulationStep()
            
            # Metrics collection
            for d in DIRECTIONS:
                q = 0
                wt = 0.0
                edges = route_edges.get(d, "").split()
                if edges:
                    for e in edges:
                        try:
                            q += conn.edge.getLastStepHaltingNumber(e)
                            # Average waiting time of vehicles on the edge
                            veh_ids = conn.edge.getLastStepVehicleIDs(e)
                            if veh_ids:
                                wt += sum(conn.vehicle.getWaitingTime(v) for v in veh_ids) / len(veh_ids)
                        except:
                            pass
                queues[d].append(q)
                waiting_times[d].append(wt)
                # HCM total delay includes both uniform and incremental. 
                # SUMO's waiting time is a good proxy for control delay.
                delays[d].append(wt)
                
            if step % 5 == 0 or step == duration_s - 1:
                snap_dirs = {}
                for d in DIRECTIONS:
                    snap_dirs[d] = {
                        "queue_vehicles": round(queues[d][-1] if queues[d] else 0, 1),
                        "queue_m": round((queues[d][-1] if queues[d] else 0) * VEHICLE_LENGTH_M, 1),
                        "active": (phase_order[current_idx][0] == "ns_green" and d in ["northbound", "southbound"]) or (phase_order[current_idx][0] == "e_green" and d == "eastbound") or (phase_order[current_idx][0] == "w_green" and d == "westbound")
                    }
                snapshots.append({
                    "t": step,
                    "phase": phase_order[current_idx][0],
                    "directions": snap_dirs,
                    "vehicles": []
                })

        # Aggregate
        res = {}
        total_vehicles_seen = 0
        total_delay = 0.0
        for d in DIRECTIONS:
            q_avg = sum(queues[d]) / max(len(queues[d]), 1)
            d_avg = sum(delays[d]) / max(len(delays[d]), 1)
            veh = int(demand_veh_h[d] * (duration_s / 3600.0))
            total_vehicles_seen += veh
            total_delay += d_avg * veh

            res[d] = {
                "avg_queue_m": round(q_avg * VEHICLE_LENGTH_M, 1),
                "max_queue_m": round(max(queues[d] or [0]) * VEHICLE_LENGTH_M, 1),
                "throughput_veh": veh, # approx
                "avg_delay_s": round(d_avg, 1),
                "los": _los_grade(d_avg),
                "end_queue_m": round((queues[d][-1] if queues[d] else 0) * VEHICLE_LENGTH_M, 1),
                "effective_green_s": round(_effective_green(greens, d), 1),
                "demand_veh_h": demand_veh_h[d],
                "n_lanes": LANES_PER_APPROACH.get(d, 2),
                "source_name": "SUMO Micro-Simulation (Headless)",
                "d1_uniform_s": 0,
                "d2_incremental_s": 0,
                "v_over_c": 0,
                "capacity_veh_h": 0,
            }

        avg_network = round(total_delay / max(total_vehicles_seen, 1), 1)

        return {
            "greens": greens,
            "cycle_s": round(_cycle_length(greens), 1),
            "avg_queue_m": round(sum(res[d]["avg_queue_m"] for d in DIRECTIONS), 1),
            "max_queue_m": round(max(res[d]["max_queue_m"] for d in DIRECTIONS), 1),
            "throughput_veh": total_vehicles_seen,
            "avg_delay_s": avg_network,
            "intersection_los": _los_grade(avg_network),
            "time_to_clear_s": duration_s,
            "spillback_events": [],
            "direction_breakdown": res,
            "vehicle_snapshots": snapshots,
            "safety_warnings": _safety_check(greens, _cycle_length(greens)),
        }
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass
        try:
            import os
            os.unlink(rou_file)
        except Exception:
            pass

def run_scenario(
    live_state: dict[str, Any],
    greens: dict[str, float],
    duration_s: int,
    *,
    seed: int = 42,
    engine: str = "math"
) -> dict[str, Any]:
    """Run a deterministic queue simulation with HCM delay model or Headless SUMO."""
    requested_engine = "sumo" if engine == "sumo" else "math"
    if engine == "sumo":
        import logging
        logger = logging.getLogger("SimulationLab")
        try:
            result = _run_sumo_scenario(live_state, greens, duration_s)
            result["engine_requested"] = requested_engine
            result["engine_used"] = "sumo"
            result["engine_label"] = ENGINE_LABELS["sumo"]
            result["engine_fallback_reason"] = None
            return result
        except Exception as e:
            logger.error(f"SUMO simulation failed, falling back to math model: {e}")
            fallback_reason = str(e)
    else:
        fallback_reason = None
            
    cycle_s = _cycle_length(greens)
    direction_state = {d: _initial_direction_state(live_state, d) for d in DIRECTIONS}
    queues = {d: direction_state[d]["queue"] for d in DIRECTIONS}
    delay_area = {d: 0.0 for d in DIRECTIONS}
    throughput = {d: 0.0 for d in DIRECTIONS}
    max_queue = {d: queues[d] for d in DIRECTIONS}
    spillbacks: list[dict[str, Any]] = []
    snapshots: list[dict[str, Any]] = []

    for second in range(duration_s):
        phase = _phase_at(second + seed % 3, greens)
        active = set(PHASE_DIRECTIONS.get(phase, ()))

        for d in DIRECTIONS:
            info = direction_state[d]
            # Arrivals: uniform arrival rate (demand / 3600 per second)
            queues[d] += info["demand_vps"]

            # Departures: only during green, at saturation flow rate
            if d in active:
                discharge = min(queues[d], info["sat_flow_vps"])
                queues[d] = max(0.0, queues[d] - discharge)
                throughput[d] += discharge

            # Track delay (vehicle-seconds in queue)
            delay_area[d] += queues[d]
            max_queue[d] = max(max_queue[d], queues[d])

            # Spillback detection
            if queues[d] > info["storage"]:
                if not spillbacks or spillbacks[-1].get("second") != second:
                    spillbacks.append({
                        "second": second,
                        "direction": d,
                        "queue_vehicles": round(queues[d], 1),
                    })

        # Snapshot every 5 seconds
        if second % 5 == 0 or second == duration_s - 1:
            snapshots.append({
                "t": second,
                "phase": phase,
                "directions": {
                    d: {
                        "queue_m": round(queues[d] * VEHICLE_LENGTH_M, 1),
                        "queue_vehicles": round(queues[d], 1),
                        "active": d in active,
                    }
                    for d in DIRECTIONS
                },
                "vehicles": _snapshot_vehicles(queues, active, second),
            })

    # ── Per-direction HCM analysis ────────────────────────────────────────
    direction_breakdown = {}
    for d in DIRECTIONS:
        info = direction_state[d]
        eff_green = _effective_green(greens, d)
        served = throughput[d]
        avg_queue_veh = delay_area[d] / max(duration_s, 1)

        # HCM delay model
        hcm = _hcm_delay(info["demand_veh_h"], eff_green, cycle_s, info["n_lanes"])

        direction_breakdown[d] = {
            "avg_queue_m": round(avg_queue_veh * VEHICLE_LENGTH_M, 1),
            "max_queue_m": round(max_queue[d] * VEHICLE_LENGTH_M, 1),
            "throughput_veh": round(served, 1),
            "avg_delay_s": hcm["total_delay_s"],
            "d1_uniform_s": hcm["d1_uniform_s"],
            "d2_incremental_s": hcm["d2_incremental_s"],
            "v_over_c": hcm["v_over_c"],
            "capacity_veh_h": hcm["capacity_veh_h"],
            "los": hcm["los"],
            "end_queue_m": round(queues[d] * VEHICLE_LENGTH_M, 1),
            "effective_green_s": round(eff_green, 1),
            "demand_veh_h": round(info["demand_veh_h"], 0),
            "n_lanes": info["n_lanes"],
            "source_name": info["source_name"],
        }

    # ── Intersection-level summary ────────────────────────────────────────
    total_delay_weighted = sum(
        direction_breakdown[d]["avg_delay_s"] * direction_state[d]["demand_veh_h"]
        for d in DIRECTIONS
    )
    total_demand = sum(direction_state[d]["demand_veh_h"] for d in DIRECTIONS)
    avg_delay_s = total_delay_weighted / max(total_demand, 1.0)
    avg_queue_m = sum(direction_breakdown[d]["avg_queue_m"] for d in DIRECTIONS)
    max_queue_m = max(direction_breakdown[d]["max_queue_m"] for d in DIRECTIONS)
    throughput_total = sum(direction_breakdown[d]["throughput_veh"] for d in DIRECTIONS)
    time_to_clear = next(
        (snap["t"] for snap in snapshots
         if sum(snap["directions"][d]["queue_vehicles"] for d in DIRECTIONS) <= 1.0),
        None,
    )

    # Intersection LOS (HCM weighted average delay)
    intersection_los = _los_grade(avg_delay_s)

    # Safety warnings
    safety_warnings = _safety_check(greens, cycle_s)

    return {
        "greens": greens,
        "cycle_s": round(cycle_s, 1),
        "avg_queue_m": round(avg_queue_m, 1),
        "max_queue_m": round(max_queue_m, 1),
        "throughput_veh": round(throughput_total, 1),
        "avg_delay_s": round(avg_delay_s, 1),
        "intersection_los": intersection_los,
        "time_to_clear_s": time_to_clear,
        "spillback_events": spillbacks[:20],
        "direction_breakdown": direction_breakdown,
        "vehicle_snapshots": snapshots,
        "safety_warnings": safety_warnings,
        "engine_requested": requested_engine,
        "engine_used": "math",
        "engine_label": ENGINE_LABELS["math"],
        "engine_fallback_reason": fallback_reason,
    }


def _safety_check(greens: dict[str, float], cycle_s: float) -> list[dict[str, str]]:
    """HCM / MUTCD safety validation."""
    warnings = []
    for phase_name, duration in greens.items():
        label = {"ns_green": "NS (شمال/جنوب)", "e_green": "E (شرق)", "w_green": "W (غرب)"}.get(phase_name, phase_name)
        if duration < MIN_GREEN_S:
            warnings.append({
                "severity": "CRITICAL",
                "message": f"⚠️ {label}: {duration}s أقل من الحد الأدنى ({MIN_GREEN_S}s). خطر على سلامة المشاة والسائقين.",
            })
        if duration < PED_CLEARANCE_S:
            warnings.append({
                "severity": "HIGH",
                "message": f"🚶 {label}: {duration}s أقل من وقت عبور المشاة ({PED_CLEARANCE_S}s).",
            })
    if cycle_s > MAX_CYCLE_S:
        warnings.append({
            "severity": "HIGH",
            "message": f"⏱ دورة الإشارة {cycle_s:.0f}s تتجاوز الحد الأقصى ({MAX_CYCLE_S}s). قد تسبب تأخير مفرط.",
        })
    if cycle_s < MIN_CYCLE_S:
        warnings.append({
            "severity": "MEDIUM",
            "message": f"⏱ دورة الإشارة {cycle_s:.0f}s أقل من الحد الأدنى ({MIN_CYCLE_S}s).",
        })
    return warnings


def _snapshot_vehicles(queues: dict[str, float], active: set[str], second: int) -> list[dict[str, Any]]:
    vehicles = []
    for direction, queue in queues.items():
        count = min(int(math.ceil(queue)), 24)
        for index in range(count):
            vehicles.append({
                "id": f"{direction}-{second}-{index}",
                "direction": direction,
                "progress": round((index + 1) / max(count + 1, 1), 3),
                "queued": direction not in active or index > 2,
            })
    return vehicles


# ── Comparison ─────────────────────────────────────────────────────────────

def compare_scenarios(baseline: dict[str, Any], candidate: dict[str, Any]) -> dict[str, Any]:
    comp = {
        "avg_queue_delta_m": round(candidate["avg_queue_m"] - baseline["avg_queue_m"], 1),
        "max_queue_delta_m": round(candidate["max_queue_m"] - baseline["max_queue_m"], 1),
        "throughput_delta_veh": round(candidate["throughput_veh"] - baseline["throughput_veh"], 1),
        "avg_delay_delta_s": round(candidate["avg_delay_s"] - baseline["avg_delay_s"], 1),
        "spillback_delta": len(candidate["spillback_events"]) - len(baseline["spillback_events"]),
        "los_baseline": baseline["intersection_los"],
        "los_candidate": candidate["intersection_los"],
    }
    # Per-direction comparison
    dir_comp = {}
    for d in DIRECTIONS:
        b = baseline["direction_breakdown"].get(d, {})
        c = candidate["direction_breakdown"].get(d, {})
        dir_comp[d] = {
            "delay_delta_s": round(c.get("avg_delay_s", 0) - b.get("avg_delay_s", 0), 1),
            "queue_delta_m": round(c.get("avg_queue_m", 0) - b.get("avg_queue_m", 0), 1),
            "los_baseline": b.get("los", "?"),
            "los_candidate": c.get("los", "?"),
            "vc_baseline": b.get("v_over_c", 0),
            "vc_candidate": c.get("v_over_c", 0),
        }
    comp["direction_comparison"] = dir_comp
    return comp


# ── Validation ─────────────────────────────────────────────────────────────

def _baseline_greens(live_state: dict[str, Any]) -> dict[str, float]:
    plan = live_state.get("signal_plan", {})
    applied = plan.get("applied_greens") or {}
    rec = live_state.get("signal_recommendation") or {}
    phases = rec.get("phases") or []
    by_label: dict[str, float] = {}
    for phase in phases:
        directions = set(phase.get("directions") or [])
        if {"northbound", "southbound"}.intersection(directions):
            by_label["ns_green"] = float(phase.get("current_green_s", phase.get("recommended_green_s", 35.0)))
        elif "eastbound" in directions:
            by_label["e_green"] = float(phase.get("current_green_s", phase.get("recommended_green_s", 25.0)))
        elif "westbound" in directions:
            by_label["w_green"] = float(phase.get("current_green_s", phase.get("recommended_green_s", 25.0)))
    return {
        "ns_green": float(applied.get("northbound", by_label.get("ns_green", DEFAULT_GREENS["ns_green"]))),
        "e_green": float(applied.get("eastbound", by_label.get("e_green", DEFAULT_GREENS["e_green"]))),
        "w_green": float(applied.get("westbound", by_label.get("w_green", DEFAULT_GREENS["w_green"]))),
    }


def validate_request(payload: dict[str, Any], live_state: dict[str, Any]) -> dict[str, Any]:
    baseline = _baseline_greens(live_state)
    greens = {
        "ns_green": float(payload.get("ns_green", baseline["ns_green"])),
        "e_green": float(payload.get("e_green", baseline["e_green"])),
        "w_green": float(payload.get("w_green", baseline["w_green"])),
    }
    for key, value in greens.items():
        if not 7.0 <= value <= 90.0:
            raise WhatIfValidationError(f"{key} must be between 7 and 90 seconds.")
    duration_s = int(payload.get("duration_s", 300))
    if not 30 <= duration_s <= 900:
        raise WhatIfValidationError("duration_s must be between 30 and 900 seconds.")
    warmup_s = int(payload.get("warmup_s", 0))
    if not 0 <= warmup_s <= 300:
        raise WhatIfValidationError("warmup_s must be between 0 and 300 seconds.")
    return {
        "baseline_greens": baseline,
        "candidate_greens": greens,
        "duration_s": duration_s,
        "warmup_s": warmup_s,
        "seed": int(payload.get("seed", 42)),
        "engine": payload.get("engine", "math"),
    }


# ── Entry point ────────────────────────────────────────────────────────────

def run_what_if(payload: dict[str, Any], live_state: dict[str, Any]) -> dict[str, Any]:
    request = validate_request(payload, live_state)
    baseline = run_scenario(live_state, request["baseline_greens"], request["duration_s"], seed=request["seed"], engine=request["engine"])
    candidate = run_scenario(live_state, request["candidate_greens"], request["duration_s"], seed=request["seed"], engine=request["engine"])
    return {
        "request": request,
        "baseline": baseline,
        "candidate": candidate,
        "comparison": compare_scenarios(baseline, candidate),
        "model": "hcm_2010_ch16_v2",
        "source_provenance": {
            "warm_start": "current live-state queue, demand, capacity, and signal timings",
            "baseline": "current applied green splits",
            "candidate": "operator-provided green splits",
            "delay_model": "HCM 2010 Chapter 16 (uniform + incremental)",
            "saturation_flow": f"{SATURATION_FLOW_VEH_H_LANE} veh/h/lane",
        },
    }


@dataclass
class WhatIfJobStore:
    jobs: dict[str, dict[str, Any]] = field(default_factory=dict)
    _counter: itertools.count = field(default_factory=lambda: itertools.count(1))
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def submit(self, payload: dict[str, Any], live_state: dict[str, Any]) -> dict[str, Any]:
        job_id = f"whatif_{next(self._counter)}_{uuid.uuid4().hex[:8]}"
        job = {"job_id": job_id, "status": "running", "created_at": time.time()}
        with self._lock:
            self.jobs[job_id] = job
        try:
            validate_request(payload, live_state)
        except WhatIfValidationError as exc:
            job.update({"status": "failed", "error": str(exc), "completed_at": time.time()})
            with self._lock:
                self.jobs[job_id] = job
            return dict(job)

        thread = threading.Thread(
            target=self._run_job,
            args=(job_id, deepcopy(payload), deepcopy(live_state)),
            daemon=True,
            name=f"whatif-{job_id}",
        )
        thread.start()
        return dict(job)

    def _run_job(self, job_id: str, payload: dict[str, Any], live_state: dict[str, Any]) -> None:
        try:
            result = run_what_if(payload, live_state)
            update = {"status": "completed", "result": result, "completed_at": time.time()}
        except WhatIfValidationError as exc:
            update = {"status": "failed", "error": str(exc), "completed_at": time.time()}
        except Exception as exc:  # noqa: BLE001
            update = {"status": "failed", "error": f"Simulation failed: {exc}", "completed_at": time.time()}
        with self._lock:
            if job_id in self.jobs:
                self.jobs[job_id].update(update)

    def get(self, job_id: str) -> dict[str, Any] | None:
        with self._lock:
            job = self.jobs.get(job_id)
            return dict(job) if job is not None else None
