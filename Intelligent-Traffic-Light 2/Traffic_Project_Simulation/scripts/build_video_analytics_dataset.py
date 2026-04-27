#!/usr/bin/env python3
"""Build the Wadi Saqra video analytics dataset.

Key design decisions
--------------------
* **Inference FPS vs output FPS are independent.**
  YOLO runs at `--inference-fps` (default 10 fps) for speed.
  The output preview mp4 is written at the full source FPS (e.g. 30 fps) so
  playback in the browser is always smooth.  Frames between YOLO ticks reuse
  the previous detection result — boxes appear stable, not choppy.

* **Detection accuracy.**
  Default model: YOLO26x (209 GFLOPs, auto-downloaded on first run).
  Confidence threshold: 0.35 (minimizes false positives while retaining high vehicle recall).
  NMS IOU: 0.45.  imgsz: 1280 for 1920-wide source.
  Minimum Box Area: 0.0008 (filters out tiny distant noise).

* **Tracking JSON format.**
  `fps` == source_fps  (for correct currentTime → ms mapping in the JS)
  `inference_fps`       (stored for information only)
  `frames` keys are time_ms strings at inference-frame intervals.
  The JS binary-search already handles sparse keys correctly.
"""

from __future__ import annotations

import argparse
import json
import math
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from ultralytics import YOLO


SIM_ROOT = Path(__file__).resolve().parents[1]
APP_ROOT = SIM_ROOT / "app"
DATA_ROOT = APP_ROOT / "data"
MEDIA_ROOT = APP_ROOT / "media"

# Default: sibling Traffic_Data_Sandbox folder (works when the repo is checked out
# alongside the sandbox data).  Override with --source-root if your layout differs.
DEFAULT_SOURCE_ROOT = SIM_ROOT.parent / "Traffic_Data_Sandbox" / "live_stream"

# Model search order — first existing file wins; last entry auto-downloads from hub.
DEFAULT_MODEL_CANDIDATES: list[Path | str] = [
    SIM_ROOT.parent / "yolo26x.pt",
    SIM_ROOT / "yolo26x.pt",
    Path.home() / "yolo26x.pt",
    "yolo26x.pt",  # auto-download from ultralytics hub if not found locally
]

# COCO class IDs we care about
ALLOWED_CLASSES = {0, 2, 3, 5, 7}  # person, car, motorcycle, bus, truck

ZONE_RECTS = {
    "junction_core":  (0.25, 0.30, 0.78, 0.82),
    "north_approach": (0.53, 0.08, 0.98, 0.40),
    "south_approach": (0.08, 0.67, 0.92, 0.99),
    "west_approach":  (0.00, 0.25, 0.30, 0.80),
    "east_approach":  (0.70, 0.18, 1.00, 0.86),
}
ZONE_LABELS = {
    "junction_core":  "junction core",
    "north_approach": "northbound approach",
    "south_approach": "southbound approach",
    "west_approach":  "westbound approach",
    "east_approach":  "eastbound approach",
}

# Overlay colour palette (BGR for OpenCV)
COLOR_MOVING  = (80, 220, 80)    # green
COLOR_SLOW    = (40, 180, 255)   # orange-yellow
COLOR_STOPPED = (60, 60, 230)    # red
COLOR_PERSON  = (200, 80, 200)   # purple
ZONE_FILL     = (255, 255, 255)  # white tint for zone borders


@dataclass
class ProcessedVideo:
    manifest_entry: dict[str, Any]
    supported_use_cases: set[str]


# ── Utilities ────────────────────────────────────────────────────────────────

def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def slugify(text: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip().lower()).strip("-")
    return value or "video"


def load_model(model_arg: str | None) -> tuple[YOLO, str]:
    candidates: list[Path | str] = []
    if model_arg:
        candidates.append(model_arg)
    candidates.extend(DEFAULT_MODEL_CANDIDATES)

    last_error: Exception | None = None
    for candidate in candidates:
        try:
            model = YOLO(str(candidate))
            name = Path(str(candidate)).name
            print(f"  Loaded model: {name}")
            return model, name
        except Exception as exc:  # noqa: BLE001
            last_error = exc
    raise RuntimeError("No YOLO model available.") from last_error


