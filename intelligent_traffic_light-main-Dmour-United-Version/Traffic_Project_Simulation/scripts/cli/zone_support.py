"""Shared polygon zone definitions for video analytics and live counting."""

from __future__ import annotations

import json
import math
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SIM_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = SIM_ROOT.parent
CONFIG_ROOT = SIM_ROOT / "config"
SANDBOX_ROOT = PROJECT_ROOT / "Traffic_Data_Sandbox"

DEFAULT_ZONE_PATH = CONFIG_ROOT / "zone_definitions.json"
DEFAULT_METADATA_PATH = SANDBOX_ROOT / "metadata" / "metadata.json"
DIRECTIONS = ("northbound", "southbound", "eastbound", "westbound")
DIRECTION_APPROACHES = {
    "northbound": ("1", "2", "3"),
    "southbound": ("4", "5", "6"),
    "eastbound": ("7", "8", "9"),
    "westbound": ("10", "11", "12", "13", "14"),
}
APPROACH_DIRECTIONS = {
    approach_id: direction
    for direction, approach_ids in DIRECTION_APPROACHES.items()
    for approach_id in approach_ids
}

DEFAULT_ZONE_COLORS = {
    "northbound": "#62d0c3",
    "southbound": "#ffb347",
    "eastbound": "#ffd166",
    "westbound": "#88c0fc",
    None: "#ffffff",
}


class ZoneValidationError(ValueError):
    """Raised when a zone document cannot be safely accepted."""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clamp01(value: Any) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = 0.0
    if math.isnan(number) or math.isinf(number):
        number = 0.0
    return max(0.0, min(1.0, number))


def rect_to_polygon(rect: list[float] | tuple[float, float, float, float]) -> list[list[float]]:
    left, top, right, bottom = [clamp01(item) for item in rect]
    return [[left, top], [right, top], [right, bottom], [left, bottom]]


def normalize_points(points: list[Any]) -> list[list[float]]:
    normalized: list[list[float]] = []
    for point in points:
        if not isinstance(point, (list, tuple)) or len(point) < 2:
            continue
        normalized.append([round(clamp01(point[0]), 6), round(clamp01(point[1]), 6)])
    if len(normalized) < 2:
        raise ZoneValidationError("A zone must contain at least two points (line) or three+ points (polygon).")
    return normalized


def polygon_area(points: list[list[float]]) -> float:
    if len(points) < 3:
        return 0.0
    area = 0.0
    for idx, point in enumerate(points):
        nxt = points[(idx + 1) % len(points)]
        area += point[0] * nxt[1] - nxt[0] * point[1]
    return abs(area) / 2.0


def _orientation(a: list[float], b: list[float], c: list[float]) -> int:
    value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1])
    if abs(value) < 1e-12:
        return 0
    return 1 if value > 0 else 2


def _segments_intersect(a1: list[float], a2: list[float], b1: list[float], b2: list[float]) -> bool:
    o1 = _orientation(a1, a2, b1)
    o2 = _orientation(a1, a2, b2)
    o3 = _orientation(b1, b2, a1)
    o4 = _orientation(b1, b2, a2)
    return o1 != o2 and o3 != o4


def validate_zone_geometry(points: list[list[float]]) -> None:
    """Reject degenerate or self-crossing zones before they affect vehicle counts."""
    if len(points) == 2:
        if math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]) < 0.01:
            raise ZoneValidationError("Line zones must span at least 1% of the frame.")
        return
    if len(points) < 3:
        raise ZoneValidationError("Polygon zones must contain at least three points.")
    n_points = len(points)
    for i in range(n_points):
        a1 = points[i]
        a2 = points[(i + 1) % n_points]
        for j in range(i + 1, n_points):
            if abs(i - j) <= 1 or {i, j} == {0, n_points - 1}:
                continue
            b1 = points[j]
            b2 = points[(j + 1) % n_points]
            if _segments_intersect(a1, a2, b1, b2):
                raise ZoneValidationError("Zone polygons must not self-intersect.")
    if polygon_area(points) < 0.0001:
        raise ZoneValidationError("Zone polygon area is too small to count vehicles safely.")


def _point_near_segment(
    px: float, py: float,
    a: list[float], b: list[float],
    threshold: float = 0.025,
) -> bool:
    """Return True when point (px, py) is within *threshold* of line segment a→b."""
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    seg_len_sq = dx * dx + dy * dy
    if seg_len_sq < 1e-12:
        # Degenerate segment — treat as point proximity
        return math.hypot(px - ax, py - ay) <= threshold
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg_len_sq))
    closest_x = ax + t * dx
    closest_y = ay + t * dy
    return math.hypot(px - closest_x, py - closest_y) <= threshold


