#!/usr/bin/env python3

from __future__ import annotations

import csv
import json
import logging
import logging.handlers
import math
import os
import random
import subprocess
import sys
import time
from collections import Counter, defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
UTC = timezone.utc
from pathlib import Path
from typing import Any

import pyproj
from google.auth.transport.requests import AuthorizedSession
from google.oauth2 import service_account

logger = logging.getLogger("its.support")


# ── Structured logging setup (idempotent) ──────────────────────
_LOG_CONFIGURED = False


def setup_logging(level: str | int = "INFO", log_file: Path | None = None) -> None:
    """Configure root logging once with a stable, structured format."""
    global _LOG_CONFIGURED
    if _LOG_CONFIGURED:
        return
    root = logging.getLogger()
    root.setLevel(level if isinstance(level, int) else getattr(logging, str(level).upper(), logging.INFO))
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    ))
    root.addHandler(handler)
    if log_file is not None:
        try:
            log_file.parent.mkdir(parents=True, exist_ok=True)
            file_handler = logging.handlers.RotatingFileHandler(
                str(log_file), maxBytes=2_000_000, backupCount=3
            )
            file_handler.setFormatter(logging.Formatter(
                fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            ))
            root.addHandler(file_handler)
        except Exception:  # noqa: BLE001
            pass
    _LOG_CONFIGURED = True


def parse_lane_id(lane_id: str) -> tuple[str, int] | None:
    """Parse SUMO lane ID '<edge>_<index>' robustly. Returns None if malformed."""
    if not lane_id or "_" not in lane_id:
        return None
    edge_id, _, index_str = lane_id.rpartition("_")
    if not edge_id or not index_str.isdigit():
        return None
    try:
        return edge_id, int(index_str)
    except (TypeError, ValueError):
        return None


def format_direction_short(direction: str | None) -> str:
    """Strip the trailing 'bound' suffix for display, e.g. 'northbound' -> 'north'."""
    if not direction:
        return "unknown"
    return direction.replace("bound", "")


SIM_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = SIM_ROOT.parent
SANDBOX_ROOT = PROJECT_ROOT / "Traffic_Data_Sandbox"
APP_DATA_ROOT = SIM_ROOT / "app" / "data"
CONFIG_ROOT = SIM_ROOT / "config"
LIVE_SCENARIO_ROOT = SIM_ROOT / "sumo_scenarios" / "live"
DEFAULT_CONFIG_PATH = CONFIG_ROOT / "live_config.json"
LOCAL_CONFIG_PATH = CONFIG_ROOT / "live_config.local.json"

def _discover_sumo_home() -> Path:
    """Auto-detect SUMO installation across macOS, Linux, and Windows.

    Resolution order:
      1. SUMO_HOME environment variable (official recommendation)
      2. macOS Homebrew framework (common on Apple Silicon)
      3. Linux standard paths (/usr/share/sumo, /usr/local/share/sumo)
      4. Windows default install (Program Files)
    Raises RuntimeError only when sumolib import ultimately fails.
    """
    # 1. SUMO_HOME env (highest priority — user override)
    env_home = os.environ.get("SUMO_HOME")
    if env_home:
        p = Path(env_home)
        tools = p / "tools"
        if tools.is_dir():
            return p
        # Some setups point SUMO_HOME to the share dir directly
        if (p / "share" / "sumo" / "tools").is_dir():
            return p / "share" / "sumo"

    # 2. macOS Homebrew framework (versioned and unversioned)
    for ver in ("1.26.0", "1.25.0", "1.24.0", "Current"):
        candidate = Path(f"/Library/Frameworks/EclipseSUMO.framework/Versions/{ver}/EclipseSUMO/share/sumo")
        if candidate.is_dir():
            return candidate
    # Homebrew keg-only path (Apple Silicon / Intel)
    for brew_prefix in ("/opt/homebrew", "/usr/local"):
        candidate = Path(brew_prefix) / "share" / "sumo"
        if candidate.is_dir():
            return candidate

    # 3. Linux standard locations
    for linux_path in ("/usr/share/sumo", "/usr/local/share/sumo"):
        if Path(linux_path).is_dir():
            return Path(linux_path)

    # 4. Windows default install
    for win_path in (
        Path(os.environ.get("PROGRAMFILES", "C:\\Program Files")) / "Eclipse" / "Sumo",
        Path(os.environ.get("PROGRAMFILES(X86)", "C:\\Program Files (x86)")) / "Eclipse" / "Sumo",
    ):
        if (win_path / "tools").is_dir():
            return win_path

    # Fallback: the original macOS path (kept for backwards compatibility)
    return Path("/Library/Frameworks/EclipseSUMO.framework/Versions/1.26.0/EclipseSUMO/share/sumo")


SUMO_SHARE_HOME = _discover_sumo_home()
SUMO_TOOLS = SUMO_SHARE_HOME / "tools"
if str(SUMO_TOOLS) not in sys.path:
    sys.path.append(str(SUMO_TOOLS))

try:
    import sumolib  # noqa: E402
    from sumolib.geomhelper import distancePointToPolygon  # noqa: E402
except ImportError as _sumo_err:
    raise RuntimeError(
        f"sumolib not found. Set SUMO_HOME or install SUMO 1.26+. "
        f"Searched: {SUMO_SHARE_HOME / 'tools'}"
    ) from _sumo_err


DIRECTIONS = ("northbound", "southbound", "eastbound", "westbound")
OPPOSITE_DIRECTION = {
    "northbound": "southbound",
    "southbound": "northbound",
    "eastbound": "westbound",
    "westbound": "eastbound",
}
DIRECTION_BEARINGS = {
    "northbound": 180.0,
    "southbound": 0.0,
    "eastbound": 270.0,
    "westbound": 90.0,
}
TRAFFIC_COLORS = {
    "NORMAL": "#3ddc97",
    "SLOW": "#ffb347",
    "TRAFFIC_JAM": "#ff5a5f",
}
CONGESTION_THRESHOLDS = (
    (0.88, "free"),
    (0.72, "light"),
    (0.56, "moderate"),
    (0.40, "heavy"),
    (0.00, "severe"),
)
DIRECTION_MAP = {
    "northbound": ["1", "2", "3"],
    "southbound": ["4", "5", "6"],
    "eastbound": ["7", "8", "9"],
    "westbound": ["10", "11", "12", "13", "14"],
}
WEEKDAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
VEHICLE_TYPE_WEIGHTS = {
    "passenger": 0.82,
    "bus": 0.05,
    "truck": 0.08,
    "motorcycle": 0.05,
}
VEHICLE_PERMISSION_MARKERS = {
    "army",
    "authority",
    "bus",
    "coach",
    "custom1",
    "custom2",
    "delivery",
    "emergency",
    "evehicle",
    "gov",
    "hov",
    "motorcycle",
    "moped",
    "passenger",
    "private",
    "public_authority",
    "public_emergency",
    "public_transport",
    "taxi",
    "trailer",
    "transport",
    "truck",
    "vip",
}


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def now_iso() -> str:
    return datetime.now(UTC).astimezone().isoformat(timespec="seconds")


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def parse_duration_seconds(value: str) -> float:
    if not value.endswith("s"):
        raise ValueError(f"Unsupported duration value: {value}")
    return float(value[:-1])