def point_in_rect(cx: float, cy: float, rect: tuple) -> bool:
    l, t, r, b = rect
    return l <= cx <= r and t <= cy <= b


def assign_zone(cx: float, cy: float) -> str:
    for name, rect in ZONE_RECTS.items():
        if point_in_rect(cx, cy, rect):
            return name
    return "background"


# ── Overlay drawing ───────────────────────────────────────────────────────────

def _motion_color(motion_state: str) -> tuple:
    if motion_state == "moving":
        return COLOR_MOVING
    if motion_state == "slow":
        return COLOR_SLOW
    return COLOR_STOPPED


def draw_detections_on_frame(
    frame: np.ndarray,
    detections: list[dict[str, Any]],
    frame_w: int,
    frame_h: int,
) -> np.ndarray:
    """Draw refined bounding-box overlay with semi-transparent elements."""
    overlay = frame.copy()
    
    for det in detections:
        b = det["bbox_norm"]
        x1 = int(b["x"] * frame_w)
        y1 = int(b["y"] * frame_h)
        x2 = int((b["x"] + b["w"]) * frame_w)
        y2 = int((b["y"] + b["h"]) * frame_h)

        class_name  = det["class_name"]
        motion      = det["motion_state"]
        track_id    = det["track_id"].split("-")[-1]
        conf        = det["confidence"]

        color = COLOR_PERSON if class_name == "person" else _motion_color(motion)

        # Sleek bounding box (1px border with subtle glow)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 1, cv2.LINE_AA)
        
        # Semi-transparent label background
        label = f"{class_name.upper()} {track_id} | {conf:.0%}"
        font       = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.38
        thickness  = 1
        (tw, th), baseline = cv2.getTextSize(label, font, font_scale, thickness)
        
        lx1, ly1 = x1, max(0, y1 - th - 10)
        lx2, ly2 = x1 + tw + 8, y1
        
        cv2.rectangle(overlay, (lx1, ly1), (lx2, ly2), color, cv2.FILLED)
        cv2.putText(
            frame, label,
            (lx1 + 4, ly2 - 6),
            font, font_scale, (255, 255, 255), thickness, cv2.LINE_AA,
        )

        # Small tracking dot at centre
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
        cv2.circle(frame, (cx, cy), 2, color, -1, cv2.LINE_AA)

    # Apply transparency to labels
    cv2.addWeighted(overlay, 0.65, frame, 0.35, 0, frame)
    return frame


def draw_hud(
    frame: np.ndarray,
    frame_idx: int,
    source_fps: float,
    total_frames: int,
    vehicle_count: int,
    inference_tag: str,
) -> np.ndarray:
    """Draw a minimal HUD (frame counter, vehicle count) in the top-left corner."""
    time_s   = frame_idx / max(source_fps, 1.0)
    progress = frame_idx / max(total_frames, 1) * 100.0
    lines = [
        f"Frame {frame_idx:05d}/{total_frames} ({progress:.1f}%)",
        f"Time  {int(time_s // 60):02d}:{int(time_s % 60):02d}.{int((time_s % 1) * 10):.0f}",
        f"Veh   {vehicle_count:3d}   [{inference_tag}]",
    ]
    font  = cv2.FONT_HERSHEY_SIMPLEX
    scale = 0.45
    pad   = 6
    line_h = 18
    box_w  = 260
    box_h  = len(lines) * line_h + pad * 2
    overlay = frame.copy()
    cv2.rectangle(overlay, (8, 8), (8 + box_w, 8 + box_h), (10, 10, 10), cv2.FILLED)
    cv2.addWeighted(overlay, 0.55, frame, 0.45, 0, frame)
    for i, line in enumerate(lines):
        cv2.putText(frame, line, (12, 8 + pad + (i + 1) * line_h - 2),
                    font, scale, (230, 230, 230), 1, cv2.LINE_AA)
    return frame


