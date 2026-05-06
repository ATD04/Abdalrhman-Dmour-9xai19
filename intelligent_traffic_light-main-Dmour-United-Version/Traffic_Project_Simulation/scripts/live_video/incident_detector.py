"""Optional YOLOv8 crash/fire incident detector with temporal confirmation."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Any, Deque

try:
    from ..cli.zone_support import zone_for_point
except ImportError:
    from cli.zone_support import zone_for_point


PROJECT_ROOT = Path(__file__).resolve().parents[2].parent

INCIDENT_CLASS_MAP = {
    "crash": "collision",
    "collision": "collision",
    "accident": "collision",
    "crashed_vehicle": "collision",
    "vehicle_crash": "collision",
    "fire": "fire",
    "flame": "fire",
    "smoke": "fire",
}

CONFIRMATION_POLICY = {
    "collision": {"min_hits": 3, "window_s": 5.0, "min_confidence": 0.55, "severity": "CRITICAL"},
    "fire": {"min_hits": 2, "window_s": 3.0, "min_confidence": 0.60, "severity": "CRITICAL"},
}


class VisionIncidentDetector:
    """Runs optional incident inference and confirms events across time."""

    def __init__(
        self,
        *,
        enabled: bool,
        weights: str | Path | None,
        device: str = "cpu",
        sample_stride: int = 3,
        zones: list[dict[str, Any]] | None = None,
        dedup_window_s: float = 30.0,
    ) -> None:
        self.enabled = enabled
        self.weights = self._resolve_weights(weights)
        self.device = device
        self.sample_stride = max(1, int(sample_stride or 3))
        self.zones = zones or []
        self.dedup_window_s = dedup_window_s
        self._model: Any = None
        self._load_error: str | None = None
        self._frame_counter = 0
        self._candidate_hits: dict[str, Deque[dict[str, Any]]] = defaultdict(lambda: deque(maxlen=12))
        self._last_emit_s: dict[str, float] = {}
        self._recent_events: Deque[dict[str, Any]] = deque(maxlen=50)

    @classmethod
    def from_config(cls, config: dict[str, Any], zones: list[dict[str, Any]]) -> "VisionIncidentDetector":
        block = ((config.get("live_video") or {}).get("incident_detection") or {})
        return cls(
            enabled=bool(block.get("enabled", False)),
            weights=block.get("weights") or block.get("yolo_weights"),
            device=block.get("device") or (config.get("live_video") or {}).get("device", "cpu"),
            sample_stride=int(block.get("sample_stride", 3)),
            zones=zones,
            dedup_window_s=float(block.get("dedup_window_s", 30.0)),
        )

    def load(self) -> bool:
        if not self.enabled:
            self._load_error = "Incident detector disabled in config."
            return False
        if not self.weights:
            self._load_error = "Incident detector weights are not configured."
            return False
        try:
            from ultralytics import YOLO  # type: ignore
        except ImportError:
            self._load_error = "Ultralytics is not installed."
            return False
        try:
            self._model = YOLO(str(self.weights))
            self._load_error = None
            return True
        except Exception as exc:  # noqa: BLE001
            self._load_error = f"Incident model load failed: {exc}"
            self._model = None
            return False

    def describe(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "loaded": self._model is not None,
            "weights": str(self.weights) if self.weights else None,
            "device": self.device,
            "sample_stride": self.sample_stride,
            "load_error": self._load_error,
            "recent_event_count": len(self._recent_events),
        }

    def recent_events(self, limit: int = 20) -> list[dict[str, Any]]:
        return list(self._recent_events)[-limit:]

    def process_frame(self, frame: Any, timestamp_s: float | None = None) -> list[dict[str, Any]]:
        self._frame_counter += 1
        if self._model is None or self._frame_counter % self.sample_stride != 0:
            return []
        timestamp_s = timestamp_s if timestamp_s is not None else time.monotonic()
        try:
            results = self._model(frame, verbose=False, device=self.device)
        except Exception as exc:  # noqa: BLE001
            self._load_error = f"Incident inference failed: {exc}"
            return []
        detections = self._detections_from_results(results, frame)
        return self.ingest_detections(detections, timestamp_s)

    def ingest_detections(self, detections: list[dict[str, Any]], timestamp_s: float | None = None) -> list[dict[str, Any]]:
        timestamp_s = timestamp_s if timestamp_s is not None else time.monotonic()
        emitted: list[dict[str, Any]] = []
        for detection in detections:
            incident_type = self._incident_type(detection.get("class_name"))
            if incident_type is None:
                continue
            policy = CONFIRMATION_POLICY[incident_type]
            confidence = float(detection.get("confidence", 0.0) or 0.0)
            if confidence < policy["min_confidence"]:
                continue
            zone = self._zone_for_detection(detection)
            direction = zone.get("direction") if zone else detection.get("direction")
            zone_id = zone.get("zone_id") if zone else detection.get("zone") or "unknown"
            key = f"{incident_type}:{direction or 'unknown'}:{zone_id}"
            hits = self._candidate_hits[key]
            hits.append({
                "timestamp_s": timestamp_s,
                "confidence": confidence,
                "zone_id": zone_id,
                "direction": direction,
                "bbox_norm": detection.get("bbox_norm"),
            })
            while hits and timestamp_s - float(hits[0]["timestamp_s"]) > policy["window_s"]:
                hits.popleft()
            if len(hits) < policy["min_hits"]:
                continue
            if timestamp_s - self._last_emit_s.get(key, -10**9) < self.dedup_window_s:
                continue
            event = self._build_event(incident_type, key, list(hits), policy, timestamp_s)
            emitted.append(event)
            self._recent_events.append(event)
            self._last_emit_s[key] = timestamp_s
        return emitted

    def _zone_for_detection(self, detection: dict[str, Any]) -> dict[str, Any] | None:
        center = detection.get("center_norm") or {}
        if center.get("x") is None or center.get("y") is None:
            bbox = detection.get("bbox_norm") or {}
            if bbox.get("x") is None:
                return None
            center = {"x": bbox["x"] + bbox.get("w", 0.0) / 2.0, "y": bbox["y"] + bbox.get("h", 0.0) / 2.0}
        return zone_for_point(float(center["x"]), float(center["y"]), self.zones)

    @staticmethod
    def _incident_type(class_name: Any) -> str | None:
        key = str(class_name or "").strip().lower().replace(" ", "_").replace("-", "_")
        return INCIDENT_CLASS_MAP.get(key)

    @staticmethod
    def _build_event(
        incident_type: str,
        key: str,
        hits: list[dict[str, Any]],
        policy: dict[str, Any],
        timestamp_s: float,
    ) -> dict[str, Any]:
        avg_conf = sum(float(hit["confidence"]) for hit in hits) / max(len(hits), 1)
        latest = hits[-1]
        direction = latest.get("direction")
        zone_id = latest.get("zone_id")
        return {
            "event_id": f"vision-{incident_type}-{int(timestamp_s * 1000)}",
            "event_type": "incident_crash" if incident_type == "collision" else incident_type,
            "incident_type": incident_type,
            "type": incident_type,
            "severity": policy["severity"],
            "direction": direction,
            "zone": zone_id,
            "source": "yolov8_incident_detector",
            "confidence": round(avg_conf, 3),
            "hit_count": len(hits),
            "dedupe_key": key,
            "message": f"Confirmed {incident_type} visual incident"
            + (f" on {direction}" if direction else ""),
            "recommendation": "Hold conflicting movements and dispatch field verification immediately.",
        }

    def _detections_from_results(self, results: Any, frame: Any) -> list[dict[str, Any]]:
        if not results:
            return []
        result = results[0]
        boxes = getattr(result, "boxes", None)
        if boxes is None or len(boxes) == 0:
            return []
        height, width = frame.shape[:2]
        names = getattr(result, "names", None) or getattr(self._model, "names", {})
        detections: list[dict[str, Any]] = []
        for idx in range(len(boxes)):
            box = boxes[idx]
            cls_id = int(box.cls[0].cpu().item()) if hasattr(box.cls[0], "cpu") else int(box.cls[0])
            class_name = names.get(cls_id, str(cls_id)) if isinstance(names, dict) else str(cls_id)
            conf = float(box.conf[0].cpu().item()) if hasattr(box.conf[0], "cpu") else float(box.conf[0])
            x1n, y1n, x2n, y2n = box.xyxyn[0].cpu().numpy().tolist()
            w_norm = max(0.0, x2n - x1n)
            h_norm = max(0.0, y2n - y1n)
            detections.append({
                "class_name": class_name,
                "confidence": conf,
                "bbox_norm": {"x": x1n, "y": y1n, "w": w_norm, "h": h_norm},
                "center_norm": {"x": x1n + w_norm / 2.0, "y": y1n + h_norm / 2.0},
                "frame_size": {"width": width, "height": height},
            })
        return detections

    @staticmethod
    def _resolve_weights(raw: str | Path | None) -> str | Path | None:
        if not raw:
            return None
        path = Path(raw)
        if path.is_absolute() and path.exists():
            return path
        for candidate in (
            PROJECT_ROOT / raw,
            PROJECT_ROOT / "Traffic_Project_Simulation" / raw,
            Path.cwd() / raw,
        ):
            if candidate.exists():
                return candidate
        return raw
