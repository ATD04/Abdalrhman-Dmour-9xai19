"""Live YOLO video stream processor.

Reads frames from a configurable source (local MP4, RTSP URL, HTTP MJPEG) and runs
YOLO26x + BoTSORT tracking on a sampled subset (default: 5 fps). Produces per-direction
counts, stopped/moving ratios, and bus/truck/person flags. Other modules subscribe to
its `get_per_direction_stats()` snapshot.

Lifecycle:
  - `start()` spawns a daemon thread that loops over frames
  - `stop()` signals the thread and releases resources

Designed to gracefully degrade: if OpenCV / Ultralytics aren't available, the
processor stays in "disabled" state and `is_running()` returns False.
"""

from __future__ import annotations

import logging
import math
import threading
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Any, Deque

logger = logging.getLogger("its.live_video")

DIRECTIONS = ("northbound", "southbound", "eastbound", "westbound")

PROJECT_ROOT = Path(__file__).resolve().parents[2].parent


class LiveVideoStreamProcessor:
    """Background YOLO inference loop with per-direction aggregation."""

    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config
        block = config.get("live_video", {}) or {}
        self.enabled = bool(block.get("enabled", False))
        self.source = self._resolve_source(block.get("source"))
        self.weights = self._resolve_weights(block.get("yolo_weights", "yolo26x.pt"))
        self.sample_fps = float(block.get("sample_fps", 5))
        self.device = block.get("device", "mps")
        self.min_confidence = float(block.get("min_confidence", 0.25))
        self.zones = block.get("approach_zones", {}) or {}
        self.classes = (0, 2, 3, 5, 7)  # person, car, motorcycle, bus, truck

        self._lock = threading.Lock()
        self._latest: dict[str, dict[str, Any]] = {}
        self._latest_ts: float = 0.0
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._model = None
        self._running = False
        self._frames_read = 0
        self._frames_decoded = 0
        self._start_time = 0.0
        self._reconnect_count = 0
        self._last_error = None

        # Per-track motion buffer for stopped/moving classification
        self._track_motion: dict[int, Deque[tuple[float, float]]] = defaultdict(lambda: deque(maxlen=12))

    # ── Public API ────────────────────────────────────────────
    def is_running(self) -> bool:
        return self._running and self._thread is not None and self._thread.is_alive()

    def get_stats(self) -> dict[str, Any]:
        """Return real-time ingestion monitoring metrics."""
        uptime = time.time() - self._start_time if self._start_time > 0 else 0
        fps = self._frames_decoded / uptime if uptime > 0 else 0
        dropped = self._frames_read - self._frames_decoded
        return {
            "uptime_s": round(uptime, 1),
            "ingestion_rate_fps": round(fps, 2),
            "dropped_frames": max(0, dropped),
            "reconnect_count": self._reconnect_count,
            "last_error": self._last_error,
        }

    def get_per_direction_stats(self) -> dict[str, dict[str, Any]]:
        with self._lock:
            return {direction: dict(self._latest.get(direction, {})) for direction in DIRECTIONS}

    def describe(self) -> dict[str, Any]:
        stats = self.get_stats()
        return {
            "enabled": self.enabled,
            "running": self.is_running(),
            "source": str(self.source) if self.source else None,
            "weights": str(self.weights) if self.weights else None,
            "device": self.device,
            "sample_fps": self.sample_fps,
            **stats,
        }

    def start(self) -> None:
        if not self.enabled:
            logger.info("Live video processor is disabled in config")
            return
        if not self.source or not self.weights:
            logger.warning("Live video missing source/weights — not starting")
            return
        if self._thread and self._thread.is_alive():
            return
        if not self._load_model():
            return
        self._stop_event.clear()
        self._start_time = time.time()
        self._frames_read = 0
        self._frames_decoded = 0
        self._thread = threading.Thread(target=self._run, daemon=True, name="live-video")
        self._running = True
        self._thread.start()
        logger.info("Live video processor started (source=%s, %.1f fps)", self.source, self.sample_fps)

    def stop(self) -> None:
        self._stop_event.set()
        self._running = False
        if self._thread:
            self._thread.join(timeout=3.0)

    # ── Internals ─────────────────────────────────────────────
    def _resolve_source(self, raw: Any) -> Path | str | None:
        if not raw:
            return None
        if isinstance(raw, str) and raw.startswith(("rtsp://", "http://", "https://")):
            return raw
        path = Path(raw)
        if not path.is_absolute():
            path = (PROJECT_ROOT / raw).resolve()
        return path if path.exists() else None

    def _resolve_weights(self, raw: Any) -> Path | str:
        """Resolve model weights — prefer local file, fall back to auto-download name."""
        path = Path(raw)
        if not path.is_absolute():
            for candidate in (
                PROJECT_ROOT / raw,
                PROJECT_ROOT / "Traffic_Project_Simulation" / raw,
                Path.cwd() / raw,
            ):
                if candidate.exists():
                    return candidate
        if path.exists():
            return path
        # Return the raw name; ultralytics will auto-download from hub
        return raw

    def _load_model(self) -> bool:
        try:
            from ultralytics import YOLO  # type: ignore
        except ImportError:
            logger.warning("Ultralytics not installed — live video disabled")
            return False
        try:
            self._model = YOLO(str(self.weights))
        except Exception as exc:  # noqa: BLE001
            logger.warning("YOLO model load failed: %s", exc)
            return False
        return True

    def _run(self) -> None:
        try:
            import cv2  # type: ignore
        except ImportError:
            logger.warning("OpenCV not installed — live video disabled")
            self._running = False
            return

        backoff = 1.0
        while not self._stop_event.is_set():
            cap = cv2.VideoCapture(str(self.source))
            if not cap.isOpened():
                self._reconnect_count += 1
                self._last_error = f"Cannot open video source {self.source}"
                logger.warning("%s. Retrying in %.1fs...", self._last_error, backoff)
                time.sleep(min(backoff, 10.0))
                backoff = min(backoff * 1.5, 10.0)
                continue

            # Successful connection
            backoff = 1.0
            self._last_error = None
            source_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            frame_step = max(1, int(round(source_fps / max(self.sample_fps, 0.5))))
            frame_idx = 0

            try:
                while not self._stop_event.is_set():
                    ok, frame = cap.read()
                    if not ok:
                        # If file-based, loop. If stream, break to reconnect.
                        if isinstance(self.source, Path) or (isinstance(self.source, str) and not self.source.startswith(("rtsp://", "http://"))):
                            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                            continue
                        logger.warning("Stream read failed. Attempting reconnection...")
                        break
                    
                    self._frames_read += 1
                    frame_idx += 1
                    if frame_idx % frame_step != 0:
                        continue
                    
                    self._process_frame(frame)
                    self._frames_decoded += 1
            except Exception as exc:  # noqa: BLE001
                self._last_error = f"Live video loop error: {exc}"
                logger.warning(self._last_error)
            finally:
                cap.release()
            
            if self._stop_event.is_set():
                break
            
            self._reconnect_count += 1
            time.sleep(2.0)  # Short pause before reconnecting


    def _process_frame(self, frame: Any) -> None:
        try:
            results = self._model.track(
                frame,
                persist=True,
                verbose=False,
                tracker="botsort.yaml",
                classes=list(self.classes),
                conf=self.min_confidence,
                device=self.device,
            )
        except Exception as exc:  # noqa: BLE001
            logger.debug("YOLO track failed: %s", exc)
            return
        if not results:
            return
        result = results[0]
        height, width = frame.shape[:2]
        ts = time.monotonic()

        per_direction: dict[str, dict[str, Any]] = {
            d: {
                "vehicle_count": 0,
                "stopped_count": 0,
                "moving_count": 0,
                "person_count": 0,
                "bus_count": 0,
                "truck_count": 0,
            }
            for d in DIRECTIONS
        }
        try:
            boxes = result.boxes
            if boxes is None or boxes.xywh is None:
                return
            xywh = boxes.xywh.cpu().numpy() if hasattr(boxes.xywh, "cpu") else boxes.xywh
            ids = boxes.id.cpu().numpy() if (boxes.id is not None and hasattr(boxes.id, "cpu")) else None
            classes = boxes.cls.cpu().numpy() if hasattr(boxes.cls, "cpu") else boxes.cls
            for i in range(len(xywh)):
                cx, cy, _, _ = xywh[i]
                norm_x = cx / max(width, 1)
                norm_y = cy / max(height, 1)
                cls_id = int(classes[i])
                tid = int(ids[i]) if ids is not None else -1
                direction = self._direction_for_point(norm_x, norm_y)
                if direction is None:
                    continue
                bucket = per_direction[direction]
                if cls_id == 0:
                    bucket["person_count"] += 1
                else:
                    bucket["vehicle_count"] += 1
                    if cls_id == 5:
                        bucket["bus_count"] += 1
                    elif cls_id == 7:
                        bucket["truck_count"] += 1
                    motion = self._classify_motion(tid, norm_x, norm_y, ts)
                    if motion == "stopped":
                        bucket["stopped_count"] += 1
                    elif motion == "moving":
                        bucket["moving_count"] += 1
        except Exception as exc:  # noqa: BLE001
            logger.debug("Frame processing failed: %s", exc)
            return

        # Compute ratios
        for direction, bucket in per_direction.items():
            total = max(1, bucket["vehicle_count"])
            bucket["stopped_ratio"] = bucket["stopped_count"] / total
            bucket["moving_ratio"] = bucket["moving_count"] / total

        with self._lock:
            self._latest = per_direction
            self._latest_ts = ts

    def _direction_for_point(self, norm_x: float, norm_y: float) -> str | None:
        for direction, rect in self.zones.items():
            try:
                left, top, right, bottom = rect
            except (TypeError, ValueError):
                continue
            if left <= norm_x <= right and top <= norm_y <= bottom:
                return direction
        return None

    def _classify_motion(self, tid: int, norm_x: float, norm_y: float, ts: float) -> str:
        history = self._track_motion[tid]
        history.append((ts, math.hypot(norm_x, norm_y)))
        if len(history) < 4:
            return "unknown"
        prev_ts, prev_pos = history[0]
        cur_ts, cur_pos = history[-1]
        dt = max(cur_ts - prev_ts, 0.05)
        speed = abs(cur_pos - prev_pos) / dt  # normalized units / s
        if speed >= 0.04:
            return "moving"
        if speed >= 0.012:
            return "slow"
        return "stopped"