# ── Event analysis ────────────────────────────────────────────────────────────

def build_event(
    event_id: str,
    event_type: str,
    severity: str,
    start_ms: int,
    end_ms: int,
    zone: str,
    confidence: float,
    description: str,
    recommendation: str,
    source_video_id: str,
) -> dict[str, Any]:
    return {
        "event_id": event_id,
        "event_type": event_type,
        "severity": severity,
        "start_ms": start_ms,
        "end_ms": end_ms,
        "start_s": round(start_ms / 1000.0, 1),
        "end_s": round(end_ms / 1000.0, 1),
        "zone": zone,
        "zone_label": ZONE_LABELS.get(zone, zone.replace("_", " ")),
        "confidence": round(confidence, 2),
        "description": description,
        "recommendation": recommendation,
        "source_video_id": source_video_id,
    }


def collapse_windows(
    frame_stats: list[dict[str, Any]],
    predicate,
    min_duration_s: float,
) -> list[list[dict[str, Any]]]:
    windows: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []
    for frame in frame_stats:
        if predicate(frame):
            current.append(frame)
            continue
        if current:
            duration_s = (current[-1]["time_ms"] - current[0]["time_ms"]) / 1000.0
            if duration_s >= min_duration_s:
                windows.append(current)
            current = []
    if current:
        duration_s = (current[-1]["time_ms"] - current[0]["time_ms"]) / 1000.0
        if duration_s >= min_duration_s:
            windows.append(current)
    return windows