def normalize_direction(dx: float, dy: float) -> str:
    if abs(dx) > abs(dy):
        return "westbound" if dx > 0 else "eastbound"
    return "southbound" if dy > 0 else "northbound"


def congestion_label(speed_ratio: float) -> str:
    for threshold, label in CONGESTION_THRESHOLDS:
        if speed_ratio >= threshold:
            return label
    return "severe"


def random_vehicle_type(rng: random.Random) -> str:
    sample = rng.random()
    running = 0.0
    for vehicle_type, weight in VEHICLE_TYPE_WEIGHTS.items():
        running += weight
        if sample <= running:
            return vehicle_type
    return "passenger"


def decode_polyline(encoded: str) -> list[dict[str, float]]:
    """Standard Google encoded polyline decoder (precision 5).

    Reference: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
    """
    if not encoded:
        return []
    index = 0
    length = len(encoded)
    lat = 0
    lon = 0
    points: list[dict[str, float]] = []

    while index < length:
        # latitude
        result = 0
        shift = 0
        while True:
            if index >= length:
                return points
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        dlat = ~(result >> 1) if (result & 1) else (result >> 1)
        lat += dlat

        # longitude
        result = 0
        shift = 0
        while True:
            if index >= length:
                return points
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        dlon = ~(result >> 1) if (result & 1) else (result >> 1)
        lon += dlon

        points.append({"lat": lat * 1e-5, "lon": lon * 1e-5})

    return points


def build_traffic_segments(
    points: list[dict[str, float]],
    intervals: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if len(points) < 2:
        return []
    if not intervals:
        return [{"speed": "NORMAL", "points": points}]

    segments: list[dict[str, Any]] = []
    for interval in intervals:
        start = max(0, int(interval.get("startPolylinePointIndex", 0)))
        end = int(interval.get("endPolylinePointIndex", len(points) - 1))
        if end <= start:
            end = min(start + 1, len(points) - 1)
        else:
            end = min(end, len(points) - 1)
        segment_points = points[start : end + 1]
        if len(segment_points) < 2:
            continue
        segments.append(
            {
                "speed": interval.get("speed", "NORMAL"),
                "points": segment_points,
            }
        )
    return segments or [{"speed": "NORMAL", "points": points}]


def destination_point(lat: float, lon: float, bearing_deg: float, distance_m: float) -> tuple[float, float]:
    radius = 6371000.0
    bearing = math.radians(bearing_deg)
    lat1 = math.radians(lat)
    lon1 = math.radians(lon)
    angular_distance = distance_m / radius

    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular_distance)
        + math.cos(lat1) * math.sin(angular_distance) * math.cos(bearing)
    )
    lon2 = lon1 + math.atan2(
        math.sin(bearing) * math.sin(angular_distance) * math.cos(lat1),
        math.cos(angular_distance) - math.sin(lat1) * math.sin(lat2),
    )
    return math.degrees(lat2), math.degrees(lon2)


def deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    keys = set(base) | set(override)
    for key in keys:
        if key in base and key in override and isinstance(base[key], dict) and isinstance(override[key], dict):
            merged[key] = deep_merge(base[key], override[key])
        elif key in override:
            merged[key] = override[key]
        else:
            merged[key] = base[key]
    return merged


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def resolve_path(value: str | None) -> Path | None:
    if not value:
        return None
    path = Path(value)
    if path.is_absolute():
        return path
    return (SIM_ROOT / path).resolve()


def load_live_config(config_path: str | None = None) -> dict[str, Any]:
    config_source = Path(config_path).resolve() if config_path else DEFAULT_CONFIG_PATH
    base = load_json(config_source)
    if LOCAL_CONFIG_PATH.exists():
        base = deep_merge(base, load_json(LOCAL_CONFIG_PATH))

    base["paths"] = {
        "config": config_source,
        "live_root": LIVE_SCENARIO_ROOT,
        "app_data": APP_DATA_ROOT,
        "network_osm": LIVE_SCENARIO_ROOT / "wadi_saqra_live.osm.xml",
        "network_net": LIVE_SCENARIO_ROOT / "wadi_saqra_live.net.xml",
        "sumocfg": LIVE_SCENARIO_ROOT / "wadi_saqra_live.sumocfg",
        "bootstrap_routes": LIVE_SCENARIO_ROOT / "wadi_saqra_live_bootstrap.rou.xml",
        "manifest": LIVE_SCENARIO_ROOT / "network_manifest.json",
        "traffic_snapshot": APP_DATA_ROOT / "live_traffic_snapshot.json",
        "live_state": APP_DATA_ROOT / "last_live_state.json",
        "history": APP_DATA_ROOT / "live_history.json",
        "network_geometry": APP_DATA_ROOT / "live_network_geometry.json",
        "demand_state": APP_DATA_ROOT / "live_demand_state.json",
        "google_service_account": resolve_path(base.get("google", {}).get("service_account_file")),
    }
    return base


