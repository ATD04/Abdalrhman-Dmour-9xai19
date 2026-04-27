#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import logging
import math
import random
import subprocess
import sys
import threading
import time
from collections import deque
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any

from live_support import (
    DIRECTIONS,
    LIVE_SCENARIO_ROOT,
    SUMO_TOOLS,
    CoordConverter,
    GoogleTrafficFetcher,
    build_detector_fallback_snapshot,
    build_live_demand,
    build_live_network,
    format_direction_short,
    load_live_config,
    normalize_direction,
    now_iso,
    parse_lane_id,
    random_vehicle_type,
    rolling_rate,
    setup_logging,
    sumolib,
    write_json,
)

logger = logging.getLogger("its.engine")

if str(SUMO_TOOLS) not in sys.path:
    sys.path.append(str(SUMO_TOOLS))

import traci  # noqa: E402


class LiveSimulationEngine:
    def __init__(self, config: dict[str, Any], gui: bool = False) -> None:
        self.config = config
        self.gui = gui
        self.manifest = build_live_network(config)
        self.net = sumolib.net.readNet(str(config["paths"]["network_net"]))
        self.converter = CoordConverter(config["paths"]["network_net"])
        self._last_good_snapshot: dict[str, Any] | None = None

        # Data sources — composite layer with fallback chain (and optional fusion)
        try:
            from data_sources import build_data_source

            self.data_source = build_data_source(config)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Data source factory failed (%s); falling back to legacy path", exc)
            self.data_source = None

        # Legacy fields retained for compatibility — kept only as references for older
        # code paths; new flow uses self.data_source.
        self.fetcher = None
        self.detector_fallback = None
        service_account_path = config["paths"]["google_service_account"]
        if service_account_path and Path(service_account_path).exists():
            try:
                self.fetcher = GoogleTrafficFetcher(config)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Direct GoogleTrafficFetcher init failed: %s", exc)
        else:
            try:
                from live_support import DetectorCalibrator

                self.detector_fallback = DetectorCalibrator()
            except Exception:  # noqa: BLE001
                self.detector_fallback = None

        # Optional ML modules — instantiate lazily so the engine still runs without them
        self.forecaster = None
        self.anomaly_detector = None
        if config.get("forecasting", {}).get("enabled"):
            try:
                from forecasting.flow_forecaster import FlowForecaster

                self.forecaster = FlowForecaster.load_or_default(config)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Flow forecaster unavailable: %s", exc)
        if config.get("anomaly", {}).get("enabled"):
            try:
                from anomaly.detector import AnomalyDetector

                self.anomaly_detector = AnomalyDetector.load_or_default(config)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Anomaly detector unavailable: %s", exc)
        self._last_anomaly_run = 0.0
        self._last_anomaly_result: dict[str, Any] | None = None
        self._emissions_enabled = bool(config.get("emissions", {}).get("enabled", True))

        # Optional live video processor — start it now and attach to any VideoDataSource
        self.video_processor = None
        if config.get("live_video", {}).get("enabled"):
            try:
                from live_video.stream_processor import LiveVideoStreamProcessor

                self.video_processor = LiveVideoStreamProcessor(config)
                self.video_processor.start()
                # Attach to data sources that need it
                if self.data_source is not None:
                    for source in [self.data_source.primary, *self.data_source.fallbacks]:
                        if source.__class__.__name__ == "VideoDataSource":
                            source.attach(self.video_processor)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Live video processor not available: %s", exc)

        self.route_defs = self.manifest["routes"]
        self.remote_port = int(config["sumo"]["remote_port"])
        self.step_length = float(config["sumo"]["step_length_seconds"])
        self.real_time_step = float(config["simulation"]["real_time_step_seconds"])
        self.history_seconds = int(config["simulation"]["history_seconds"])
        self.flow_window = int(config["simulation"]["flow_rate_window_seconds"])
        self.vehicle_length_m = float(config["simulation"]["vehicle_length_meters"])
        self.queue_threshold = int(config["adaptive_signal"]["queue_threshold_vehicles"])
        self.max_extension = int(config["adaptive_signal"]["max_extension_seconds"])
        self.controller_tls_id = self.manifest["controller_tls_id"]
        self.adaptive_active = bool(config["adaptive_signal"]["enabled_on_start"])
        self.rng = random.Random(42)
        self.flow_events = {direction: deque() for direction in DIRECTIONS}
        self.inject_residual = {direction: 0.0 for direction in DIRECTIONS}
        self.history: deque[dict[str, Any]] = deque(maxlen=self.history_seconds)
        self.state_lock = threading.Lock()
        self.current_state: dict[str, Any] = {"status": "initializing", "wall_time": now_iso()}
        self.network_geometry = json.loads(config["paths"]["network_geometry"].read_text(encoding="utf-8"))
        self.traffic_snapshot: dict[str, Any] = {}
        self.demand_state: dict[str, Any] = {}
        self.state_version = 0
        self.vehicle_counter = 0
        self._process: subprocess.Popen[str] | None = None
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._direction_signal_indices: dict[str, list[int]] = {direction: [] for direction in DIRECTIONS}
        self._controller_lane_groups: dict[str, dict[str, Any]] = {}
        self._controller_phase_plan: dict[str, Any] = {"cycle_length_s": 0.0, "phases": []}
        self._phase_runtime: dict[str, Any] = {"phase": None, "started_at": 0.0, "extended_s": 0.0}
        self._latest_google_error: str | None = None
        # ── Adaptive timing state ────────────────────────────────
        # Tracks the currently applied green splits (vs field-plan defaults)
        self._applied_greens: dict[str, float] = {"northbound": 35.0, "southbound": 35.0, "eastbound": 35.0, "westbound": 35.0}
        self._applied_cycle_s: float = 120.0
        self._last_cycle_start: float = 0.0
        self._adaptive_program_applied: bool = False
        # ── Abnormal-stop tracker ────────────────────────────────
        # vehicle_id → {"stopped_since": float, "fired": bool}
        self._stop_tracker: dict[str, dict[str, Any]] = {}
        # ── Congestion-surge tracker ─────────────────────────────
        self._prev_google_delays: dict[str, float] = {d: 0.0 for d in DIRECTIONS}
        # ── Spillback sustain tracker ────────────────────────────
        self._spillback_since: dict[str, float] = {d: 0.0 for d in DIRECTIONS}
        self._spillback_fired: dict[str, bool] = {d: False for d in DIRECTIONS}
        # ── Performance: disk write throttle and pre-serialized cache
        # Default: write to disk every 10th publish_state (=~ 1 Hz at step_length=0.1)
        self._disk_write_every: int = int(config.get("simulation", {}).get("disk_write_every_n_steps", 10))
        self._current_state_json: str | None = None
        self._state_changed_event: threading.Event = threading.Event()

        # Phase 3 modules (optional)
        self.phase3_db = None
        self.event_manager = None
        self.health_monitor = None
        try:
            from phase3_database import Phase3Database
            from phase3_event_manager import EventManager
            from phase3_system_health import SystemHealthMonitor

            self.phase3_db = Phase3Database(config["paths"]["app_data"] / "phase3.db")
            self.event_manager = EventManager(self.phase3_db)
            self.health_monitor = SystemHealthMonitor(self.phase3_db)
            logger.info("Phase 3 modules initialized (database, event manager, health monitor)")
        except Exception as exc:  # noqa: BLE001
            logger.warning("Phase 3 modules unavailable: %s", exc)

    def refresh_inputs(self) -> None:
        snapshot: dict[str, Any] | None = None
        if self.data_source is not None:
            try:
                payload = self.data_source.fetch_snapshot(
                    self.manifest["simulation_center"],
                    self.config["google"]["probe_distance_meters"],
                )
                snapshot = payload.to_dict()
                self._latest_google_error = payload.error
            except Exception as exc:  # noqa: BLE001
                logger.warning("Composite data source failed: %s", exc)
                self._latest_google_error = str(exc)
                snapshot = None
        else:
            # Legacy path
            if self.fetcher:
                try:
                    snapshot = self.fetcher.fetch_snapshot(
                        self.manifest["simulation_center"],
                        self.config["google"]["probe_distance_meters"],
                    )
                    self._last_good_snapshot = snapshot
                    self._latest_google_error = None
                except Exception as exc:  # noqa: BLE001
                    self._latest_google_error = str(exc)
                    if self._last_good_snapshot:
                        snapshot = dict(self._last_good_snapshot)
                        snapshot["source"] = "google_routes_stale"
                        snapshot["stale_error"] = str(exc)
            else:
                self._latest_google_error = "No Google service-account file configured."

            if snapshot is None:
                if self.detector_fallback is not None:
                    snapshot = build_detector_fallback_snapshot(
                        self.config,
                        self.manifest["simulation_center"],
                        self.detector_fallback,
                    )
                else:
                    snapshot = self._build_neutral_snapshot()

        if snapshot is None:
            snapshot = self._build_neutral_snapshot()

        self.traffic_snapshot = snapshot
        self.demand_state = build_live_demand(self.config, snapshot)
        try:
            write_json(self.config["paths"]["traffic_snapshot"], snapshot)
            write_json(self.config["paths"]["demand_state"], self.demand_state)
        except Exception as exc:  # noqa: BLE001
            logger.debug("Failed to persist demand snapshot: %s", exc)

    def _build_neutral_snapshot(self) -> dict[str, Any]:
        """Return a snapshot with free-flow conditions when no Google data is available."""
        center = self.manifest["simulation_center"]
        approaches: dict[str, Any] = {}
        for direction in DIRECTIONS:
            approaches[direction] = {
                "origin": center,
                "destination": center,
                "distance_m": 1000,
                "duration_s": 120.0,
                "static_duration_s": 120.0,
                "delay_s": 0.0,
                "delay_ratio": 0.0,
                "avg_speed_kmh": 30.0,
                "free_flow_speed_kmh": 30.0,
                "speed_ratio": 0.85,
                "congestion_level": "light",
                "polyline": [],
                "traffic_segments": [],
                "normal_share": 0.85,
                "slow_share": 0.10,
                "jam_share": 0.05,
            }
        return {
            "timestamp": now_iso(),
            "source": "no_data",
            "center": center,
            "approaches": approaches,
            "error": self._latest_google_error or "No data source available.",
        }

    def _launch_sumo(self) -> None:
        binary = self.config["sumo"]["gui_binary"] if self.gui else self.config["sumo"]["binary"]
        cmd = [
            binary,
            "-c",
            str(self.config["paths"]["sumocfg"]),
            "--remote-port",
            str(self.remote_port),
            "--step-length",
            str(self.step_length),
            "--start",
            "true",
            "--time-to-teleport",
            "-1",
            "--quit-on-end",
            "false",
            "--no-step-log",
            "true",
        ]
        self._process = subprocess.Popen(
            cmd,
            cwd=str(LIVE_SCENARIO_ROOT),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            text=True,
        )
        for _ in range(30):
            try:
                traci.init(self.remote_port, host=self.config["sumo"]["host"])
                return
            except Exception:  # noqa: BLE001
                time.sleep(1)
        raise RuntimeError("Unable to connect to SUMO TraCI after 30 retries.")

    def _direction_for_lane(self, lane_id: str) -> str | None:
        parsed = parse_lane_id(lane_id)
        if parsed is None:
            return None
        edge_id, _ = parsed
        for direction, route_info in self.route_defs.items():
            if lane_id in route_info.get("monitor_lanes", []):
                return direction
            if edge_id == route_info["incoming_edge"] or edge_id in route_info["monitor_edges"]:
                return direction
        try:
            lane = self.net.getLane(lane_id)
            shape = lane.getShape()
        except Exception as exc:  # noqa: BLE001
            logger.debug("Lane shape lookup failed for %s: %s", lane_id, exc)
            shape = []
        if shape:
            mid_x = sum(point[0] for point in shape) / len(shape)
            mid_y = sum(point[1] for point in shape) / len(shape)
            try:
                center_x, center_y = self.net.convertLonLat2XY(
                    self.manifest["simulation_center"]["lon"],
                    self.manifest["simulation_center"]["lat"],
                )
                return normalize_direction(mid_x - center_x, mid_y - center_y)
            except Exception as exc:  # noqa: BLE001
                logger.debug("Center conversion failed: %s", exc)
        return None

    @staticmethod
    def _phase_kind(state_str: str) -> str:
        if any(char in {"y", "Y"} for char in state_str):
            return "yellow"
        if any(char in {"g", "G"} for char in state_str):
            return "green"
        return "red"

    def _phase_label(self, active_directions: list[str], kind: str) -> str:
        if not active_directions:
            return "All-stop clearance" if kind == "red" else "Lane clearance"
        title = " + ".join(direction.replace("bound", "").capitalize() for direction in active_directions)
        return f"{title} {kind}"

    def _signal_state_for_indices(self, state_str: str, indices: list[int]) -> str:
        if any(index < len(state_str) and state_str[index] in {"G", "g"} for index in indices):
            return "green"
        if any(index < len(state_str) and state_str[index] in {"Y", "y"} for index in indices):
            return "yellow"
        return "red"

    def _map_signal_indices(self) -> None:
        self._controller_lane_groups = {}
        try:
            controlled_links = traci.trafficlight.getControlledLinks(self.controller_tls_id)
        except traci.TraCIException as exc:
            logger.warning("Could not retrieve controlled links for %s: %s", self.controller_tls_id, exc)
            return
        direction_map = {direction: set() for direction in DIRECTIONS}
        for index, link_group in enumerate(controlled_links):
            for from_lane, to_lane, _via in link_group:
                direction = self._direction_for_lane(from_lane)
                if direction:
                    direction_map[direction].add(index)
                parsed = parse_lane_id(from_lane)
                if parsed is None:
                    logger.debug("Skipping malformed lane id: %s", from_lane)
                    continue
                edge_id, lane_index = parsed
                lane_group = self._controller_lane_groups.setdefault(
                    from_lane,
                    {
                        "lane_id": from_lane,
                        "edge_id": edge_id,
                        "lane_index": lane_index,
                        "direction": direction,
                        "link_indices": [],
                        "to_lanes": set(),
                        "controlled_movements": 0,
                    },
                )
                lane_group["direction"] = lane_group.get("direction") or direction
                lane_group["to_lanes"].add(to_lane)
                lane_group["controlled_movements"] = len(lane_group["to_lanes"])
                if index not in lane_group["link_indices"]:
                    lane_group["link_indices"].append(index)

        for group in self._controller_lane_groups.values():
            group["link_indices"] = sorted(group["link_indices"])
            group["to_lanes"] = sorted(group["to_lanes"])
        self._direction_signal_indices = {direction: sorted(values) for direction, values in direction_map.items()}

    def _load_controller_phase_plan(self) -> None:
        self._controller_phase_plan = {"cycle_length_s": 0.0, "phases": []}
        try:
            logics = traci.trafficlight.getAllProgramLogics(self.controller_tls_id)
        except traci.TraCIException:
            return
        if not logics:
            return

        logic = logics[0]
        phases: list[dict[str, Any]] = []
        cycle_length = 0.0
        for index, phase in enumerate(logic.getPhases()):
            state_str = phase.state
            duration_s = float(phase.duration)
            kind = self._phase_kind(state_str)
            active_directions = [
                direction
                for direction, indices in self._direction_signal_indices.items()
                if self._signal_state_for_indices(state_str, indices) == "green"
            ]
            phases.append(
                {
                    "index": index,
                    "duration_s": round(duration_s, 1),
                    "state": state_str,
                    "kind": kind,
                    "active_directions": active_directions,
                    "label": self._phase_label(active_directions, kind),
                }
            )
            cycle_length += duration_s

        self._controller_phase_plan = {
            "program_id": getattr(logic, "programID", None),
            "cycle_length_s": round(cycle_length, 1),
            "phases": phases,
        }

    def prepare(self) -> None:
        self.refresh_inputs()
        self._launch_sumo()
        for direction, route_info in self.route_defs.items():
            route_id = f"route_{direction}"
            if route_id not in traci.route.getIDList():
                traci.route.add(route_id, route_info["edges"])
        self._map_signal_indices()
        self._load_controller_phase_plan()
        self._set_state(
            {
                "status": "ready",
                "wall_time": now_iso(),
                "message": "SUMO live engine initialized.",
                "simulation_center": self.manifest["simulation_center"],
            }
        )

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self.prepare()
        self._thread = threading.Thread(target=self._run_loop, kwargs={"steps_limit": None}, daemon=True)
        self._thread.start()

    def _register_vehicle(self, direction: str, sim_time: float) -> None:
        route_id = f"route_{direction}"
        vehicle_type = random_vehicle_type(self.rng)
        vehicle_id = f"{direction[:2]}_{int(sim_time):06d}_{self.vehicle_counter:05d}"
        self.vehicle_counter += 1
        traci.vehicle.add(
            vehicle_id,
            route_id,
            typeID=vehicle_type,
            depart="now",
            departLane="best",
            departSpeed="max",
        )
        self.flow_events[direction].append(sim_time)

    def _inject_vehicles(self, sim_time: float) -> None:
        for direction in DIRECTIONS:
            rate = float(self.demand_state["demand"][direction]["target_veh_h"])
            self.inject_residual[direction] += rate * self.step_length / 3600.0
            while self.inject_residual[direction] >= 1.0:
                self._register_vehicle(direction, sim_time)
                self.inject_residual[direction] -= 1.0

    def _signals(self, sim_time: float) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        for tls_id in traci.trafficlight.getIDList():
            try:
                next_switch = traci.trafficlight.getNextSwitch(tls_id)
                entry: dict[str, Any] = {
                    "phase": traci.trafficlight.getPhase(tls_id),
                    "state": traci.trafficlight.getRedYellowGreenState(tls_id),
                    "remaining_s": round(max(0.0, next_switch - sim_time), 1),
                }
                # Attach map position so the frontend can pin it on the canvas
                try:
                    jx, jy = traci.junction.getPosition(tls_id)
                    jlat, jlon = self.converter.xy_to_latlon(jx, jy)
                    entry["lat"] = round(jlat, 6)
                    entry["lon"] = round(jlon, 6)
                except Exception:  # noqa: BLE001
                    if tls_id == self.controller_tls_id:
                        entry["lat"] = self.manifest["simulation_center"]["lat"]
                        entry["lon"] = self.manifest["simulation_center"]["lon"]
                payload[tls_id] = entry
            except traci.TraCIException:
                continue
        return payload

    def _update_phase_runtime(self, phase_index: int, sim_time: float) -> None:
        if self._phase_runtime["phase"] != phase_index:
            self._phase_runtime = {
                "phase": phase_index,
                "started_at": sim_time,
                "extended_s": 0.0,
            }

    def _lane_metrics(self, signals: dict[str, Any]) -> dict[str, dict[str, Any]]:
        lane_metrics: dict[str, dict[str, Any]] = {}
        controller_state = signals.get(self.controller_tls_id, {}).get("state", "")
        for direction, route_info in self.route_defs.items():
            for lane_id in route_info.get("monitor_lanes", []):
                try:
                    vehicle_count = traci.lane.getLastStepVehicleNumber(lane_id)
                    halting = traci.lane.getLastStepHaltingNumber(lane_id)
                    occupancy = traci.lane.getLastStepOccupancy(lane_id)
                    avg_speed_ms = max(0.0, traci.lane.getLastStepMeanSpeed(lane_id)) if vehicle_count else 0.0
                except traci.TraCIException:
                    continue

                signal_group = self._controller_lane_groups.get(lane_id, {})
                link_indices = signal_group.get("link_indices", [])
                parsed = parse_lane_id(lane_id)
                if parsed is None:
                    logger.debug("Skipping malformed lane id in metrics: %s", lane_id)
                    continue
                edge_id, lane_index = parsed
                lane_metrics[lane_id] = {
                    "lane_id": lane_id,
                    "edge_id": edge_id,
                    "direction": direction,
                    "lane_index": lane_index,
                    "vehicle_count": vehicle_count,
                    "queue_vehicles": halting,
                    "queue_m": round(halting * self.vehicle_length_m, 1),
                    "avg_speed_ms": round(avg_speed_ms, 2),
                    "avg_speed_kmh": round(avg_speed_ms * 3.6, 1),
                    "occupancy_pct": round(occupancy, 1),
                    "signal_state": self._signal_state_for_indices(controller_state, link_indices) if link_indices else "unknown",
                    "controlled_movements": len(signal_group.get("to_lanes", [])),
                }
        return lane_metrics

    def _metrics(self, sim_time: float, lane_metrics: dict[str, dict[str, Any]]) -> dict[str, Any]:
        metrics: dict[str, Any] = {}
        for direction, route_info in self.route_defs.items():
            direction_lanes = [lane_metrics[lane_id] for lane_id in route_info.get("monitor_lanes", []) if lane_id in lane_metrics]
            halting = sum(item["queue_vehicles"] for item in direction_lanes)
            occupancy = sum(item["occupancy_pct"] for item in direction_lanes)
            vehicles = sum(item["vehicle_count"] for item in direction_lanes)
            speed_sum = sum(item["avg_speed_ms"] * item["vehicle_count"] for item in direction_lanes)
            avg_speed_ms = speed_sum / vehicles if vehicles else 0.0
            flow_veh_h = rolling_rate(self.flow_events[direction], self.flow_window, sim_time)
            google_live = self.traffic_snapshot.get("approaches", {}).get(direction, {})
            metrics[direction] = {
                "lane_count": len(direction_lanes),
                "vehicles_on_approach": vehicles,
                "queue_vehicles": halting,
                "queue_m": round(halting * self.vehicle_length_m, 1),
                "avg_speed_ms": round(avg_speed_ms, 2),
                "avg_speed_kmh": round(avg_speed_ms * 3.6, 1),
                "occupancy_pct": round(occupancy / max(len(direction_lanes), 1), 1),
                "density": round(clamp((occupancy / max(len(direction_lanes), 1)) / 100.0, 0.0, 1.0), 3),
                "queue_lane_count": sum(1 for item in direction_lanes if item["queue_vehicles"] > 0),
                "green_lane_count": sum(1 for item in direction_lanes if item["signal_state"] == "green"),
                "flow_veh_h": round(flow_veh_h, 1),
                "target_veh_h": float(self.demand_state["demand"][direction]["target_veh_h"]),
                "google_delay_s": round(float(google_live.get("delay_s", 0.0)), 1),
                "google_speed_kmh": round(float(google_live.get("avg_speed_kmh", 0.0)), 1),
            }
        return metrics

    # ── Webster's signal timing optimizer ───────────────────────
    # Implements 3-phase Webster (1958) calibrated to the Wadi Saqra
    # field plan: Phase A = NS (north + south together), Phase B = East,
    # Phase C = West.  Uses HCM flow ratios with a queue-proxy fallback
    # so the recommendation remains meaningful when an approach is on red.
    _SATURATION_VEH_MIN_LANE = 30.0   # HCM default: 1800 veh/h/lane
    _LANE_COUNT = 2
    _YELLOW_S = 3.0
    _ALL_RED_S = 2.0
    _N_PHASES = 3
    # HCM-based safety minimums (critical for government deployment)
    _MIN_GREEN_VEHICLE_S = 7.0        # HCM 2010 minimum green for vehicles
    _MIN_GREEN_PEDESTRIAN_S = 7.0     # minimum pedestrian walk interval
    _MIN_GREEN_S = 7.0                # absolute minimum green (whichever mode)
    _MAX_GREEN_S = 90.0
    _CURRENT_CYCLE_S = 120.0          # observed Wadi Saqra field cycle
    _CURRENT_GREENS = {"northbound": 35.0, "southbound": 35.0, "eastbound": 35.0, "westbound": 35.0}

    @staticmethod
    def _uniform_delay(C: float, g: float, y: float) -> float:
        """Webster uniform delay — HCM Eq. 16-9 (uniform term only)."""
        if g <= 0 or C <= 0:
            return 999.0
        x = min(0.98, y * C / g)
        numerator = 0.5 * C * (1.0 - g / C) ** 2
        return numerator / max(1.0 - x, 0.001)

    def _webster_recommendation(
        self, metrics: dict[str, Any], demand_state: dict[str, Any]
    ) -> dict[str, Any]:
        lost_time = self._N_PHASES * (self._YELLOW_S + self._ALL_RED_S)  # = 15 s
        capacity = self._SATURATION_VEH_MIN_LANE * self._LANE_COUNT      # = 60 veh/min
        ud = self._uniform_delay  # shorthand

        # Use currently applied greens (adaptive or field-plan)
        cur_ns = self._applied_greens.get("northbound", 35.0)
        cur_e = self._applied_greens.get("eastbound", 35.0)
        cur_w = self._applied_greens.get("westbound", 35.0)
        cur_cycle = self._applied_cycle_s

        def arrival_rate(direction: str) -> float:
            m = metrics[direction]
            flow = m["flow_veh_h"] / 60.0
            queue_proxy = m["queue_vehicles"] * 60.0 / max(cur_cycle, 1.0)
            return max(flow, queue_proxy, 0.01)

        def flow_ratio(direction: str) -> float:
            return clamp(arrival_rate(direction) / capacity, 0.02, 0.95)

        # Critical flow ratio per phase
        y_ns = max(flow_ratio("northbound"), flow_ratio("southbound"))
        y_e = flow_ratio("eastbound")
        y_w = flow_ratio("westbound")
        Y = y_ns + y_e + y_w

        # Current plan delays — always computed (used in all return paths)
        d_ns_cur = ud(cur_cycle, cur_ns, y_ns)
        d_e_cur  = ud(cur_cycle, cur_e, y_e)
        d_w_cur  = ud(cur_cycle, cur_w, y_w)
        current_delay_avg = round((d_ns_cur + d_e_cur + d_w_cur) / 3.0, 2)

        def _base_phases(g_ns: float, g_e: float, g_w: float) -> list[dict[str, Any]]:
            def imp(cur: float, rec: float) -> float:
                return round((rec - cur) / max(cur, 1.0) * 100.0, 1)
            return [
                {"label": "North + South", "directions": ["northbound", "southbound"],
                 "current_green_s": round(cur_ns, 1), "recommended_green_s": round(g_ns, 1),
                 "flow_ratio": round(y_ns, 3), "improvement_pct": imp(cur_ns, g_ns)},
                {"label": "East", "directions": ["eastbound"],
                 "current_green_s": round(cur_e, 1), "recommended_green_s": round(g_e, 1),
                 "flow_ratio": round(y_e, 3), "improvement_pct": imp(cur_e, g_e)},
                {"label": "West", "directions": ["westbound"],
                 "current_green_s": round(cur_w, 1), "recommended_green_s": round(g_w, 1),
                 "flow_ratio": round(y_w, 3), "improvement_pct": imp(cur_w, g_w)},
            ]

        # Over-capacity guard (Y > 0.95) — Webster delay model becomes unstable
        if Y >= 0.95:
            return {
                "mode": "over_capacity",
                "cycle_s": round(cur_cycle, 1),
                "lost_time_s": round(lost_time, 1),
                "flow_ratio_total": round(Y, 3),
                "y_ns": round(y_ns, 3), "y_e": round(y_e, 3), "y_w": round(y_w, 3),
                "Y_saturated": True,
                "delay_reduction_pct": 0.0,
                "current_delay_s_veh": current_delay_avg,
                "recommended_delay_s_veh": current_delay_avg,
                "phases": _base_phases(cur_ns, cur_e, cur_w),
                "saturation_warning": (
                    f"Demand exceeds capacity (Y={Y:.2f} ≥ 0.95). Webster optimization is not applicable; "
                    "consider demand-management or upstream metering."
                ),
            }

        # Near-saturation guard
        if Y >= 0.85:
            return {
                "mode": "saturated",
                "cycle_s": round(cur_cycle, 1),
                "lost_time_s": round(lost_time, 1),
                "flow_ratio_total": round(Y, 3),
                "y_ns": round(y_ns, 3), "y_e": round(y_e, 3), "y_w": round(y_w, 3),
                "Y_saturated": True,
                "delay_reduction_pct": 0.0,
                "current_delay_s_veh": current_delay_avg,
                "recommended_delay_s_veh": current_delay_avg,
                "phases": _base_phases(cur_ns, cur_e, cur_w),
                "saturation_warning": "Intersection is near or above capacity. Maintaining current plan.",
            }

        # Optimal Webster cycle
        C_o = clamp((1.5 * lost_time + 5.0) / max(1.0 - Y, 0.01), 60.0, 180.0)
        g_eff = C_o - lost_time

        # Green splits
        g_ns = clamp((y_ns / Y) * g_eff, self._MIN_GREEN_S, self._MAX_GREEN_S)
        g_e  = clamp((y_e  / Y) * g_eff, self._MIN_GREEN_S, self._MAX_GREEN_S)
        g_w  = clamp((y_w  / Y) * g_eff, self._MIN_GREEN_S, self._MAX_GREEN_S)
        total_g = g_ns + g_e + g_w
        if total_g > 0:
            scale = g_eff / total_g
            g_ns = clamp(g_ns * scale, self._MIN_GREEN_S, self._MAX_GREEN_S)
            g_e  = clamp(g_e  * scale, self._MIN_GREEN_S, self._MAX_GREEN_S)
            g_w  = clamp(g_w  * scale, self._MIN_GREEN_S, self._MAX_GREEN_S)

        # Recommended delays
        d_ns_rec = ud(C_o, g_ns, y_ns)
        d_e_rec  = ud(C_o, g_e,  y_e)
        d_w_rec  = ud(C_o, g_w,  y_w)
        recommended_delay_avg = round((d_ns_rec + d_e_rec + d_w_rec) / 3.0, 2)
        d_cur = d_ns_cur + d_e_cur + d_w_cur
        d_rec = d_ns_rec + d_e_rec + d_w_rec

        # Guard #2: recommendation worse than current
        if d_rec >= d_cur:
            return {
                "mode": "field_plan_optimal",
                "cycle_s": round(cur_cycle, 1),
                "lost_time_s": round(lost_time, 1),
                "flow_ratio_total": round(Y, 3),
                "y_ns": round(y_ns, 3), "y_e": round(y_e, 3), "y_w": round(y_w, 3),
                "Y_saturated": False,
                "delay_reduction_pct": 0.0,
                "current_delay_s_veh": current_delay_avg,
                "recommended_delay_s_veh": current_delay_avg,
                "phases": _base_phases(cur_ns, cur_e, cur_w),
                "saturation_warning": None,
            }

        delay_reduction_pct = round(100.0 * (d_cur - d_rec) / max(d_cur, 1.0), 1)

        return {
            "mode": "three_phase",
            "cycle_s": round(C_o, 1),
            "lost_time_s": round(lost_time, 1),
            "flow_ratio_total": round(Y, 3),
            "y_ns": round(y_ns, 3), "y_e": round(y_e, 3), "y_w": round(y_w, 3),
            "Y_saturated": False,
            "delay_reduction_pct": delay_reduction_pct,
            "current_delay_s_veh": current_delay_avg,
            "recommended_delay_s_veh": recommended_delay_avg,
            "phases": _base_phases(g_ns, g_e, g_w),
            "saturation_warning": None,
        }

    def _insights(self, metrics: dict[str, Any], sim_time: float, vehicle_ids: list[str] | None = None) -> dict[str, Any]:
        dominant_direction = max(DIRECTIONS, key=lambda direction: metrics[direction]["queue_m"])
        google_direction = max(DIRECTIONS, key=lambda direction: self.traffic_snapshot["approaches"][direction]["delay_s"])
        total_queue = sum(metrics[direction]["queue_m"] for direction in DIRECTIONS)
        avg_network_speed = sum(metrics[direction]["avg_speed_kmh"] for direction in DIRECTIONS) / len(DIRECTIONS)
        events: list[dict[str, Any]] = []

        # Current signal state for green-phase checks
        controller_signal = None
        try:
            if traci.isLoaded() and self.controller_tls_id in traci.trafficlight.getIDList():
                phase_idx = traci.trafficlight.getPhase(self.controller_tls_id)
                phase_meta = next(
                    (p for p in self._controller_phase_plan.get("phases", []) if p["index"] == phase_idx),
                    None,
                )
                controller_signal = phase_meta
        except Exception:  # noqa: BLE001
            pass

        green_directions: set[str] = set()
        if controller_signal and controller_signal.get("kind") == "green":
            green_directions = set(controller_signal.get("active_directions", []))

        for direction in DIRECTIONS:
            google = self.traffic_snapshot["approaches"][direction]
            metric = metrics[direction]

            # ── 1. Queue Spillback ─────────────────────────────────
            if metric["queue_vehicles"] >= self.queue_threshold:
                if self._spillback_since[direction] == 0.0:
                    self._spillback_since[direction] = sim_time
                    self._spillback_fired[direction] = False
                sustained_s = sim_time - self._spillback_since[direction]
                if sustained_s >= 10.0 and not self._spillback_fired[direction]:
                    self._spillback_fired[direction] = True
                    q_m = metric["queue_m"]
                    events.append({
                        "type": "spillback",
                        "severity": "critical",
                        "direction": direction,
                        "message": f"Queue spillback detected on the {direction.replace('bound', '')} approach — {metric['queue_vehicles']} vehicles backed up ({round(q_m)} m).",
                        "tip": "Consider extending the green phase for this approach or checking for downstream blockage.",
                    })
            else:
                self._spillback_since[direction] = 0.0
                self._spillback_fired[direction] = False

            # ── 2. Congestion Surge (Google delay jump) ────────────
            prev_delay = self._prev_google_delays.get(direction, 0.0)
            curr_delay = float(google.get("delay_s", 0.0))
            if curr_delay - prev_delay > 30.0 and curr_delay > 60.0:
                events.append({
                    "type": "congestion_surge",
                    "severity": "warning",
                    "direction": direction,
                    "message": f"Google detected a sudden congestion surge on the {direction.replace('bound', '')} corridor — delay jumped +{round(curr_delay - prev_delay)}s.",
                    "tip": "Monitor this approach for queue spill-over into the junction. Avoid green extension here until upstream clears.",
                })
            self._prev_google_delays[direction] = curr_delay

            # ── 3. Heavy Google Congestion Alert ──────────────────
            if google["congestion_level"] in {"heavy", "severe"}:
                events.append({
                    "type": "heavy_congestion",
                    "severity": "high" if google["congestion_level"] == "severe" else "medium",
                    "direction": direction,
                    "message": f"Google reports {google['congestion_level']} inbound conditions from the {direction.replace('bound', '')} side (+{round(curr_delay)}s delay).",
                    "tip": "Increase demand estimate for this approach and consider pre-emptive green time allocation.",
                })

        # ── 4. Abnormal Stop Detection (SUMO vehicles) ─────────────
        # Only flag vehicles stopped during a *green* phase for *their own* direction —
        # this excludes vehicles legitimately stopped at red lights.
        try:
            if traci.isLoaded() and green_directions:
                ids_iter = vehicle_ids if vehicle_ids is not None else list(traci.vehicle.getIDList())
                for vid in ids_iter:
                    try:
                        route_id = traci.vehicle.getRouteID(vid)
                        direction = next((d for d in DIRECTIONS if route_id == f"route_{d}"), None)
                        if direction is None or direction not in green_directions:
                            # Reset tracker because the vehicle isn't expected to move (red phase)
                            if vid in self._stop_tracker:
                                del self._stop_tracker[vid]
                            continue
                        speed_ms = traci.vehicle.getSpeed(vid)
                        if speed_ms < 0.3:
                            entry = self._stop_tracker.setdefault(vid, {"stopped_since": sim_time, "fired": False})
                            stopped_s = sim_time - entry["stopped_since"]
                            if stopped_s >= 8.0 and not entry["fired"]:
                                entry["fired"] = True
                                events.append({
                                    "type": "abnormal_stop",
                                    "severity": "warning",
                                    "direction": direction,
                                    "message": (
                                        f"Abnormal stop: track {vid.split('_')[0].upper()} remained stationary "
                                        f"in the {format_direction_short(direction)} approach during a green phase."
                                    ),
                                    "tip": "Inspect the stationary vehicle and verify whether it is blocking discharge from the junction.",
                                })
                        else:
                            if vid in self._stop_tracker:
                                del self._stop_tracker[vid]
                    except traci.TraCIException as exc:
                        logger.debug("Vehicle %s telemetry failed: %s", vid, exc)
                        continue
                # Prune stale IDs (use cached list if provided to avoid extra TraCI roundtrip)
                if vehicle_ids is not None:
                    active_ids = set(vehicle_ids)
                else:
                    active_ids = set(traci.vehicle.getIDList())
                self._stop_tracker = {k: v for k, v in self._stop_tracker.items() if k in active_ids}
        except Exception as exc:  # noqa: BLE001
            logger.debug("Abnormal-stop detection error: %s", exc)

        # Build primary recommendation text from the most severe event or defaults
        if any(e["type"] == "spillback" for e in events):
            spill_dir = next(e["direction"] for e in events if e["type"] == "spillback")
            recommendation = (
                f"PRIORITY: Extend green on the {spill_dir.replace('bound', '')} approach immediately — "
                f"queue spillback is active and blocking junction discharge."
            )
        elif any(e["type"] == "abnormal_stop" for e in events):
            stop_dir = next(e["direction"] for e in events if e["type"] == "abnormal_stop")
            recommendation = (
                f"Investigate stationary vehicle on the {stop_dir.replace('bound', '')} approach — "
                f"it may be blocking signal discharge during the green phase."
            )
        else:
            recommendation = (
                f"Prioritize the {dominant_direction.replace('bound', '')} approach: it has the longest simulated queue, "
                f"while Google shows the strongest travel-time penalty on the {google_direction.replace('bound', '')} corridor."
            )

        return {
            "dominant_queue_direction": dominant_direction,
            "google_delay_direction": google_direction,
            "total_queue_m": round(total_queue, 1),
            "avg_network_speed_kmh": round(avg_network_speed, 1),
            "events": events,
            "recommendation": recommendation,
        }

    def _controller_signal_plan(
        self,
        sim_time: float,
        signals: dict[str, Any],
        lane_metrics: dict[str, dict[str, Any]],
    ) -> dict[str, Any]:
        controller_signal = signals.get(self.controller_tls_id)
        if not controller_signal:
            return {}

        phase_index = int(controller_signal["phase"])
        self._update_phase_runtime(phase_index, sim_time)
        phase_meta = next(
            (phase for phase in self._controller_phase_plan.get("phases", []) if phase["index"] == phase_index),
            {
                "index": phase_index,
                "duration_s": controller_signal.get("remaining_s", 0.0),
                "state": controller_signal.get("state", ""),
                "kind": self._phase_kind(controller_signal.get("state", "")),
                "active_directions": [],
                "label": "Signal phase",
            },
        )

        groups = []
        for lane_id, lane_group in sorted(
            self._controller_lane_groups.items(),
            key=lambda item: ((item[1].get("direction") or "zzz"), item[1]["lane_index"]),
        ):
            lane_metric = lane_metrics.get(lane_id, {})
            direction = lane_group.get("direction")
            groups.append(
                {
                    "lane_id": lane_id,
                    "direction": direction,
                    "lane_index": lane_group["lane_index"],
                    "label": f"Lane {lane_group['lane_index'] + 1}",
                    "signal_state": self._signal_state_for_indices(controller_signal["state"], lane_group["link_indices"]),
                    "queue_m": lane_metric.get("queue_m", 0.0),
                    "queue_vehicles": lane_metric.get("queue_vehicles", 0),
                    "vehicle_count": lane_metric.get("vehicle_count", 0),
                    "avg_speed_kmh": lane_metric.get("avg_speed_kmh", 0.0),
                    "controlled_movements": lane_group.get("controlled_movements", len(lane_group["to_lanes"])),
                    "link_indices": lane_group["link_indices"],
                }
            )

        return {
            "tls_id": self.controller_tls_id,
            "phase_index": phase_index,
            "phase_label": phase_meta["label"],
            "phase_kind": phase_meta["kind"],
            "phase_duration_s": phase_meta["duration_s"],
            "remaining_s": controller_signal["remaining_s"],
            "elapsed_s": round(sim_time - float(self._phase_runtime["started_at"]), 1),
            "extension_applied_s": round(float(self._phase_runtime["extended_s"]), 1),
            "cycle_length_s": self._controller_phase_plan.get("cycle_length_s", 0.0),
            "active_directions": phase_meta.get("active_directions", []),
            "phases": self._controller_phase_plan.get("phases", []),
            "groups": groups,
            "adaptive_applied": self._adaptive_program_applied,
            "applied_greens": self._applied_greens,
            "applied_cycle_s": self._applied_cycle_s,
            "countdown_s": round(max(0.0, controller_signal["remaining_s"]), 0),
        }

    def _vehicles(self, vehicle_ids: list[str] | None = None) -> list[dict[str, Any]]:
        payload: list[dict[str, Any]] = []
        ids_iter = vehicle_ids if vehicle_ids is not None else traci.vehicle.getIDList()
        for vehicle_id in ids_iter:
            try:
                x, y = traci.vehicle.getPosition(vehicle_id)
                lat, lon = self.converter.xy_to_latlon(x, y)
                speed_ms = traci.vehicle.getSpeed(vehicle_id)
                lane_id = traci.vehicle.getLaneID(vehicle_id)
                route_id = traci.vehicle.getRouteID(vehicle_id)
                direction = next((candidate for candidate in DIRECTIONS if route_id == f"route_{candidate}"), None)
                payload.append(
                    {
                        "id": vehicle_id,
                        "lat": round(lat, 6),
                        "lon": round(lon, 6),
                        "speed_ms": round(speed_ms, 2),
                        "speed_kmh": round(speed_ms * 3.6, 1),
                        "heading_deg": round(traci.vehicle.getAngle(vehicle_id), 1),
                        "lane_id": lane_id,
                        "direction": direction,
                        "type": traci.vehicle.getTypeID(vehicle_id),
                    }
                )
            except traci.TraCIException as exc:
                logger.debug("Vehicle %s position read failed: %s", vehicle_id, exc)
                continue
        return payload

    def _video_priority_boost(self, direction: str) -> float:
        """Add a priority boost when YOLO observes buses or heavy pedestrian flow.

        Returns the score delta. Used to grant green-time extension to public-transit
        approaches and to discourage cutting short a phase that has many people waiting.
        """
        if self.video_processor is None or not self.video_processor.is_running():
            return 0.0
        try:
            stats = self.video_processor.get_per_direction_stats()
        except Exception:  # noqa: BLE001
            return 0.0
        bucket = stats.get(direction, {})
        bus_boost = float(bucket.get("bus_count", 0)) * 3.0    # each detected bus = 3 vehicle units
        truck_boost = float(bucket.get("truck_count", 0)) * 1.5
        pedestrian_boost = min(4.0, float(bucket.get("person_count", 0)) * 0.5)
        return bus_boost + truck_boost + pedestrian_boost

    def _apply_adaptive_control(self, metrics: dict[str, Any], signals: dict[str, Any], sim_time: float) -> None:
        """Apply Webster-optimized signal timing to SUMO when adaptive mode is ON.

        Strategy:
        - At each new cycle start (phase 0 transition), compute Webster green splits
        - Reprogram SUMO TLS phases with the recommended durations
        - Enforce HCM minimum green times (7s vehicles, 3s yellow, 2s all-red)
        - If adaptive is OFF, restore field-plan defaults
        """
        if self.controller_tls_id not in signals:
            return

        signal = signals[self.controller_tls_id]
        phase_index = int(signal["phase"])
        self._update_phase_runtime(phase_index, sim_time)

        if not self.adaptive_active:
            # Restore field plan if we previously applied adaptive timings
            if self._adaptive_program_applied:
                self._restore_field_plan()
            return

        # Detect cycle restart: phase 0 has just started
        phase_meta = next(
            (phase for phase in self._controller_phase_plan.get("phases", []) if phase["index"] == phase_index),
            None,
        )
        if phase_meta is None:
            return

        # Only reprogram at the start of a new cycle (when phase 0 begins)
        cycle_just_started = (
            phase_index == 0
            and self._phase_runtime.get("started_at", 0.0) == sim_time
        )

        if not cycle_just_started:
            # Mid-cycle: still allow minor extensions for queue-based adaptive hold
            self._apply_queue_extension(metrics, signals, sim_time, phase_meta)
            return

        # New cycle: compute Webster and apply
        rec = self._webster_recommendation(metrics, self.demand_state)
        if rec["mode"] not in ("three_phase",):
            # Saturated or field-plan-optimal: keep current program
            return

        # Extract recommended greens per phase
        ns_green = max(self._MIN_GREEN_S, rec["phases"][0].get("recommended_green_s", 35.0))
        e_green = max(self._MIN_GREEN_S, rec["phases"][1].get("recommended_green_s", 35.0))
        w_green = max(self._MIN_GREEN_S, rec["phases"][2].get("recommended_green_s", 35.0))

        # Apply to SUMO TLS
        try:
            logics = traci.trafficlight.getAllProgramLogics(self.controller_tls_id)
            if not logics:
                return
            logic = logics[0]
            phases = list(logic.getPhases())
            # Map phase indices to green durations: identify green phases by their kind
            green_durations = [ns_green, e_green, w_green]
            green_idx = 0
            for i, phase in enumerate(phases):
                kind = self._phase_kind(phase.state)
                if kind == "green" and green_idx < len(green_durations):
                    phases[i] = traci.trafficlight.Phase(
                        duration=green_durations[green_idx],
                        state=phase.state,
                        minDur=self._MIN_GREEN_S,
                        maxDur=self._MAX_GREEN_S,
                    )
                    green_idx += 1
                elif kind == "yellow":
                    phases[i] = traci.trafficlight.Phase(
                        duration=self._YELLOW_S,
                        state=phase.state,
                    )
                elif kind == "red":
                    phases[i] = traci.trafficlight.Phase(
                        duration=self._ALL_RED_S,
                        state=phase.state,
                    )

            new_logic = traci.trafficlight.Logic(
                programID="adaptive",
                type=0,
                currentPhaseIndex=0,
                phases=phases,
            )
            traci.trafficlight.setProgramLogic(self.controller_tls_id, new_logic)
            traci.trafficlight.setProgram(self.controller_tls_id, "adaptive")

            self._applied_greens = {
                "northbound": round(ns_green, 1),
                "southbound": round(ns_green, 1),
                "eastbound": round(e_green, 1),
                "westbound": round(w_green, 1),
            }
            self._applied_cycle_s = round(
                ns_green + e_green + w_green + self._N_PHASES * (self._YELLOW_S + self._ALL_RED_S), 1
            )
            self._adaptive_program_applied = True
            self._last_cycle_start = sim_time

            # Reload the phase plan so the dashboard reflects new durations
            self._load_controller_phase_plan()

            logger.info(
                "Adaptive timing applied: NS=%.1fs E=%.1fs W=%.1fs cycle=%.1fs (Y=%.2f)",
                ns_green, e_green, w_green, self._applied_cycle_s, rec["flow_ratio_total"],
            )
        except traci.TraCIException as exc:
            logger.warning("Adaptive TLS program update failed: %s", exc)

    def _apply_queue_extension(
        self, metrics: dict[str, Any], signals: dict[str, Any],
        sim_time: float, phase_meta: dict[str, Any],
    ) -> None:
        """Mid-cycle queue-based extension (small adjustments within a cycle)."""
        signal = signals[self.controller_tls_id]
        if phase_meta["kind"] != "green":
            return
        if signal["remaining_s"] > 4.5 or self._phase_runtime["extended_s"] > 0.0:
            return

        active_directions = phase_meta.get("active_directions", [])
        if not active_directions:
            return

        def _score(direction: str) -> float:
            base = metrics[direction]["queue_vehicles"]
            pressure = self.demand_state["demand"][direction]["pressure_index"] * 5.0
            video_bonus = self._video_priority_boost(direction)
            return base + pressure + video_bonus

        active_score, active_direction = max(
            ((_score(direction), direction) for direction in active_directions),
            default=(0.0, None),
        )
        competing_score = max(
            (_score(direction) for direction in DIRECTIONS if direction not in active_directions),
            default=0.0,
        )
        if active_direction is None or active_score < self.queue_threshold or competing_score > active_score + 1.5:
            return

        extension = min(self.max_extension, max(2, math.ceil(active_score - self.queue_threshold + 1)))
        try:
            traci.trafficlight.setPhaseDuration(self.controller_tls_id, signal["remaining_s"] + extension)
            self._phase_runtime["extended_s"] = float(extension)
            logger.debug(
                "Adaptive +%ds on %s (score=%.1f vs %.1f)",
                extension, active_direction, active_score, competing_score,
            )
        except traci.TraCIException as exc:
            logger.debug("Adaptive control TraCI write failed: %s", exc)

    def _restore_field_plan(self) -> None:
        """Restore the original field-plan signal program."""
        try:
            logics = traci.trafficlight.getAllProgramLogics(self.controller_tls_id)
            if logics:
                # The first logic is typically the original field plan
                original_id = logics[0].programID
                if original_id != "adaptive":
                    traci.trafficlight.setProgram(self.controller_tls_id, original_id)
                else:
                    # If the only program is "adaptive", try program "0"
                    traci.trafficlight.setProgram(self.controller_tls_id, "0")
            self._adaptive_program_applied = False
            self._applied_greens = dict(self._CURRENT_GREENS)
            self._applied_cycle_s = self._CURRENT_CYCLE_S
            self._load_controller_phase_plan()
            logger.info("Restored field-plan signal timing")
        except traci.TraCIException as exc:
            logger.warning("Failed to restore field plan: %s", exc)

    def _emissions_summary(self, vehicle_ids: list[str]) -> dict[str, Any]:
        if not self._emissions_enabled or not vehicle_ids:
            return {}
        try:
            total_co2_mg_per_s = 0.0
            total_nox_mg_per_s = 0.0
            total_fuel_mg_per_s = 0.0
            count = 0
            for vid in vehicle_ids:
                try:
                    total_co2_mg_per_s += traci.vehicle.getCO2Emission(vid)
                    total_nox_mg_per_s += traci.vehicle.getNOxEmission(vid)
                    total_fuel_mg_per_s += traci.vehicle.getFuelConsumption(vid)
                    count += 1
                except traci.TraCIException:
                    continue
            # Convert mg/s → g/h for display
            return {
                "fleet_size": count,
                "co2_g_per_h": round(total_co2_mg_per_s * 3.6, 1),
                "nox_g_per_h": round(total_nox_mg_per_s * 3.6, 2),
                "fuel_l_per_h": round(total_fuel_mg_per_s * 3.6 / 850.0, 2),  # rough density 0.85 kg/L
            }
        except Exception as exc:  # noqa: BLE001
            logger.debug("Emissions read failed: %s", exc)
            return {}

    def _publish_state(self, sim_time: float) -> None:
        signals = self._signals(sim_time)
        controller_signal = signals.get(self.controller_tls_id)
        if controller_signal:
            self._update_phase_runtime(int(controller_signal["phase"]), sim_time)
        lane_metrics = self._lane_metrics(signals)
        metrics = self._metrics(sim_time, lane_metrics)
        self._apply_adaptive_control(metrics, signals, sim_time)
        signal_plan = self._controller_signal_plan(sim_time, signals, lane_metrics)
        # Cache the active vehicle ID list once per tick to avoid repeated TraCI roundtrips
        try:
            vehicle_ids = list(traci.vehicle.getIDList()) if traci.isLoaded() else []
        except traci.TraCIException as exc:
            logger.debug("Failed to fetch vehicle ID list: %s", exc)
            vehicle_ids = []
        vehicles = self._vehicles(vehicle_ids)
        insights = self._insights(metrics, sim_time, vehicle_ids=vehicle_ids)
        signal_recommendation = self._webster_recommendation(metrics, self.demand_state)
        emissions = self._emissions_summary(vehicle_ids)
        # Anomaly detection — throttled by min_inference_interval
        anomaly_payload: dict[str, Any] | None = None
        if self.anomaly_detector is not None:
            interval = float(self.config.get("anomaly", {}).get("min_inference_interval_s", 10))
            if sim_time - self._last_anomaly_run >= interval:
                self._last_anomaly_run = sim_time
                try:
                    self._last_anomaly_result = self.anomaly_detector.score({
                        "metrics": metrics,
                        "google_snapshot": self.traffic_snapshot.get("approaches", {}),
                    })
                except Exception as exc:  # noqa: BLE001
                    logger.debug("Anomaly scoring failed: %s", exc)
            anomaly_payload = self._last_anomaly_result
        _SNAP_DEFAULTS: dict[str, Any] = {
            "speed_ratio": 0.85,
            "congestion_level": "free",
            "delay_s": 0.0,
            "delay_ratio": 0.0,
            "duration_s": 0.0,
            "static_duration_s": 0.0,
            "avg_speed_kmh": 0.0,
            "free_flow_speed_kmh": 0.0,
            "normal_share": 0.85,
            "slow_share": 0.10,
            "jam_share": 0.05,
            "polyline": [],
            "traffic_segments": [],
        }
        approaches = self.traffic_snapshot.get("approaches", {})
        google_summary = {
            direction: {
                key: approaches.get(direction, {}).get(key, _SNAP_DEFAULTS[key])
                for key in _SNAP_DEFAULTS
            }
            for direction in DIRECTIONS
        }
        state = {
            "status": "running",
            "state_version": self.state_version + 1,
            "wall_time": now_iso(),
            "sim_time_s": round(sim_time, 1),
            "source": self.traffic_snapshot["source"],
            "simulation_center": self.manifest["simulation_center"],
            "site_reference": self.config["site_reference"],
            "controller_tls_id": self.controller_tls_id,
            "vehicles": vehicles,
            "signals": signals,
            "signal_plan": signal_plan,
            "metrics": metrics,
            "lane_metrics": lane_metrics,
            "demand": self.demand_state["demand"],
            "google_snapshot": google_summary,
            "insights": insights,
            "signal_recommendation": signal_recommendation,
            "adaptive_active": self.adaptive_active,
            "emissions": emissions,
            "anomaly": anomaly_payload,
            "google_error": self._latest_google_error,
            "data_provenance": {
                "google_delay_s": "Live Google Routes travel-time delta versus free flow.",
                "google_speed_kmh": "Live Google Routes corridor speed derived from route distance and travel time.",
                "target_veh_h": "Simulation demand estimate derived from Google pressure and congestion shares.",
                "flow_veh_h": "Observed SUMO flow rate over the rolling five-minute window.",
                "queue_m": "Stopped vehicles on monitored lanes multiplied by the configured vehicle length.",
            },
        }
        history_point = {
            "wall_time": state["wall_time"],
            "sim_time_s": state["sim_time_s"],
            "vehicle_count": len(vehicles),
            "total_queue_m": insights["total_queue_m"],
            "avg_network_speed_kmh": insights["avg_network_speed_kmh"],
            "dominant_queue_direction": insights["dominant_queue_direction"],
            "per_direction": {
                direction: {
                    "queue_m": metrics[direction]["queue_m"],
                    "flow_veh_h": metrics[direction]["flow_veh_h"],
                    "avg_speed_kmh": metrics[direction]["avg_speed_kmh"],
                }
                for direction in DIRECTIONS
            },
        }
        # Pre-serialize state once so SSE clients don't pay JSON encoding per request
        try:
            serialized = json.dumps(state, separators=(",", ":"))
        except (TypeError, ValueError) as exc:
            logger.error("State serialization failed: %s", exc)
            serialized = None
        with self.state_lock:
            self.state_version += 1
            state["state_version"] = self.state_version
            self.current_state = state
            # Re-serialize after the version stamp to keep the cached JSON authoritative
            try:
                self._current_state_json = json.dumps(state, separators=(",", ":"))
            except (TypeError, ValueError):
                self._current_state_json = serialized
            self.history.append(history_point)
        # Notify SSE waiters that a new version is available
        self._state_changed_event.set()
        # Throttle disk writes — disk I/O on every tick is wasteful (10 Hz is overkill)
        if (self.state_version % max(1, self._disk_write_every) == 0):
            try:
                write_json(self.config["paths"]["live_state"], state)
                write_json(self.config["paths"]["history"], list(self.history))
            except Exception as exc:  # noqa: BLE001
                logger.warning("Disk state write failed: %s", exc)

    def _set_state(self, state: dict[str, Any]) -> None:
        with self.state_lock:
            self.state_version += 1
            state["state_version"] = self.state_version
            self.current_state = state

    def _run_loop(self, steps_limit: int | None) -> None:
        next_refresh = 0.0
        step_count = 0
        while not self._stop_event.is_set():
            cycle_start = time.monotonic()
            sim_time = traci.simulation.getTime()
            if sim_time >= next_refresh:
                self.refresh_inputs()
                next_refresh = sim_time + float(self.config["google"]["poll_interval_seconds"])

            self._inject_vehicles(sim_time)
            traci.simulationStep()
            sim_time = traci.simulation.getTime()
            self._publish_state(sim_time)
            step_count += 1

            if steps_limit is not None and step_count >= steps_limit:
                break

            elapsed = time.monotonic() - cycle_start
            time.sleep(max(0.0, self.real_time_step - elapsed))

    def run_blocking(self, steps_limit: int | None = None) -> None:
        self.prepare()
        try:
            self._run_loop(steps_limit)
        finally:
            self.stop()

    def stop(self) -> None:
        self._stop_event.set()
        if self.video_processor is not None:
            try:
                self.video_processor.stop()
            except Exception:  # noqa: BLE001
                pass
        try:
            if traci.isLoaded():
                traci.close()
        except Exception:  # noqa: BLE001
            pass
        if self._process and self._process.poll() is None:
            self._process.terminate()
            try:
                self._process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self._process.kill()

    def get_state(self) -> dict[str, Any]:
        # The state dict is rebuilt on every _publish_state, so it is safe to share
        # the reference (we don't mutate it after publishing). Skipping deepcopy
        # saves significant CPU when there are multiple SSE/HTTP readers.
        with self.state_lock:
            return self.current_state

    def get_state_json(self) -> str | None:
        """Return the cached pre-serialized JSON string (avoids re-encoding per reader)."""
        with self.state_lock:
            return self._current_state_json

    def wait_for_state_update(self, timeout: float = 1.0) -> bool:
        """Block until the next state version, or until timeout. Used by SSE."""
        result = self._state_changed_event.wait(timeout)
        if result:
            self._state_changed_event.clear()
        return result

    def get_history(self) -> list[dict[str, Any]]:
        with self.state_lock:
            return list(self.history)

    def toggle_adaptive(self, enabled: bool | None = None) -> bool:
        if enabled is None:
            self.adaptive_active = not self.adaptive_active
        else:
            self.adaptive_active = bool(enabled)
        return self.adaptive_active

    def get_network_geometry(self) -> dict[str, Any]:
        return self.network_geometry

    def public_config(self) -> dict[str, Any]:
        return {
            "site_reference": self.config["site_reference"],
            "simulation_center": self.manifest["simulation_center"],
            "controller_tls_id": self.controller_tls_id,
            "google_enabled": self.fetcher is not None,
            "poll_interval_seconds": self.config["google"]["poll_interval_seconds"],
            "adaptive_enabled": self.adaptive_active,
            "history_seconds": self.history_seconds,
            "source": self.traffic_snapshot.get("source"),
            "routes": self.route_defs,
        }


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the SUMO TraCI engine for the live Wadi Saqra digital twin.")
    parser.add_argument("--config", help="Optional path to a live config JSON file.")
    parser.add_argument("--steps", type=int, default=60, help="How many 1-second steps to run in blocking mode.")
    parser.add_argument("--gui", action="store_true", help="Run against sumo-gui instead of headless sumo.")
    parser.add_argument("--headless", action="store_true", help="Explicitly request headless mode.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = load_live_config(args.config)
    gui = args.gui and not args.headless
    engine = LiveSimulationEngine(config, gui=gui)
    try:
        engine.run_blocking(steps_limit=args.steps)
        state = engine.get_state()
        print(json.dumps(state, indent=2))
    finally:
        engine.stop()


if __name__ == "__main__":
    main()