def analyze_events(
    video_id: str,
    frame_stats: list[dict[str, Any]],
    track_histories: dict[str, list[dict[str, Any]]],
    source_name: str,
) -> tuple[list[dict[str, Any]], set[str]]:
    events: list[dict[str, Any]] = []
    use_cases: set[str] = {"object_detection_tracking"}

    visible_counts = [f["visible_vehicle_count"] for f in frame_stats] or [0]
    queue_threshold = max(10, int(np.percentile(visible_counts, 80)))
    low_motion_ratio_threshold = 0.38

    queue_windows = collapse_windows(
        frame_stats,
        lambda f: (
            f["visible_vehicle_count"] >= queue_threshold
            and f["visible_vehicle_count"] > 0
            and (f["low_motion_vehicle_count"] / f["visible_vehicle_count"]) >= low_motion_ratio_threshold
        ),
        min_duration_s=8.0,
    )
    for idx, window in enumerate(queue_windows, start=1):
        zone_mc = Counter(
            f["dominant_zone"] for f in window if f["dominant_zone"] != "background"
        ).most_common(1)
        zone_name = zone_mc[0][0] if zone_mc else "junction_core"
        peak = max(f["visible_vehicle_count"] for f in window)
        severity = "high" if peak >= queue_threshold + 6 else "medium"
        events.append(build_event(
            f"{video_id}-queue-{idx}", "queue_pressure", severity,
            window[0]["time_ms"], window[-1]["time_ms"], zone_name,
            min(0.96, 0.62 + peak / max(queue_threshold + 10, 1) * 0.25),
            f"Persistent low-motion traffic detected on the {ZONE_LABELS.get(zone_name, zone_name)}.",
            f"Consider green extension for the {ZONE_LABELS.get(zone_name, zone_name)}.",
            video_id,
        ))
        use_cases.add("queue_monitoring")

    ped_windows = collapse_windows(
        frame_stats,
        lambda f: f["person_count"] >= 1 and f["dominant_zone"] in {"junction_core", "south_approach", "east_approach"},
        min_duration_s=2.5,
    )
    for idx, window in enumerate(ped_windows, start=1):
        zone_name = Counter(f["dominant_zone"] for f in window).most_common(1)[0][0]
        events.append(build_event(
            f"{video_id}-ped-{idx}", "pedestrian_presence", "medium",
            window[0]["time_ms"], window[-1]["time_ms"], zone_name, 0.78,
            f"Pedestrian activity near {ZONE_LABELS.get(zone_name, zone_name)}.",
            "Confirm pedestrian protection timing in the next signal cycle.",
            video_id,
        ))
        use_cases.add("pedestrian_awareness")

    stationary_candidates = []
    for track_id, history in track_histories.items():
        if not history or history[0]["class_name"] == "person":
            continue
        duration_s = (history[-1]["time_ms"] - history[0]["time_ms"]) / 1000.0
        if duration_s < 8.0:
            continue
        total_dist = sum(
            math.dist((a["cx"], a["cy"]), (b["cx"], b["cy"]))
            for a, b in zip(history, history[1:])
        )
        avg_speed = total_dist / max(duration_s, 0.1)
        dominant_zone = Counter(
            h["zone"] for h in history if h["zone"] != "background"
        ).most_common(1)
        zone_name = dominant_zone[0][0] if dominant_zone else "junction_core"
        if avg_speed <= 0.02 and zone_name in {"junction_core", "east_approach", "south_approach", "west_approach"}:
            stationary_candidates.append((track_id, history, zone_name))

    for idx, (track_id, history, zone_name) in enumerate(stationary_candidates[:3], start=1):
        events.append(build_event(
            f"{video_id}-stop-{idx}", "abnormal_stopping", "medium",
            history[0]["time_ms"], history[-1]["time_ms"], zone_name, 0.71,
            f"Track {track_id} remained stationary in the {ZONE_LABELS.get(zone_name, zone_name)}.",
            "Inspect for lane blockage or stalled vehicle.",
            video_id,
        ))
        use_cases.add("abnormal_stop_detection")

    if "crash" in source_name.lower() or "scene builder" in source_name.lower():
        end_ms = frame_stats[-1]["time_ms"] if frame_stats else 12000
        events.insert(0, build_event(
            f"{video_id}-crash-demo", "incident_crash", "high",
            0, end_ms, "junction_core", 0.99,
            "Synthetic crash scene — demonstrates end-to-end incident workflow.",
            "Raise critical alert, freeze conflicting movements, dispatch responders.",
            video_id,
        ))
        use_cases.add("incident_workflow")

    if any(f["bus_count"] > 0 or f["truck_count"] > 0 for f in frame_stats):
        use_cases.add("heavy_vehicle_awareness")

    return events, use_cases


# ── Core processing ───────────────────────────────────────────────────────────