def normalize_pixel_points(points_px: list[Any], width: float = 1280.0, height: float = 960.0) -> list[list[float]]:
    width = max(float(width or 1280.0), 1.0)
    height = max(float(height or 960.0), 1.0)
    return normalize_points([[point[0] / width, point[1] / height] for point in points_px])


def denormalize_points(points_norm: list[list[float]], width: float, height: float) -> list[list[float]]:
    width = max(float(width or 1.0), 1.0)
    height = max(float(height or 1.0), 1.0)
    return [[round(x * width, 2), round(y * height, 2)] for x, y in normalize_points(points_norm)]


def point_in_polygon(x: float, y: float, polygon: list[list[float]]) -> bool:
    """Return True when normalized point (x, y) lies inside polygon.

    For 2-point (line) zones uses proximity check instead of ray-casting.
    For 3+ point zones uses the ray-casting algorithm.
    """
    x = clamp01(x)
    y = clamp01(y)
    points = normalize_points(polygon)
    # 2-point line zone: proximity check
    if len(points) == 2:
        return _point_near_segment(x, y, points[0], points[1], threshold=0.025)
    inside = False
    j = len(points) - 1
    for i, point in enumerate(points):
        xi, yi = point
        xj, yj = points[j]
        if min(yi, yj) <= y <= max(yi, yj):
            dx = xj - xi
            dy = yj - yi
            if abs(dy) < 1e-12 and min(xi, xj) <= x <= max(xi, xj):
                return True
            if abs(dy) >= 1e-12:
                boundary_x = xi + ((y - yi) * dx / dy)
                if abs(boundary_x - x) < 1e-9:
                    return True
                if boundary_x > x and (yi > y) != (yj > y):
                    inside = not inside
        j = i
    return inside


def zone_for_point(x: float, y: float, zones: list[dict[str, Any]]) -> dict[str, Any] | None:
    for zone in sorted(zones, key=lambda item: int(item.get("render_order", 100))):
        if not zone.get("enabled", True):
            continue
        try:
            if point_in_polygon(x, y, zone.get("points_norm", [])):
                return zone
        except ZoneValidationError:
            continue
    return None


def normalize_zone(raw: dict[str, Any], *, default_video_id: str = "*") -> dict[str, Any]:
    zone_id = str(raw.get("zone_id") or raw.get("id") or "").strip()
    if not zone_id:
        raise ZoneValidationError("Zone must include a non-empty zone_id.")
    direction = raw.get("direction")
    if direction is not None:
        direction = str(direction).strip().lower()
        if direction not in DIRECTIONS:
            raise ZoneValidationError(f"Unknown direction for zone {zone_id}: {direction}")
    approach_ids = [str(int(item)) if str(item).isdigit() else str(item) for item in raw.get("approach_ids", raw.get("approaches", []))]
    if direction is None and approach_ids:
        direction = APPROACH_DIRECTIONS.get(approach_ids[0])
    points = raw.get("points_norm")
    if points is None and raw.get("polygon_norm") is not None:
        points = raw.get("polygon_norm")
    if points is None and raw.get("polygon_px") is not None:
        points = normalize_pixel_points(raw.get("polygon_px") or [])
    if points is None and raw.get("rect") is not None:
        points = rect_to_polygon(raw.get("rect"))
    points_norm = normalize_points(points or [])
    validate_zone_geometry(points_norm)
    color = str(raw.get("color") or DEFAULT_ZONE_COLORS.get(direction, "#ffffff"))
    kind = str(raw.get("kind") or raw.get("type") or "monitoring_zone")
    return {
        "zone_id": zone_id,
        "video_id": str(raw.get("video_id") or default_video_id or "*"),
        "label": str(raw.get("label") or raw.get("zone_label") or zone_id.replace("_", " ")),
        "kind": kind,
        "direction": direction,
        "approach_ids": approach_ids,
        "points_norm": points_norm,
        "is_line": bool(raw.get("is_line", kind == "line_zone" or len(points_norm) == 2)),
        "color": color,
        "enabled": bool(raw.get("enabled", True)),
        "count_on_entry": bool(raw.get("count_on_entry", direction is not None)),
        "render_order": int(raw.get("render_order", 100)),
    }