def _load_network_geometry_cached(config: dict[str, Any]) -> dict[str, Any]:
    """Load the generated network geometry once and cache it on the config object."""
    cached = config.get("_cached_network_geometry")
    if isinstance(cached, dict):
        return cached

    geometry_path = (config.get("paths") or {}).get("network_geometry")
    geometry: dict[str, Any] = {"approaches": {}, "lanes": []}
    if geometry_path and Path(geometry_path).exists():
        try:
            geometry = json.loads(Path(geometry_path).read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            logger.debug("Could not load cached network geometry %s: %s", geometry_path, exc)

    config["_cached_network_geometry"] = geometry
    return geometry


def build_approach_capacity_profiles(
    config: dict[str, Any],
    geometry: dict[str, Any] | None = None,
) -> dict[str, dict[str, Any]]:
    """Build per-approach capacity profiles using real geometry inputs.

    The existing `google_base_capacity_veh_h` remains the calibration anchor, but each
    approach is scaled using monitored lane count, average lane width, and average lane
    length so the reported capacity and saturation are no longer a single fixed number.
    """
    block = config.get("capacity_model", {}) or {}
    base_capacity = float(config.get("simulation", {}).get("google_base_capacity_veh_h", 220.0))
    default_lane_width_m = float(block.get("default_lane_width_m", 3.2))
    reference_lane_count = float(block.get("reference_lane_count", 2.0))
    reference_lane_width_m = float(block.get("reference_lane_width_m", 3.2))
    reference_approach_length_m = float(block.get("reference_approach_length_m", 120.0))
    vehicle_length_m = float(config.get("simulation", {}).get("vehicle_length_meters", 7.5))
    vehicle_gap_m = float(block.get("vehicle_gap_m", 2.5))
    storage_buffer_m = float(block.get("storage_buffer_m", 10.0))

    geometry = geometry or _load_network_geometry_cached(config)
    approaches = geometry.get("approaches", {}) or {}
    lane_lookup = {lane.get("id"): lane for lane in geometry.get("lanes", []) if lane.get("id")}

    profiles: dict[str, dict[str, Any]] = {}
    for direction in DIRECTIONS:
        approach = approaches.get(direction, {}) or {}
        lane_ids = list(approach.get("monitor_lanes") or approach.get("incoming_lanes") or [])
        lane_entries = [lane_lookup[lane_id] for lane_id in lane_ids if lane_id in lane_lookup]

        lane_count = len(lane_entries) or len(lane_ids) or 1
        lane_lengths = [
            float(lane.get("length_m", 0.0))
            for lane in lane_entries
            if lane.get("length_m") is not None
        ]
        lane_widths = [
            float(lane.get("width_m", default_lane_width_m))
            for lane in lane_entries
            if lane.get("width_m") is not None
        ]

        avg_lane_length_m = sum(lane_lengths) / len(lane_lengths) if lane_lengths else reference_approach_length_m
        avg_lane_width_m = sum(lane_widths) / len(lane_widths) if lane_widths else default_lane_width_m
        route_length_m = float(approach.get("route_length_m") or avg_lane_length_m)

        lane_factor = lane_count / max(reference_lane_count, 1.0)
        width_factor = clamp(avg_lane_width_m / max(reference_lane_width_m, 0.1), 0.85, 1.20)
        length_factor = clamp(avg_lane_length_m / max(reference_approach_length_m, 1.0), 0.80, 1.20)
        capacity_veh_h = max(1.0, base_capacity * lane_factor * width_factor * length_factor)

        effective_storage_length_m = max(vehicle_length_m, avg_lane_length_m - storage_buffer_m)
        storage_per_lane = max(1, int(effective_storage_length_m // max(vehicle_length_m + vehicle_gap_m, 1.0)))

        profiles[direction] = {
            "capacity_veh_h": round(capacity_veh_h, 2),
            "monitor_lane_count": lane_count,
            "approach_length_m": round(avg_lane_length_m, 1),
            "avg_lane_width_m": round(avg_lane_width_m, 2),
            "route_length_m": round(route_length_m, 1),
            "storage_capacity_vehicles": storage_per_lane * lane_count,
            "capacity_basis": {
                "model": "geometry_scaled_capacity_v1",
                "base_capacity_veh_h": round(base_capacity, 2),
                "reference_lane_count": round(reference_lane_count, 2),
                "reference_lane_width_m": round(reference_lane_width_m, 2),
                "reference_approach_length_m": round(reference_approach_length_m, 1),
                "lane_factor": round(lane_factor, 3),
                "width_factor": round(width_factor, 3),
                "length_factor": round(length_factor, 3),
            },
        }

    return profiles


def public_live_config(config: dict[str, Any], manifest: dict[str, Any]) -> dict[str, Any]:
    return {
        "site_reference": config["site_reference"],
        "simulation_center": manifest["simulation_center"],
        "controller_tls_id": manifest["controller_tls_id"],
        "google_enabled": bool(config["google"].get("service_account_file")),
        "poll_interval_seconds": config["google"]["poll_interval_seconds"],
        "adaptive_enabled": config["adaptive_signal"]["enabled_on_start"],
        "history_seconds": config["simulation"]["history_seconds"],
        "step_length_seconds": config["sumo"]["step_length_seconds"],
        "base_flow_floor_veh_h": config["simulation"]["base_flow_floor_veh_h"],
        "max_flow_veh_h": config["simulation"]["max_flow_veh_h"],
        "routes": manifest["routes"],
    }


@dataclass
class DetectorSlotSummary:
    mean_veh_h: float
    p90_veh_h: float
    peak_veh_h: float


class DetectorCalibrator:
    def __init__(self) -> None:
        self._slot_values: dict[str, dict[tuple[int, int], list[float]]] = {direction: defaultdict(list) for direction in DIRECTIONS}
        self._approach_slot_values: dict[str, dict[tuple[int, int], list[float]]] = {
            approach_id: defaultdict(list)
            for approach_ids in DIRECTION_MAP.values()
            for approach_id in approach_ids
        }
        self._overall_values: dict[str, list[float]] = {direction: [] for direction in DIRECTIONS}
        self._load()

    def _load(self) -> None:
        detector_dir = SANDBOX_ROOT / "detector_data"
        grouped_by_ts: dict[str, Counter[str]] = defaultdict(Counter)

        for path in sorted(detector_dir.glob("detector_*.csv")):
            with path.open("r", encoding="utf-8", newline="") as handle:
                reader = csv.DictReader(handle)
                for row in reader:
                    timestamp = row["timestamp"]
                    approach_id = str(int(row["approach_id"]))
                    grouped_by_ts[timestamp][approach_id] += int(row["vehicle_count"])

        for ts_text, approach_counts in grouped_by_ts.items():
            dt = datetime.strptime(ts_text, "%Y-%m-%d %H:%M:%S")
            slot = (dt.weekday(), dt.hour * 4 + dt.minute // 15)
            for approaches in DIRECTION_MAP.values():
                for approach_id in approaches:
                    self._approach_slot_values[approach_id][slot].append(approach_counts.get(approach_id, 0) * 4.0)
            for direction, approaches in DIRECTION_MAP.items():
                count_15m = sum(approach_counts.get(approach_id, 0) for approach_id in approaches)
                veh_h = count_15m * 4.0
                self._slot_values[direction][slot].append(veh_h)
                self._overall_values[direction].append(veh_h)

    @staticmethod
    def _summarize(values: list[float]) -> DetectorSlotSummary:
        if not values:
            return DetectorSlotSummary(mean_veh_h=180.0, p90_veh_h=240.0, peak_veh_h=260.0)
        ordered = sorted(values)
        p90_index = int(round((len(ordered) - 1) * 0.9))
        return DetectorSlotSummary(
            mean_veh_h=sum(values) / len(values),
            p90_veh_h=ordered[p90_index],
            peak_veh_h=ordered[-1],
        )

    def slot_summary(self, direction: str, when: datetime) -> DetectorSlotSummary:
        slot = (when.weekday(), when.hour * 4 + when.minute // 15)
        values = list(self._slot_values[direction].get(slot, []))
        if not values:
            values = list(self._overall_values[direction])
        return self._summarize(values)

    def base_flows(self, when: datetime, floor_veh_h: float) -> dict[str, dict[str, float]]:
        payload: dict[str, dict[str, float]] = {}
        for direction in DIRECTIONS:
            summary = self.slot_summary(direction, when)
            payload[direction] = {
                "mean_veh_h": round(max(floor_veh_h, summary.mean_veh_h), 2),
                "p90_veh_h": round(max(floor_veh_h, summary.p90_veh_h), 2),
                "peak_veh_h": round(max(floor_veh_h, summary.peak_veh_h), 2),
            }
        return payload


def build_detector_historical_analytics(
    calibrator: DetectorCalibrator | None = None,
) -> dict[str, Any]:
    """Build peak-hour and heat-map analytics from real detector history."""
    calibrator = calibrator or DetectorCalibrator()
    payload: dict[str, Any] = {
        "generated_at": now_iso(),
        "source": "detector_data",
        "weekdays": WEEKDAY_LABELS,
        "hours": list(range(24)),
        "directions": {},
        "approaches": {},
    }

    def build_entity(slots: dict[tuple[int, int], list[float]]) -> dict[str, Any]:
        heatmap: list[list[float | None]] = []
        hourly_profile: list[dict[str, Any]] = []
        ranked_slots: list[dict[str, Any]] = []
        max_value = 0.0

        for weekday in range(7):
            row: list[float | None] = []
            for hour in range(24):
                values: list[float] = []
                for quarter in range(4):
                    slot = (weekday, hour * 4 + quarter)
                    values.extend(slots.get(slot, []))
                if values:
                    mean_val = round(sum(values) / len(values), 1)
                    row.append(mean_val)
                    ranked_slots.append({
                        "weekday": WEEKDAY_LABELS[weekday],
                        "weekday_index": weekday,
                        "hour": hour,
                        "mean_veh_h": mean_val,
                    })
                    max_value = max(max_value, mean_val)
                else:
                    row.append(None)
            heatmap.append(row)

        for hour in range(24):
            hour_values: list[float] = []
            for weekday in range(7):
                value = heatmap[weekday][hour]
                if value is not None:
                    hour_values.append(float(value))
            hourly_profile.append({
                "hour": hour,
                "mean_veh_h": round(sum(hour_values) / len(hour_values), 1) if hour_values else None,
            })

        ranked_slots.sort(key=lambda item: item["mean_veh_h"], reverse=True)
        return {
            "top_hours": ranked_slots[:5],
            "hourly_profile": hourly_profile,
            "heatmap": heatmap,
            "heatmap_max": round(max_value, 1),
        }

    for direction in DIRECTIONS:
        payload["directions"][direction] = build_entity(calibrator._slot_values[direction])

    for approach_id in sorted(calibrator._approach_slot_values, key=int):
        direction = next((candidate for candidate, ids in DIRECTION_MAP.items() if approach_id in ids), None)
        payload["approaches"][approach_id] = {
            **build_entity(calibrator._approach_slot_values[approach_id]),
            "approach_id": approach_id,
            "direction": direction,
        }

    return payload


class GoogleTrafficFetcher:
    """Calls Google Routes API v2 with exponential backoff and a circuit breaker.

    Circuit Breaker states:
      CLOSED  — normal operation
      OPEN    — tripped after 3 consecutive failures; blocks calls for `_reset_timeout_s`
      HALF_OPEN — probes once after the reset window; reopens on failure, closes on success
    """

    _CB_FAILURE_THRESHOLD = 3       # failures needed to open the circuit
    _CB_RESET_TIMEOUT_S = 300       # 5 minutes before trying again
    _BACKOFF_BASE_S = 2.0
    _BACKOFF_MAX_S = 30.0
    _MAX_RETRIES = 3

    def __init__(self, config: dict[str, Any]) -> None:
        service_account_file = config["paths"]["google_service_account"]
        if not service_account_file or not service_account_file.exists():
            raise FileNotFoundError("Google service-account file is not configured for live traffic.")
        credentials = service_account.Credentials.from_service_account_file(
            str(service_account_file),
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
        self.session = AuthorizedSession(credentials)
        self.config = config
        # Circuit breaker state
        self._cb_failures = 0
        self._cb_opened_at: float = 0.0
        self._cb_state: str = "CLOSED"  # CLOSED | OPEN | HALF_OPEN

    def _cb_check(self) -> None:
        """Raise if circuit breaker is OPEN and reset window has not expired."""
        if self._cb_state == "CLOSED":
            return
        if self._cb_state == "OPEN":
            elapsed = time.monotonic() - self._cb_opened_at
            if elapsed >= self._CB_RESET_TIMEOUT_S:
                logger.info("Google API circuit breaker: HALF_OPEN — probing")
                self._cb_state = "HALF_OPEN"
            else:
                raise RuntimeError(
                    f"Google API circuit breaker is OPEN "
                    f"(retry in {int(self._CB_RESET_TIMEOUT_S - elapsed)}s)"
                )

    def _cb_success(self) -> None:
        self._cb_failures = 0
        self._cb_state = "CLOSED"

    def _cb_failure(self) -> None:
        self._cb_failures += 1
        if self._cb_failures >= self._CB_FAILURE_THRESHOLD or self._cb_state == "HALF_OPEN":
            self._cb_state = "OPEN"
            self._cb_opened_at = time.monotonic()
            logger.warning(
                "Google API circuit breaker OPENED after %d consecutive failures. "
                "Will retry in %ds.",
                self._cb_failures, self._CB_RESET_TIMEOUT_S,
            )

    def _request_route(self, origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float) -> dict[str, Any]:
        self._cb_check()

        departure_time = (datetime.now(UTC) + timedelta(minutes=2)).isoformat(timespec="seconds").replace("+00:00", "Z")
        body = {
            "origin": {"location": {"latLng": {"latitude": origin_lat, "longitude": origin_lon}}},
            "destination": {"location": {"latLng": {"latitude": dest_lat, "longitude": dest_lon}}},
            "travelMode": "DRIVE",
            "routingPreference": "TRAFFIC_AWARE",
            "departureTime": departure_time,
            "extraComputations": ["TRAFFIC_ON_POLYLINE"],
            "polylineQuality": "OVERVIEW",
        }
        last_exc: Exception | None = None
        for attempt in range(self._MAX_RETRIES):
            try:
                response = self.session.post(
                    "https://routes.googleapis.com/directions/v2:computeRoutes",
                    json=body,
                    headers={
                        "X-Goog-FieldMask": (
                            "routes.duration,routes.staticDuration,routes.distanceMeters,"
                            "routes.polyline.encodedPolyline,routes.travelAdvisory.speedReadingIntervals,fallbackInfo"
                        )
                    },
                    timeout=30,
                )
                if response.status_code == 429:
                    # Rate limit — back off exponentially, do NOT count as circuit-breaker failure
                    wait = min(self._BACKOFF_MAX_S, self._BACKOFF_BASE_S ** (attempt + 1))
                    logger.warning("Google API rate-limited (429) — waiting %.1fs (attempt %d)", wait, attempt + 1)
                    time.sleep(wait)
                    continue
                response.raise_for_status()
                payload = response.json()
                if not payload.get("routes"):
                    raise RuntimeError(f"No route returned by Google Routes API: {payload}")
                self._cb_success()
                return payload["routes"][0]
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                if attempt < self._MAX_RETRIES - 1:
                    wait = min(self._BACKOFF_MAX_S, self._BACKOFF_BASE_S ** (attempt + 1))
                    logger.debug("Google API attempt %d failed (%s) — retrying in %.1fs", attempt + 1, exc, wait)
                    time.sleep(wait)

        self._cb_failure()
        raise RuntimeError(f"Google API failed after {self._MAX_RETRIES} retries") from last_exc

    @staticmethod
    def _speed_breakdown(intervals: list[dict[str, Any]]) -> dict[str, float]:
        totals = Counter()
        interval_total = 0
        for interval in intervals:
            start = int(interval.get("startPolylinePointIndex", 0))
            end = int(interval.get("endPolylinePointIndex", start))
            span = max(end - start, 1)
            totals[interval.get("speed", "NORMAL")] += span
            interval_total += span
        interval_total = interval_total or 1
        return {
            "normal_share": round(totals["NORMAL"] / interval_total, 3),
            "slow_share": round(totals["SLOW"] / interval_total, 3),
            "jam_share": round(totals["TRAFFIC_JAM"] / interval_total, 3),
        }

    def fetch_snapshot(self, center: dict[str, float], probe_distance_m: dict[str, float]) -> dict[str, Any]:
        snapshot = {
            "timestamp": now_iso(),
            "source": "google_routes",
            "center": center,
            "approaches": {},
        }
        center_lat = center["lat"]
        center_lon = center["lon"]

        for direction in DIRECTIONS:
            origin_lat, origin_lon = destination_point(
                center_lat,
                center_lon,
                DIRECTION_BEARINGS[direction],
                probe_distance_m[direction],
            )
            route = self._request_route(origin_lat, origin_lon, center_lat, center_lon)
            duration_s = parse_duration_seconds(route["duration"])
            static_duration_s = parse_duration_seconds(route["staticDuration"])
            speed_ratio = clamp(static_duration_s / max(duration_s, 1.0), 0.15, 1.0)
            intervals = route.get("travelAdvisory", {}).get("speedReadingIntervals", [])
            breakdown = self._speed_breakdown(intervals)
            polyline = decode_polyline(route["polyline"]["encodedPolyline"])
            snapshot["approaches"][direction] = {
                "origin": {"lat": round(origin_lat, 6), "lon": round(origin_lon, 6)},
                "destination": {"lat": round(center_lat, 6), "lon": round(center_lon, 6)},
                "distance_m": int(route["distanceMeters"]),
                "duration_s": round(duration_s, 1),
                "static_duration_s": round(static_duration_s, 1),
                "delay_s": round(max(duration_s - static_duration_s, 0.0), 1),
                "delay_ratio": round(max(duration_s - static_duration_s, 0.0) / max(static_duration_s, 1.0), 3),
                "avg_speed_kmh": round(float(route["distanceMeters"]) / max(duration_s, 1.0) * 3.6, 1),
                "free_flow_speed_kmh": round(float(route["distanceMeters"]) / max(static_duration_s, 1.0) * 3.6, 1),
                "speed_ratio": round(speed_ratio, 3),
                "congestion_level": congestion_label(speed_ratio),
                "polyline": polyline,
                "traffic_segments": build_traffic_segments(polyline, intervals),
                **breakdown,
            }
        return snapshot


def build_detector_fallback_snapshot(
    config: dict[str, Any],
    center: dict[str, float],
    calibrator: DetectorCalibrator,
) -> dict[str, Any]:
    when = datetime.now()
    base_flows = calibrator.base_flows(when, config["simulation"]["base_flow_floor_veh_h"])
    approaches: dict[str, dict[str, Any]] = {}
    global_peak = max(flow["peak_veh_h"] for flow in base_flows.values()) or 1.0
    probe_distance_m = config["google"]["probe_distance_meters"]

    for direction in DIRECTIONS:
        origin_lat, origin_lon = destination_point(
            center["lat"],
            center["lon"],
            DIRECTION_BEARINGS[direction],
            probe_distance_m[direction],
        )
        mean_flow = base_flows[direction]["mean_veh_h"]
        peak_flow = base_flows[direction]["peak_veh_h"]
        ratio = clamp(1.05 - (mean_flow / max(global_peak, 1.0)) * 0.7, 0.35, 0.96)
        jam_share = round(clamp((peak_flow - mean_flow) / max(peak_flow, 1.0), 0.05, 0.65), 3)
        slow_share = round(clamp(jam_share * 0.65, 0.02, 0.45), 3)
        normal_share = round(clamp(1.0 - jam_share - slow_share, 0.10, 0.90), 3)
        approaches[direction] = {
            "origin": {"lat": round(origin_lat, 6), "lon": round(origin_lon, 6)},
            "destination": {"lat": round(center["lat"], 6), "lon": round(center["lon"], 6)},
            "distance_m": int(probe_distance_m[direction]),
            "duration_s": round((probe_distance_m[direction] / 8.0) / max(ratio, 0.2), 1),
            "static_duration_s": round(probe_distance_m[direction] / 8.0, 1),
            "delay_s": round((probe_distance_m[direction] / 8.0) * (1.0 / max(ratio, 0.2) - 1.0), 1),
            "delay_ratio": round(1.0 / max(ratio, 0.2) - 1.0, 3),
            "avg_speed_kmh": round(8.0 * max(ratio, 0.2) * 3.6, 1),
            "free_flow_speed_kmh": round(8.0 * 3.6, 1),
            "speed_ratio": round(ratio, 3),
            "congestion_level": congestion_label(ratio),
            "polyline": [
                {"lat": round(origin_lat, 6), "lon": round(origin_lon, 6)},
                {"lat": round(center["lat"], 6), "lon": round(center["lon"], 6)},
            ],
            "traffic_segments": [
                {
                    "speed": "TRAFFIC_JAM" if jam_share >= 0.2 else "SLOW" if slow_share >= 0.15 else "NORMAL",
                    "points": [
                        {"lat": round(origin_lat, 6), "lon": round(origin_lon, 6)},
                        {"lat": round(center["lat"], 6), "lon": round(center["lon"], 6)},
                    ],
                }
            ],
            "normal_share": normal_share,
            "slow_share": slow_share,
            "jam_share": jam_share,
        }

    return {
        "timestamp": now_iso(),
        "source": "detector_fallback",
        "center": center,
        "approaches": approaches,
        "fallback_reason": "Google traffic fetch unavailable or disabled. Using detector-calibrated hourly slot demand.",
    }


def build_live_demand(
    config: dict[str, Any],
    snapshot: dict[str, Any],
) -> dict[str, Any]:
    """Compute per-direction vehicle demand using Google Routes data and real geometry.

    Formula (no detector data involved):
        target = capacity × (1 + pressure × sensitivity) × jam_multiplier
    where:
        capacity    = geometry-scaled approach capacity derived from lane count, width, and length
        pressure    = 1 - speed_ratio  (0 = free flow, 1 = standstill)
        jam_mult    = 1 + jam_share×1.2 + slow_share×0.5  (Google interval breakdown)
    """
    base_flow_floor = config["simulation"]["base_flow_floor_veh_h"]
    sensitivity = float(config["simulation"]["demand_sensitivity"])
    max_flow = float(config["simulation"]["max_flow_veh_h"])
    capacity_profiles = build_approach_capacity_profiles(config)
    demand: dict[str, dict[str, Any]] = {}

    for direction in DIRECTIONS:
        live = snapshot["approaches"][direction]
        profile = capacity_profiles.get(direction, {})
        capacity = float(profile.get("capacity_veh_h", config["simulation"]["google_base_capacity_veh_h"]))
        speed_ratio = clamp(float(live["speed_ratio"]), 0.05, 1.0)
        pressure = 1.0 - speed_ratio
        jam_multiplier = 1.0 + float(live.get("jam_share", 0.0)) * 1.2 + float(live.get("slow_share", 0.0)) * 0.5
        target = clamp(capacity * (1.0 + pressure * sensitivity) * jam_multiplier, base_flow_floor, max_flow)
        saturation_ratio = clamp(target / max(capacity, 1.0), 0.0, 9.99)
        demand[direction] = {
            "google_capacity_veh_h": round(capacity, 2),
            "capacity_veh_h": round(capacity, 2),
            "target_veh_h": round(target, 2),
            "saturation_ratio": round(saturation_ratio, 3),
            "pressure_index": round(pressure, 3),
            "speed_ratio": round(speed_ratio, 3),
            "delay_ratio": round(float(live.get("delay_ratio", 0.0)), 3),
            "google_avg_speed_kmh": round(float(live.get("avg_speed_kmh", 0.0)), 1),
            "google_free_flow_speed_kmh": round(float(live.get("free_flow_speed_kmh", 0.0)), 1),
            "jam_share": live.get("jam_share", 0.0),
            "slow_share": live.get("slow_share", 0.0),
            "congestion_level": live["congestion_level"],
            "source": snapshot["source"],
            "monitor_lane_count": int(profile.get("monitor_lane_count", 1)),
            "approach_length_m": round(float(profile.get("approach_length_m", 0.0)), 1),
            "avg_lane_width_m": round(float(profile.get("avg_lane_width_m", 3.2)), 2),
            "route_length_m": round(float(profile.get("route_length_m", 0.0)), 1),
            "storage_capacity_vehicles": int(profile.get("storage_capacity_vehicles", 1)),
            "capacity_basis": profile.get("capacity_basis", {"model": "fixed_capacity_fallback"}),
        }

    return {
        "timestamp": now_iso(),
        "source": snapshot["source"],
        "demand": demand,
    }


def build_preview_route_xml(manifest: dict[str, Any], demand_state: dict[str, Any], horizon_seconds: int = 300) -> str:
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<routes xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://sumo.dlr.de/xsd/routes_file.xsd">',
        '    <vType id="passenger" accel="2.2" decel="4.5" sigma="0.5" length="5.0" minGap="2.5" maxSpeed="18.0" guiShape="passenger"/>',
        '    <vType id="bus" accel="1.5" decel="4.0" sigma="0.5" length="12.0" minGap="3.0" maxSpeed="14.0" guiShape="bus"/>',
        '    <vType id="truck" accel="1.4" decel="4.0" sigma="0.5" length="8.0" minGap="3.0" maxSpeed="15.0" guiShape="truck"/>',
        '    <vType id="motorcycle" accel="2.8" decel="4.8" sigma="0.4" length="2.2" minGap="1.4" maxSpeed="18.0" guiShape="motorcycle"/>',
    ]

    for direction in DIRECTIONS:
        route_info = manifest["routes"][direction]
        lines.append(f'    <route id="route_{direction}" edges="{" ".join(route_info["edges"])}"/>')
        target_veh_h = demand_state["demand"][direction]["target_veh_h"]
        lines.append(
            f'    <flow id="flow_{direction}" route="route_{direction}" begin="0" end="{horizon_seconds}" vehsPerHour="{target_veh_h:.2f}" type="passenger"/>'
        )

    lines.append("</routes>")
    return "\n".join(lines)


class CoordConverter:
    def __init__(self, net_path: Path) -> None:
        self.net = sumolib.net.readNet(str(net_path))
        location = self.net.getLocationOffset()
        self.net_offset_x = float(location[0])
        self.net_offset_y = float(location[1])
        proj = self.net.getGeoProj()
        self.to_wgs84 = pyproj.Transformer.from_proj(proj.crs, pyproj.CRS.from_epsg(4326), always_xy=True)
        self.from_wgs84 = pyproj.Transformer.from_crs(pyproj.CRS.from_epsg(4326), proj.crs, always_xy=True)

    def xy_to_latlon(self, x: float, y: float) -> tuple[float, float]:
        lon, lat = self.net.convertXY2LonLat(x, y)
        return lat, lon

    def latlon_to_xy(self, lat: float, lon: float) -> tuple[float, float]:
        return self.net.convertLonLat2XY(lon, lat)


def _path_len(shape: list[tuple[float, float]]) -> float:
    total = 0.0
    for first, second in zip(shape, shape[1:]):
        total += math.dist(first, second)
    return total


def _edge_distance_to_point(edge: sumolib.net.edge.Edge, point: tuple[float, float]) -> float:
    return float(distancePointToPolygon(point, edge.getShape()))


def _edge_heading(edge: sumolib.net.edge.Edge) -> float:
    shape = edge.getShape()
    if len(shape) < 2:
        return 0.0
    start_x, start_y = shape[0]
    end_x, end_y = shape[-1]
    return (math.degrees(math.atan2(end_x - start_x, end_y - start_y)) + 360.0) % 360.0


def lane_is_vehicle_capable(lane_or_permissions: Any) -> bool:
    permissions = lane_or_permissions
    if hasattr(lane_or_permissions, "getPermissions"):
        permissions = lane_or_permissions.getPermissions()
    permission_set = set(permissions or [])
    if not permission_set:
        return True
    return bool(permission_set & VEHICLE_PERMISSION_MARKERS)


def edge_vehicle_lanes(edge: sumolib.net.edge.Edge) -> list[Any]:
    return [lane for lane in edge.getLanes() if lane_is_vehicle_capable(lane)]


def _shape_to_geo_points(net: sumolib.net.Net, shape: list[tuple[float, float]]) -> list[dict[str, float]]:
    points: list[dict[str, float]] = []
    for x, y in shape:
        lon, lat = net.convertXY2LonLat(x, y)
        points.append({"lat": round(lat, 6), "lon": round(lon, 6)})
    return points


def _midpoint(points: list[dict[str, float]]) -> dict[str, float]:
    if not points:
        return {"lat": 0.0, "lon": 0.0}
    mid_index = len(points) // 2
    return {"lat": points[mid_index]["lat"], "lon": points[mid_index]["lon"]}


def _bootstrap_routes_xml() -> str:
    return "\n".join(
        [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<routes xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://sumo.dlr.de/xsd/routes_file.xsd">',
            '    <vType id="passenger" accel="2.2" decel="4.5" sigma="0.5" length="5.0" minGap="2.5" maxSpeed="18.0" guiShape="passenger"/>',
            '    <vType id="bus" accel="1.5" decel="4.0" sigma="0.5" length="12.0" minGap="3.0" maxSpeed="14.0" guiShape="bus"/>',
            '    <vType id="truck" accel="1.4" decel="4.0" sigma="0.5" length="8.0" minGap="3.0" maxSpeed="15.0" guiShape="truck"/>',
            '    <vType id="motorcycle" accel="2.8" decel="4.8" sigma="0.4" length="2.2" minGap="1.4" maxSpeed="18.0" guiShape="motorcycle"/>',
            "</routes>",
        ]
    )


def _sumo_config_xml(net_path: Path, route_path: Path) -> str:
    return "\n".join(
        [
            "<configuration>",
            "    <input>",
            f'        <net-file value="{net_path.name}"/>',
            f'        <route-files value="{route_path.name}"/>',
            "    </input>",
            "    <time>",
            '        <begin value="0"/>',
            '        <end value="86400"/>',
            "    </time>",
            "    <report>",
            '        <no-step-log value="true"/>',
            "    </report>",
            "</configuration>",
        ]
    )


def build_live_network(config: dict[str, Any], force: bool = False) -> dict[str, Any]:
    ensure_dir(LIVE_SCENARIO_ROOT)
    manifest_path: Path = config["paths"]["manifest"]
    osm_path: Path = config["paths"]["network_osm"]
    net_path: Path = config["paths"]["network_net"]
    sumocfg_path: Path = config["paths"]["sumocfg"]
    route_path: Path = config["paths"]["bootstrap_routes"]
    reference = config["site_reference"]

    if net_path.exists() and osm_path.exists() and not force:
        net = sumolib.net.readNet(str(net_path))
        controller_tls_id, simulation_center = select_controller_tls(net, reference["lat"], reference["lon"])
        routes = select_routes_for_directions(net, simulation_center)
        geometry = build_network_geometry(net, simulation_center, routes)
        existing_manifest = load_json(manifest_path) if manifest_path.exists() else {}
        manifest = {
            "schema_version": 2,
            "created_at": existing_manifest.get("created_at", now_iso()),
            "reference_location": reference,
            "simulation_center": simulation_center,
            "controller_tls_id": controller_tls_id,
            "bbox": {
                "west": geometry["bbox"]["min_lon"],
                "south": geometry["bbox"]["min_lat"],
                "east": geometry["bbox"]["max_lon"],
                "north": geometry["bbox"]["max_lat"],
            },
            "routes": routes,
        }
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        config["paths"]["network_geometry"].write_text(json.dumps(geometry, indent=2), encoding="utf-8")
        if not route_path.exists():
            route_path.write_text(_bootstrap_routes_xml(), encoding="utf-8")
        if not sumocfg_path.exists():
            sumocfg_path.write_text(_sumo_config_xml(net_path, route_path), encoding="utf-8")
        return manifest

    padding_lat = config["network"]["bbox_padding_degrees"]["lat"]
    padding_lon = config["network"]["bbox_padding_degrees"]["lon"]
    bbox = (
        reference["lon"] - padding_lon,
        reference["lat"] - padding_lat,
        reference["lon"] + padding_lon,
        reference["lat"] + padding_lat,
    )
    bbox_text = ",".join(f"{value:.6f}" for value in bbox)

    endpoints = (
        "https://overpass-api.de/api/map",
        "https://lz4.overpass-api.de/api/map",
        "https://overpass.kumi.systems/api/map",
    )
    download_path = osm_path.with_suffix(".download.xml")
    download_error = None
    for endpoint in endpoints:
        try:
            subprocess.run(
                ["curl", "-sS", f"{endpoint}?bbox={bbox_text}", "-o", str(download_path)],
                check=True,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError as exc:
            download_error = exc
            continue

        if _is_valid_osm_extract(download_path):
            download_path.replace(osm_path)
            break
    else:
        if not _is_valid_osm_extract(osm_path):
            raise RuntimeError(
                "Failed to download a valid OSM extract for the live SUMO network."
            ) from download_error

    proj_dir = pyproj.datadir.get_data_dir()
    netconvert_cmd = [
        str(Path(config["sumo"]["netconvert_binary"])),
        "--osm-files",
        str(osm_path),
        "-o",
        str(net_path),
        "--geometry.remove",
        "--roundabouts.guess",
        "--ramps.guess",
        "--junctions.join",
        "--tls.guess-signals",
        "--tls.discard-simple",
        "false",
        "--tls.join",
        "true",
    ]
    env = os.environ.copy()
    env["PROJ_LIB"] = proj_dir
    env["PROJ_DATA"] = proj_dir
    env["SUMO_HOME"] = str(SUMO_SHARE_HOME)
    subprocess.run(netconvert_cmd, check=True, env=env)

    net = sumolib.net.readNet(str(net_path))
    controller_tls_id, simulation_center = select_controller_tls(net, reference["lat"], reference["lon"])
    routes = select_routes_for_directions(net, simulation_center)
    geometry = build_network_geometry(net, simulation_center, routes)

    manifest = {
        "schema_version": 2,
        "created_at": now_iso(),
        "reference_location": reference,
        "simulation_center": simulation_center,
        "controller_tls_id": controller_tls_id,
        "bbox": {
            "west": round(bbox[0], 6),
            "south": round(bbox[1], 6),
            "east": round(bbox[2], 6),
            "north": round(bbox[3], 6),
        },
        "routes": routes,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    config["paths"]["network_geometry"].write_text(json.dumps(geometry, indent=2), encoding="utf-8")
    route_path.write_text(_bootstrap_routes_xml(), encoding="utf-8")
    sumocfg_path.write_text(_sumo_config_xml(net_path, route_path), encoding="utf-8")
    return manifest


def select_controller_tls(net: sumolib.net.Net, reference_lat: float, reference_lon: float) -> tuple[str, dict[str, float]]:
    best_score = None
    best_tls_id = None
    best_center = None
    ref_x, ref_y = net.convertLonLat2XY(reference_lon, reference_lat)

    for tls in net.getTrafficLights():
        coords: list[tuple[float, float]] = []
        for lane_from, lane_to, _index in tls.getConnections():
            coords.extend(lane_from.getShape())
            coords.extend(lane_to.getShape())
        if not coords:
            continue
        center_x = sum(point[0] for point in coords) / len(coords)
        center_y = sum(point[1] for point in coords) / len(coords)
        distance_m = math.dist((ref_x, ref_y), (center_x, center_y))
        score = len(tls.getConnections()) * 100.0 - distance_m
        if best_score is None or score > best_score:
            best_score = score
            best_tls_id = tls.getID()
            lon, lat = net.convertXY2LonLat(center_x, center_y)
            best_center = {"lat": round(lat, 6), "lon": round(lon, 6), "distance_from_reference_m": round(distance_m, 1)}

    if not best_tls_id or not best_center:
        raise RuntimeError("No traffic-light controller found in generated SUMO network.")
    return best_tls_id, best_center


def select_routes_for_directions(net: sumolib.net.Net, center: dict[str, float]) -> dict[str, dict[str, Any]]:
    center_xy = net.convertLonLat2XY(center["lon"], center["lat"])
    edges = [edge for edge in net.getEdges(withInternal=False) if edge_vehicle_lanes(edge)]

    inbound: dict[str, list[tuple[tuple[float, float, float], Any]]] = {direction: [] for direction in DIRECTIONS}
    outbound: dict[str, list[tuple[tuple[float, float, float], Any]]] = {direction: [] for direction in DIRECTIONS}

    for edge in edges:
        edge_distance = _edge_distance_to_point(edge, center_xy)
        if edge_distance > 260:
            continue
        shape = edge.getShape()
        if len(shape) < 2:
            continue
        start_distance = math.dist(shape[0], center_xy)
        end_distance = math.dist(shape[-1], center_xy)
        mid_x = sum(point[0] for point in shape) / len(shape)
        mid_y = sum(point[1] for point in shape) / len(shape)
        direction = normalize_direction(mid_x - center_xy[0], mid_y - center_xy[1])
        score = (-len(edge_vehicle_lanes(edge)), edge_distance, min(start_distance, end_distance))
        if end_distance < start_distance:
            inbound[direction].append((score, edge))
        else:
            outbound[direction].append((score, edge))

    route_payload: dict[str, dict[str, Any]] = {}
    for direction in DIRECTIONS:
        if not inbound[direction]:
            raise RuntimeError(f"No inbound approach edge found for {direction}.")
        opposite = OPPOSITE_DIRECTION[direction]
        if not outbound[opposite]:
            raise RuntimeError(f"No outbound exit edge found for {direction} (opposite side {opposite}).")

        inbound_edge = sorted(inbound[direction], key=lambda item: item[0])[0][1]
        outbound_edge = sorted(outbound[opposite], key=lambda item: item[0])[0][1]
        path, travel_cost = net.getShortestPath(inbound_edge, outbound_edge)
        if not path:
            raise RuntimeError(f"Could not find SUMO path from {inbound_edge.getID()} to {outbound_edge.getID()}.")
        vehicle_monitor_edges = [
            edge
            for _score, edge in sorted(inbound[direction], key=lambda item: item[0])
            if edge_vehicle_lanes(edge)
        ]
        monitor_edges = [edge.getID() for edge in vehicle_monitor_edges[: min(3, len(vehicle_monitor_edges))]]
        monitor_lanes = [
            lane.getID()
            for edge in vehicle_monitor_edges[: min(3, len(vehicle_monitor_edges))]
            for lane in edge_vehicle_lanes(edge)
        ]
        route_payload[direction] = {
            "incoming_edge": inbound_edge.getID(),
            "outgoing_edge": outbound_edge.getID(),
            "edges": [edge.getID() for edge in path],
            "monitor_edges": monitor_edges,
            "incoming_lanes": [lane.getID() for lane in edge_vehicle_lanes(inbound_edge)],
            "monitor_lanes": monitor_lanes,
            "route_length_m": round(sum(_path_len(edge.getShape()) for edge in path), 1),
            "travel_cost_m": round(float(travel_cost), 1),
            "incoming_heading_deg": round(_edge_heading(inbound_edge), 1),
            "outgoing_heading_deg": round(_edge_heading(outbound_edge), 1),
        }
    return route_payload


def build_network_geometry(
    net: sumolib.net.Net,
    center: dict[str, float],
    routes: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    center_xy = net.convertLonLat2XY(center["lon"], center["lat"])
    polylines: list[list[dict[str, float]]] = []
    lanes: list[dict[str, Any]] = []
    bbox = {"min_lat": 90.0, "max_lat": -90.0, "min_lon": 180.0, "max_lon": -180.0}
    route_edge_direction: dict[str, set[str]] = defaultdict(set)
    monitored_lane_direction: dict[str, str] = {}
    approaches: dict[str, dict[str, Any]] = {}

    for direction, route_info in routes.items():
        for edge_id in route_info["edges"]:
            route_edge_direction[edge_id].add(direction)
        for lane_id in route_info.get("monitor_lanes", []):
            monitored_lane_direction[lane_id] = direction

    for direction, route_info in routes.items():
        incoming_edge = net.getEdge(route_info["incoming_edge"])
        anchor = _midpoint(_shape_to_geo_points(net, incoming_edge.getShape()))
        approaches[direction] = {
            "incoming_edge": route_info["incoming_edge"],
            "monitor_edges": route_info["monitor_edges"],
            "incoming_lanes": route_info.get("incoming_lanes", []),
            "monitor_lanes": route_info.get("monitor_lanes", []),
            "monitor_lane_count": len(route_info.get("monitor_lanes", [])),
            "route_length_m": route_info.get("route_length_m", 0.0),
            "incoming_heading_deg": route_info["incoming_heading_deg"],
            "anchor": anchor,
        }

    for edge in net.getEdges(withInternal=False):
        if _edge_distance_to_point(edge, center_xy) > 900:
            continue
        if edge.getFunction():
            continue
        edge_shape = edge.getShape()
        line = _shape_to_geo_points(net, edge_shape)
        for point in line:
            lat = point["lat"]
            lon = point["lon"]
            bbox["min_lat"] = min(bbox["min_lat"], lat)
            bbox["max_lat"] = max(bbox["max_lat"], lat)
            bbox["min_lon"] = min(bbox["min_lon"], lon)
            bbox["max_lon"] = max(bbox["max_lon"], lon)
        if len(line) >= 2:
            polylines.append(line)
        route_directions = sorted(route_edge_direction.get(edge.getID(), set()))
        direction_hint = route_directions[0] if len(route_directions) == 1 else None
        for lane in edge_vehicle_lanes(edge):
            lane_shape = _shape_to_geo_points(net, lane.getShape())
            if len(lane_shape) < 2:
                continue
            lane_id = lane.getID()
            lane_direction = monitored_lane_direction.get(lane_id, direction_hint)
            lanes.append(
                {
                    "id": lane_id,
                    "edge_id": edge.getID(),
                    "lane_index": lane.getIndex(),
                    "direction_hint": lane_direction,
                    "role": "monitor" if lane_id in monitored_lane_direction else "background",
                    "length_m": round(lane.getLength(), 1),
                    "width_m": round(float(lane.getWidth() or 3.2), 2),
                    "speed_limit_kmh": round(lane.getSpeed() * 3.6, 1),
                    "shape": lane_shape,
                    "anchor": _midpoint(lane_shape),
                    "stop_point": lane_shape[-1],
                }
            )

    return {
        "schema_version": 2,
        "center": center,
        "bbox": {key: round(value, 6) for key, value in bbox.items()},
        "roads": polylines,
        "lanes": lanes,
        "approaches": approaches,
    }


def write_json(path: Path, payload: Any) -> None:
    ensure_dir(path.parent)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def rolling_rate(events: deque[float], window_seconds: int, now_value: float) -> float:
    while events and events[0] < now_value - window_seconds:
        events.popleft()
    return len(events) * 3600.0 / max(window_seconds, 1)


def _is_valid_osm_extract(path: Path) -> bool:
    if not path.exists() or path.stat().st_size == 0:
        return False
    head = path.read_text(encoding="utf-8", errors="ignore")[:2048]
    return "<osm" in head and "<html" not in head.lower()