def process_video(
    source_path: Path,
    output_tracking_path: Path,
    output_preview_path: Path,
    output_thumb_path: Path,
    model_name: str,
    inference_fps: float,
    preview_width: int,
    force: bool,
) -> ProcessedVideo:
    """Process a single video file.

    The output preview mp4 is written at the full source FPS so playback is
    always smooth.  YOLO inference runs at `inference_fps` (typically 10 fps).
    Frames between YOLO ticks carry the previous detection result so bounding
    boxes do not flicker or disappear.
    """
    video_id = slugify(source_path.stem)

    # Return cached result if all artefacts exist
    if not force and output_tracking_path.exists() and output_preview_path.exists() and output_thumb_path.exists():
        cached = json.loads(output_tracking_path.read_text(encoding="utf-8"))
        return ProcessedVideo(
            manifest_entry=cached["manifest_entry"],
            supported_use_cases=set(cached["supported_use_cases"]),
        )

    print(f"\n{'='*60}")
    print(f"  Processing: {source_path.name}")
    print(f"{'='*60}")

    model = YOLO(model_name)

    cap = cv2.VideoCapture(str(source_path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {source_path}")

    source_fps    = cap.get(cv2.CAP_PROP_FPS) or 30.0
    source_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    source_w      = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)  or 0)
    source_h      = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    duration_s    = source_frames / source_fps if source_fps else 0.0
    preview_h     = int(round(source_h * (preview_width / max(source_w, 1))))

    # Inference runs every `infer_step` frames (e.g. every 3rd frame at 30fps/10fps)
    infer_step = max(1, int(round(source_fps / inference_fps)))
    actual_inference_fps = source_fps / infer_step

    print(f"  Source     : {source_w}x{source_h} @ {source_fps:.1f} fps  ({source_frames} frames, {duration_s:.1f}s)")
    print(f"  Preview    : {preview_width}x{preview_h} @ {source_fps:.1f} fps  (all frames written — smooth)")
    print(f"  Inference  : every {infer_step} frame(s) = {actual_inference_fps:.1f} fps")
    print(f"  Model      : {model_name}")

    ensure_dir(output_tracking_path.parent)
    ensure_dir(output_preview_path.parent)
    ensure_dir(output_thumb_path.parent)

    # Write preview at FULL source_fps so playback is smooth
    writer = cv2.VideoWriter(
        str(output_preview_path),
        cv2.VideoWriter_fourcc(*"avc1"),
        source_fps,
        (preview_width, preview_h),
    )
    if not writer.isOpened():
        raise RuntimeError(f"Cannot open video writer: {output_preview_path}")

    frame_idx     = 0
    frames_written = 0
    frame_stats: list[dict[str, Any]] = []
    frames_payload: dict[str, list[dict[str, Any]]] = {}
    track_histories: dict[str, list[dict[str, Any]]] = defaultdict(list)
    unique_track_classes: dict[str, str] = {}
    last_detections: list[dict[str, Any]] = []   # last YOLO result for inter-frame reuse
    last_vehicle_count = 0
    thumb_written = False

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        resized = cv2.resize(frame, (preview_width, preview_h))
        time_ms = int(round((frame_idx / source_fps) * 1000))
        is_inference_frame = (frame_idx % infer_step == 0)

        # ── YOLO inference on selected frames ──────────────────────
        if is_inference_frame:
            results = model.track(
                resized,
                persist=True,
                verbose=False,
                tracker="botsort.yaml",
                classes=sorted(ALLOWED_CLASSES),
                imgsz=preview_width,
                conf=0.35,
                iou=0.45,
                device="mps",
            )
            boxes = results[0].boxes if results and results[0].boxes is not None else None
            detections: list[dict[str, Any]] = []

            zone_counts: Counter[str] = Counter()
            class_counts: Counter[str] = Counter()
            low_motion_count = 0
            vehicle_count = 0
            person_count = bus_count = truck_count = 0

            if boxes is not None and len(boxes):
                for i in range(len(boxes)):
                    cls_id     = int(boxes[i].cls[0].cpu().item())
                    class_name = model.names[cls_id]
                    confidence = float(boxes[i].conf[0].cpu().item())
                    x1n, y1n, x2n, y2n = boxes[i].xyxyn[0].cpu().numpy().tolist()
                    track_id   = f"{class_name}-{i}"
                    if boxes[i].id is not None:
                        track_id = f"{class_name}-{int(boxes[i].id[0].cpu().item())}"

                    wn = max(0.0, x2n - x1n)
                    hn = max(0.0, y2n - y1n)
                    
                    # Filtering out tiny detections (noise in background)
                    if wn * hn < 0.0008:
                        continue

                    cx = x1n + wn / 2.0
                    cy = y1n + hn / 2.0
                    zone_name = assign_zone(cx, cy)

                    history = track_histories[track_id]
                    speed_norm = 0.0
                    if history:
                        prev = history[-1]
                        dt   = max((time_ms - prev["time_ms"]) / 1000.0, 0.1)
                        speed_norm = math.dist((cx, cy), (prev["cx"], prev["cy"])) / dt

                    motion = (
                        "moving"  if speed_norm >= 0.04  else
                        "slow"    if speed_norm >= 0.015 else
                        "stopped"
                    )
                    history.append({"time_ms": time_ms, "cx": cx, "cy": cy,
                                    "zone": zone_name, "class_name": class_name})
                    unique_track_classes.setdefault(track_id, class_name)

                    det = {
                        "track_id": track_id,
                        "class_name": class_name,
                        "confidence": round(confidence, 3),
                        "motion_state": motion,
                        "zone": zone_name,
                        "bbox_norm": {"x": round(x1n, 4), "y": round(y1n, 4),
                                      "w": round(wn, 4),  "h": round(hn, 4)},
                        "center_norm": {"x": round(cx, 4), "y": round(cy, 4)},
                        "speed_norm_s": round(speed_norm, 4),
                    }
                    detections.append(det)
                    class_counts[class_name] += 1
                    zone_counts[zone_name]   += 1

                    if class_name == "person":
                        person_count += 1
                    else:
                        vehicle_count += 1
                        if motion == "stopped":
                            low_motion_count += 1
                    if class_name == "bus":
                        bus_count += 1
                    if class_name == "truck":
                        truck_count += 1

            last_detections  = detections
            last_vehicle_count = vehicle_count

            dominant_zone = zone_counts.most_common(1)[0][0] if zone_counts else "background"
            frames_payload[str(time_ms)] = detections
            frame_stats.append({
                "time_ms": time_ms,
                "visible_vehicle_count": vehicle_count,
                "person_count": person_count,
                "bus_count": bus_count,
                "truck_count": truck_count,
                "low_motion_vehicle_count": low_motion_count,
                "class_counts": dict(class_counts),
                "zone_counts": dict(zone_counts),
                "dominant_zone": dominant_zone,
            })

        # ── Draw overlay on EVERY frame using last YOLO result ──────
        inference_tag = "INFER" if is_inference_frame else f"hold x{infer_step}"
        draw_detections_on_frame(resized, last_detections, preview_width, preview_h)
        draw_hud(resized, frame_idx, source_fps, source_frames, last_vehicle_count, inference_tag)

        # Save thumbnail from first frame
        if not thumb_written:
            cv2.imwrite(str(output_thumb_path), resized)
            thumb_written = True

        writer.write(resized)
        frames_written += 1
        frame_idx += 1

        if frame_idx % 150 == 0 or frame_idx == source_frames:
            pct = frame_idx / max(source_frames, 1) * 100
            print(f"  [{pct:5.1f}%] frame {frame_idx:5d}/{source_frames}  "
                  f"vehicles: {last_vehicle_count:3d}  "
                  f"tracks: {len(unique_track_classes):4d}", end="\r")

    print()  # newline after progress
    cap.release()
    writer.release()

    total_inference_frames = len(frame_stats)
    print(f"  Written    : {frames_written} frames to preview mp4")
    print(f"  Inference  : {total_inference_frames} YOLO frames processed")
    print(f"  Tracks     : {len(unique_track_classes)} unique objects")

    events, supported_use_cases = analyze_events(
        video_id, frame_stats, track_histories, source_path.name
    )
    track_class_counts = Counter(unique_track_classes.values())
    peak_visible = max((f["visible_vehicle_count"] for f in frame_stats), default=0)
    avg_visible  = sum(f["visible_vehicle_count"] for f in frame_stats) / max(len(frame_stats), 1)
    person_frames = sum(1 for f in frame_stats if f["person_count"] > 0)

    manifest_entry: dict[str, Any] = {
        "id": video_id,
        "label": source_path.stem,
        "filename": source_path.name,
        "source_path": str(source_path),
        "preview_path": f"/app/media/video_previews/{output_preview_path.name}",
        "thumbnail_path": f"/app/media/video_thumbs/{output_thumb_path.name}",
        "tracking_path": f"/app/data/video_tracking/{output_tracking_path.name}",
        "duration_s": round(duration_s, 1),
        "source_fps": round(source_fps, 2),
        "preview_fps": round(source_fps, 2),   # preview is always at source fps
        "inference_fps": round(actual_inference_fps, 2),
        "processed_fps": round(source_fps, 2), # backward-compat alias
        "source_resolution": {"width": source_w, "height": source_h},
        "preview_resolution": {"width": preview_width, "height": preview_h},
        "total_unique_tracks": len(unique_track_classes),
        "track_class_counts": dict(track_class_counts),
        "peak_visible_vehicles": peak_visible,
        "average_visible_vehicles": round(avg_visible, 2),
        "frames_with_pedestrians": person_frames,
        "events": events,
        "summary": (
            f"{len(unique_track_classes)} unique objects tracked.  "
            f"Peak {peak_visible} vehicles visible; avg {avg_visible:.1f}/frame."
        ),
        "default_event_id": events[0]["event_id"] if events else None,
    }

    output_tracking_path.write_text(
        json.dumps({
            "video_id": video_id,
            "fps": round(source_fps, 3),          # JS uses this for time→frame mapping
            "inference_fps": round(actual_inference_fps, 3),
            "infer_step": infer_step,
            "frames": frames_payload,
            "frame_stats": frame_stats,
            "manifest_entry": manifest_entry,
            "supported_use_cases": sorted(supported_use_cases),
        }, indent=2),
        encoding="utf-8",
    )
    print(f"  Saved tracking: {output_tracking_path.name}")
    return ProcessedVideo(manifest_entry=manifest_entry, supported_use_cases=supported_use_cases)