def normalize_document(raw: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ZoneValidationError("Zone document must be a JSON object.")
    videos = raw.get("videos")
    if not isinstance(videos, dict):
        raise ZoneValidationError("Zone document must include a videos object.")
    normalized_videos: dict[str, dict[str, Any]] = {}
    for video_id, block in videos.items():
        if not isinstance(block, dict):
            continue
        zones = []
        for zone in block.get("zones", []):
            zones.append(normalize_zone(zone, default_video_id=str(video_id)))
        normalized_videos[str(video_id)] = {
            "label": str(block.get("label") or video_id),
            "source_resolution": block.get("source_resolution"),
            "zones": sorted(zones, key=lambda item: (item["render_order"], item["zone_id"])),
        }
    return {
        "version": int(raw.get("version", 1)),
        "updated_at": str(raw.get("updated_at") or now_iso()),
        "videos": normalized_videos,
    }


def fallback_document_from_metadata(metadata_path: Path = DEFAULT_METADATA_PATH) -> dict[str, Any]:
    if not metadata_path.exists():
        return {"version": 1, "updated_at": now_iso(), "videos": {"*": {"label": "Fallback zones", "zones": []}}}
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    zones = []
    for index, raw_zone in enumerate(metadata.get("monitoring_zones", []), start=1):
        approaches = [str(item) for item in raw_zone.get("approaches", [])]
        direction = APPROACH_DIRECTIONS.get(approaches[0]) if approaches else None
        zones.append(normalize_zone(
            {
                "zone_id": raw_zone.get("zone_id") or f"metadata_zone_{index}",
                "video_id": "*",
                "label": raw_zone.get("label") or raw_zone.get("zone_id") or f"Metadata zone {index}",
                "kind": raw_zone.get("type") or "metadata_zone",
                "direction": direction,
                "approach_ids": approaches,
                "polygon_px": raw_zone.get("polygon_px") or [],
                "color": DEFAULT_ZONE_COLORS.get(direction, "#ffffff"),
                "enabled": True,
                "count_on_entry": direction is not None,
                "render_order": 100 + index,
            },
            default_video_id="*",
        ))
    return normalize_document({
        "version": 1,
        "updated_at": now_iso(),
        "videos": {
            "*": {
                "label": "Metadata monitoring zones",
                "source_resolution": {"width": 1280, "height": 960},
                "zones": zones,
            }
        },
    })


class ZoneRepository:
    def __init__(self, path: Path = DEFAULT_ZONE_PATH, metadata_path: Path = DEFAULT_METADATA_PATH) -> None:
        self.path = path
        self.metadata_path = metadata_path

    def load(self) -> dict[str, Any]:
        if self.path.exists():
            return normalize_document(json.loads(self.path.read_text(encoding="utf-8")))
        return fallback_document_from_metadata(self.metadata_path)

    def save(self, document: dict[str, Any]) -> dict[str, Any]:
        normalized = normalize_document(document)
        normalized["updated_at"] = now_iso()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(normalized, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        return normalized

    def defaults(self) -> dict[str, Any]:
        return fallback_document_from_metadata(self.metadata_path)

    def reset(self, video_id: str | None = None) -> dict[str, Any]:
        defaults = self.defaults()
        if not video_id:
            return self.save(defaults)
        document = self.load()
        document.setdefault("videos", {})
        if "*" in defaults.get("videos", {}):
            document["videos"]["*"] = deepcopy(defaults["videos"]["*"])
        document["videos"].pop(str(video_id), None)
        return self.save(document)

    def list_zones(self, video_id: str | None = None) -> list[dict[str, Any]]:
        document = self.load()
        zones: list[dict[str, Any]] = []
        for key in ("*", video_id):
            if not key:
                continue
            block = document.get("videos", {}).get(str(key))
            if block:
                zones.extend(deepcopy(block.get("zones", [])))
        deduped: dict[str, dict[str, Any]] = {}
        for zone in zones:
            deduped[zone["zone_id"]] = zone
        return sorted(deduped.values(), key=lambda item: (item.get("render_order", 100), item["zone_id"]))

    def delete(self, zone_id: str) -> dict[str, Any]:
        document = self.load()
        removed = False
        for block in document.get("videos", {}).values():
            original = list(block.get("zones", []))
            block["zones"] = [zone for zone in original if zone.get("zone_id") != zone_id]
            removed = removed or len(block["zones"]) != len(original)
        if not removed:
            raise KeyError(zone_id)
        return self.save(document)


def public_zone_payload(video_id: str | None = None, repository: ZoneRepository | None = None) -> dict[str, Any]:
    repository = repository or ZoneRepository()
    document = repository.load()
    return {
        "version": document["version"],
        "updated_at": document["updated_at"],
        "video_id": video_id,
        "zones": repository.list_zones(video_id),
        "document": document,
    }