# ── Use-case card builder ──────────────────────────────────────────────────────

def build_use_case_cards(
    videos: list[dict[str, Any]],
    use_case_hits: dict[str, list[str]],
) -> list[dict[str, Any]]:
    labels = {
        "object_detection_tracking": (
            "Object Detection + Tracking",
            "Vehicle, bus, truck, motorcycle, and pedestrian tracks extracted from recorded camera video.",
        ),
        "queue_monitoring": (
            "Queue / Spillback Monitoring",
            "Low-motion clusters and sustained queue windows flagged from the video feed.",
        ),
        "pedestrian_awareness": (
            "Pedestrian Awareness",
            "Pedestrian activity near the junction core and conflict zones is flagged.",
        ),
        "abnormal_stop_detection": (
            "Abnormal Stopping",
            "Long stationary vehicle tracks highlighted as stalled-vehicle candidates.",
        ),
        "incident_workflow": (
            "Incident / Crash Workflow",
            "Confirmed crash clip escalates into alerts and recommendations in the GUI.",
        ),
        "heavy_vehicle_awareness": (
            "Bus and Heavy Vehicle Awareness",
            "Bus and truck presence measured for mixed-traffic signal pressure.",
        ),
    }
    cards = []
    for uid, (title, desc) in labels.items():
        evidence = use_case_hits.get(uid, [])
        cards.append({
            "id": uid, "title": title, "description": desc,
            "status": "proven" if evidence else "supported",
            "evidence_video_ids": evidence,
        })
    return cards


# ── CLI ────────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build Wadi Saqra video analytics dataset.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--source-root",
        default=str(DEFAULT_SOURCE_ROOT),
        help="Directory containing the raw video files.",
    )
    parser.add_argument(
        "--model",
        default=None,
        help="YOLO model path or name (e.g. yolo26x.pt).  Defaults to yolo26x (auto-downloaded).",
    )
    parser.add_argument(
        "--inference-fps",
        type=float,
        default=10.0,
        help="YOLO inference rate (fps).  Output video is always at full source fps.",
    )
    parser.add_argument(
        "--sample-fps",
        type=float,
        default=None,
        help="Alias for --inference-fps (backward compat).",
    )
    parser.add_argument(
        "--preview-width",
        type=int,
        default=1280,
        help="Preview video width in pixels.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Reprocess even if cached artefacts exist.",
    )
    parser.add_argument(
        "--merge",
        action="store_true",
        default=True,
        help="Merge new results with existing manifest (keep videos whose source is gone). Default: true.",
    )
    parser.add_argument(
        "--no-merge",
        dest="merge",
        action="store_false",
        help="Overwrite manifest completely (do not merge with existing).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    # --sample-fps is a backward-compat alias
    inference_fps = args.sample_fps if args.sample_fps is not None else args.inference_fps

    source_root = Path(args.source_root).expanduser().resolve()
    if not source_root.exists():
        raise FileNotFoundError(f"Source directory not found: {source_root}")

    _, model_name = load_model(args.model)

    preview_root  = MEDIA_ROOT / "video_previews"
    thumb_root    = MEDIA_ROOT / "video_thumbs"
    tracking_root = DATA_ROOT  / "video_tracking"
    manifest_path = DATA_ROOT  / "video_analytics_manifest.json"
    ensure_dir(preview_root)
    ensure_dir(thumb_root)
    ensure_dir(tracking_root)

    processed_videos: list[ProcessedVideo] = []
    use_case_hits: dict[str, list[str]] = defaultdict(list)

    video_paths = sorted(
        p for p in source_root.glob("*")
        if p.suffix.lower() in {".mov", ".mp4"}
    )
    if not video_paths:
        raise FileNotFoundError(f"No .mp4 or .mov files found in {source_root}")

    print(f"\nFound {len(video_paths)} video(s) in {source_root}")
    for video_path in video_paths:
        video_id = slugify(video_path.stem)
        pv = process_video(
            source_path=video_path,
            output_tracking_path=tracking_root / f"{video_id}.json",
            output_preview_path=preview_root  / f"{video_id}.mp4",
            output_thumb_path=thumb_root      / f"{video_id}.jpg",
            model_name=model_name,
            inference_fps=inference_fps,
            preview_width=args.preview_width,
            force=args.force,
        )
        processed_videos.append(pv)
        for uid in pv.supported_use_cases:
            use_case_hits[uid].append(pv.manifest_entry["id"])

    new_videos = [pv.manifest_entry for pv in processed_videos]
    new_ids    = {v["id"] for v in new_videos}

    # Merge: load existing manifest and keep videos that were NOT just rebuilt
    merged_videos: list[dict[str, Any]] = list(new_videos)
    if args.merge and manifest_path.exists():
        try:
            old_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            for old_v in old_manifest.get("videos", []):
                if old_v["id"] not in new_ids:
                    merged_videos.append(old_v)
                    # Also pick up use-case hits from preserved videos
                    tracking_file = tracking_root / f"{old_v['id']}.json"
                    if tracking_file.exists():
                        try:
                            td = json.loads(tracking_file.read_text(encoding="utf-8"))
                            for uid in td.get("supported_use_cases", []):
                                use_case_hits[uid].append(old_v["id"])
                        except Exception:  # noqa: BLE001
                            pass
            if len(merged_videos) > len(new_videos):
                print(f"  Merged {len(merged_videos) - len(new_videos)} preserved video(s) from existing manifest")
        except Exception as exc:  # noqa: BLE001
            print(f"  Warning: could not merge existing manifest: {exc}")

    videos     = merged_videos
    all_events = [ev for v in videos for ev in v["events"]]
    manifest   = {
        "generated_at": None,
        "source_root": str(source_root),
        "model_name": model_name,
        "inference_fps": inference_fps,
        "preview_fps": None,   # varies per video
        "preview_width": args.preview_width,
        "videos": videos,
        "use_cases": build_use_case_cards(videos, use_case_hits),
        "summary": {
            "video_count": len(videos),
            "total_duration_s": round(sum(v["duration_s"] for v in videos), 1),
            "total_events": len(all_events),
            "high_severity_events": sum(1 for e in all_events if e["severity"] == "high"),
            "tracked_objects": sum(v["total_unique_tracks"] for v in videos),
        },
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\n{'='*60}")
    print(f"  Manifest written: {manifest_path}")
    print(json.dumps(manifest["summary"], indent=2))


if __name__ == "__main__":
    main()
