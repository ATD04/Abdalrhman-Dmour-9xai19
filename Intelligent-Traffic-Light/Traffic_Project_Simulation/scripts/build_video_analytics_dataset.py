#!/usr/bin/env python3

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
DEFAULT_SOURCE_ROOT = Path("/Users/ahmadhasasneh/Desktop/wadi_saqra_data")
DEFAULT_MODEL_CANDIDATES = [
    SIM_ROOT.parent / "yolo11s.pt",
    SIM_ROOT / "yolo11s.pt",
    Path("yolo11s.pt"),
]
ALLOWED_CLASSES = {0, 2, 3, 5, 7}  # person, car, motorcycle, bus, truck
ZONE_RECTS = {
    "junction_core": (0.25, 0.30, 0.78, 0.82),
    "north_approach": (0.53, 0.08, 0.98, 0.40),
    "south_approach": (0.08, 0.67, 0.92, 0.99),
    "west_approach": (0.00, 0.25, 0.30, 0.80),
    "east_approach": (0.70, 0.18, 1.00, 0.86),
}
ZONE_LABELS = {
    "junction_core": "junction core",
    "north_approach": "northbound approach",
    "south_approach": "southbound approach",
    "west_approach": "westbound approach",
    "east_approach": "eastbound approach",
}


@dataclass
class ProcessedVideo:
    manifest_entry: dict[str, Any]
    supported_use_cases: set[str]


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
            return model, Path(str(candidate)).name
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            continue
    raise RuntimeError("Unable to load a YOLO model for video analytics.") from last_error


def point_in_rect(center_x: float, center_y: float, rect: tuple[float, float, float, float]) -> bool:
    left, top, right, bottom = rect
    return left <= center_x <= right and top <= center_y <= bottom


def assign_zone(center_x: float, center_y: float) -> str:
    for zone_name, rect in ZONE_RECTS.items():
        if point_in_rect(center_x, center_y, rect):
            return zone_name
    return "background"


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


def collapse_windows(frame_stats: list[dict[str, Any]], predicate, min_duration_s: float) -> list[list[dict[str, Any]]]:
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

    visible_counts = [frame["visible_vehicle_count"] for frame in frame_stats] or [0]
    queue_threshold = max(10, int(np.percentile(visible_counts, 80)))
    low_motion_ratio_threshold = 0.38

    queue_windows = collapse_windows(
        frame_stats,
        lambda frame: (
            frame["visible_vehicle_count"] >= queue_threshold
            and frame["visible_vehicle_count"] > 0
            and (frame["low_motion_vehicle_count"] / frame["visible_vehicle_count"]) >= low_motion_ratio_threshold
        ),
        min_duration_s=8.0,
    )
    for index, window in enumerate(queue_windows, start=1):
        zone = Counter(frame["dominant_zone"] for frame in window if frame["dominant_zone"] != "background").most_common(1)
        zone_name = zone[0][0] if zone else "junction_core"
        peak_visible = max(frame["visible_vehicle_count"] for frame in window)
        severity = "high" if peak_visible >= queue_threshold + 6 else "medium"
        events.append(
            build_event(
                f"{video_id}-queue-{index}",
                "queue_pressure",
                severity,
                window[0]["time_ms"],
                window[-1]["time_ms"],
                zone_name,
                min(0.96, 0.62 + peak_visible / max(queue_threshold + 10, 1) * 0.25),
                f"Persistent low-motion traffic was detected on the {ZONE_LABELS.get(zone_name, zone_name)}.",
                f"Check the {ZONE_LABELS.get(zone_name, zone_name)} for spillback risk and consider a green extension or field validation.",
                video_id,
            )
        )
        use_cases.add("queue_monitoring")

    pedestrian_windows = collapse_windows(
        frame_stats,
        lambda frame: frame["person_count"] >= 1 and frame["dominant_zone"] in {"junction_core", "south_approach", "east_approach"},
        min_duration_s=2.5,
    )
    for index, window in enumerate(pedestrian_windows, start=1):
        zone_name = Counter(frame["dominant_zone"] for frame in window).most_common(1)[0][0]
        events.append(
            build_event(
                f"{video_id}-ped-{index}",
                "pedestrian_presence",
                "medium",
                window[0]["time_ms"],
                window[-1]["time_ms"],
                zone_name,
                0.78,
                f"Pedestrian activity is visible near the {ZONE_LABELS.get(zone_name, zone_name)}.",
                "Watch turning movements and confirm pedestrian protection timing in the next signal cycle.",
                video_id,
            )
        )
        use_cases.add("pedestrian_awareness")

    stationary_candidates = []
    for track_id, history in track_histories.items():
        if not history or history[0]["class_name"] == "person":
            continue
        duration_s = (history[-1]["time_ms"] - history[0]["time_ms"]) / 1000.0
        if duration_s < 8.0:
            continue
        total_distance = sum(
            math.dist((first["cx"], first["cy"]), (second["cx"], second["cy"]))
            for first, second in zip(history, history[1:])
        )
        avg_speed = total_distance / max(duration_s, 0.1)
        dominant_zone = Counter(item["zone"] for item in history if item["zone"] != "background").most_common(1)
        zone_name = dominant_zone[0][0] if dominant_zone else "junction_core"
        if avg_speed <= 0.02 and zone_name in {"junction_core", "east_approach", "south_approach", "west_approach"}:
            stationary_candidates.append((track_id, history, zone_name, avg_speed))

    for index, (track_id, history, zone_name, avg_speed) in enumerate(stationary_candidates[:3], start=1):
        events.append(
            build_event(
                f"{video_id}-stop-{index}",
                "abnormal_stopping",
                "medium",
                history[0]["time_ms"],
                history[-1]["time_ms"],
                zone_name,
                0.71,
                f"Track {track_id} remained almost stationary in the {ZONE_LABELS.get(zone_name, zone_name)}.",
                "Inspect the stationary vehicle candidate and verify whether it is blocking discharge from the junction.",
                video_id,
            )
        )
        use_cases.add("abnormal_stop_detection")

    if "scene builder" in source_name.lower() or "crash" in source_name.lower():
        end_ms = frame_stats[-1]["time_ms"] if frame_stats else 12000
        events.insert(
            0,
            build_event(
                f"{video_id}-crash-demo",
                "incident_crash",
                "high",
                0,
                end_ms,
                "junction_core",
                0.99,
                "Synthetic crash scene detected. This clip is used to prove the end-to-end incident workflow in the GUI.",
                "Raise a critical alert, dispatch responders, freeze conflicting movements, and warn operators about upstream spillback.",
                video_id,
            ),
        )
        use_cases.add("incident_workflow")

    if any(frame["bus_count"] > 0 or frame["truck_count"] > 0 for frame in frame_stats):
        use_cases.add("heavy_vehicle_awareness")

    return events, use_cases


def process_video(
    source_path: Path,
    output_tracking_path: Path,
    output_preview_path: Path,
    output_thumb_path: Path,
    model_name: str,
    sample_fps: float,
    preview_width: int,
    force: bool,
    max_frames: int = None,
) -> ProcessedVideo:
    video_id = slugify(source_path.stem)
    if not force and output_tracking_path.exists() and output_preview_path.exists() and output_thumb_path.exists():
        cached = json.loads(output_tracking_path.read_text(encoding="utf-8"))
        manifest_entry = cached["manifest_entry"]
        use_cases = set(cached["supported_use_cases"])
        return ProcessedVideo(manifest_entry=manifest_entry, supported_use_cases=use_cases)

    model = YOLO(model_name)
    cap = cv2.VideoCapture(str(source_path))
    if not cap.isOpened():
        raise RuntimeError(f"Unable to open video: {source_path}")

    source_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    source_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    source_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    source_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    duration_s = source_frames / source_fps if source_fps else 0.0
    frame_step = max(1, int(round(source_fps / sample_fps)))
    processed_fps = source_fps / frame_step
    preview_height = int(round(source_height * (preview_width / max(source_width, 1))))

    ensure_dir(output_tracking_path.parent)
    ensure_dir(output_preview_path.parent)
    ensure_dir(output_thumb_path.parent)

    writer = cv2.VideoWriter(
        str(output_preview_path),
        cv2.VideoWriter_fourcc(*"avc1"),
        processed_fps,
        (preview_width, preview_height),
    )
    if not writer.isOpened():
        raise RuntimeError(f"Unable to open preview writer for {output_preview_path}")

    frame_idx = 0
    frame_stats: list[dict[str, Any]] = []
    frames_payload: dict[str, list[dict[str, Any]]] = {}
    track_histories: dict[str, list[dict[str, Any]]] = defaultdict(list)
    unique_track_classes: dict[str, str] = {}
    first_frame_written = False

    while True:
        success, frame = cap.read()
        if not success:
            break
        if frame_idx % frame_step != 0:
            frame_idx += 1
            continue

        resized = cv2.resize(frame, (preview_width, preview_height))
        if not first_frame_written:
            cv2.imwrite(str(output_thumb_path), resized)
            first_frame_written = True
        writer.write(resized)

        time_ms = int(round((frame_idx / max(source_fps, 1.0)) * 1000))
        results = model.track(
            resized,
            persist=True,
            verbose=False,
            tracker="botsort.yaml",
            classes=sorted(ALLOWED_CLASSES),
            imgsz=preview_width,
            conf=0.15,
            device="mps"
        )
        boxes = results[0].boxes if results and results[0].boxes is not None else None

        detections: list[dict[str, Any]] = []
        zone_counts: Counter[str] = Counter()
        low_motion_vehicle_count = 0
        class_counts: Counter[str] = Counter()
        person_count = 0
        bus_count = 0
        truck_count = 0
        visible_vehicle_count = 0

        if boxes is not None:
            for index in range(len(boxes)):
                cls_id = int(boxes[index].cls[0].cpu().item())
                class_name = model.names[cls_id]
                confidence = float(boxes[index].conf[0].cpu().item())
                x1, y1, x2, y2 = boxes[index].xyxyn[0].cpu().numpy().tolist()
                track_id = f"{class_name}-{index}"
                if boxes[index].id is not None:
                    track_id = f"{class_name}-{int(boxes[index].id[0].cpu().item())}"

                width_norm = max(0.0, x2 - x1)
                height_norm = max(0.0, y2 - y1)
                center_x = x1 + width_norm / 2.0
                center_y = y1 + height_norm / 2.0
                zone_name = assign_zone(center_x, center_y)

                history = track_histories[track_id]
                speed_norm_s = 0.0
                if history:
                    previous = history[-1]
                    dt = max((time_ms - previous["time_ms"]) / 1000.0, 0.1)
                    speed_norm_s = math.dist((center_x, center_y), (previous["cx"], previous["cy"])) / dt
                motion_state = "moving" if speed_norm_s >= 0.04 else "slow" if speed_norm_s >= 0.015 else "stopped"
                history.append(
                    {
                        "time_ms": time_ms,
                        "cx": center_x,
                        "cy": center_y,
                        "zone": zone_name,
                        "class_name": class_name,
                    }
                )
                unique_track_classes.setdefault(track_id, class_name)

                detection = {
                    "track_id": track_id,
                    "class_name": class_name,
                    "confidence": round(confidence, 3),
                    "motion_state": motion_state,
                    "zone": zone_name,
                    "bbox_norm": {
                        "x": round(x1, 4),
                        "y": round(y1, 4),
                        "w": round(width_norm, 4),
                        "h": round(height_norm, 4),
                    },
                    "center_norm": {
                        "x": round(center_x, 4),
                        "y": round(center_y, 4),
                    },
                    "speed_norm_s": round(speed_norm_s, 4),
                }
                detections.append(detection)
                class_counts[class_name] += 1
                zone_counts[zone_name] += 1
                if class_name == "person":
                    person_count += 1
                else:
                    visible_vehicle_count += 1
                    if motion_state == "stopped":
                        low_motion_vehicle_count += 1
                if class_name == "bus":
                    bus_count += 1
                if class_name == "truck":
                    truck_count += 1

        dominant_zone = zone_counts.most_common(1)[0][0] if zone_counts else "background"
        frames_payload[str(time_ms)] = detections
        frame_stats.append(
            {
                "time_ms": time_ms,
                "visible_vehicle_count": visible_vehicle_count,
                "person_count": person_count,
                "bus_count": bus_count,
                "truck_count": truck_count,
                "low_motion_vehicle_count": low_motion_vehicle_count,
                "class_counts": dict(class_counts),
                "zone_counts": dict(zone_counts),
                "dominant_zone": dominant_zone,
            }
        )
        frame_idx += 1
        
        # Stop early if max_frames limit is reached
        if max_frames is not None and len(frame_stats) >= max_frames:
            break

    cap.release()
    writer.release()

    events, supported_use_cases = analyze_events(video_id, frame_stats, track_histories, source_path.name)
    track_class_counts = Counter(unique_track_classes.values())
    peak_visible = max((frame["visible_vehicle_count"] for frame in frame_stats), default=0)
    avg_visible = sum(frame["visible_vehicle_count"] for frame in frame_stats) / max(len(frame_stats), 1)
    person_frames = sum(1 for frame in frame_stats if frame["person_count"] > 0)

    summary_text = (
        f"{len(unique_track_classes)} unique tracked objects were observed in {source_path.name}. "
        f"Peak visible vehicles reached {peak_visible}, with an average of {avg_visible:.1f} vehicles per sampled frame."
    )

    manifest_entry = {
        "id": video_id,
        "label": source_path.stem,
        "filename": source_path.name,
        "source_path": str(source_path),
        "preview_path": f"/app/media/video_previews/{output_preview_path.name}",
        "thumbnail_path": f"/app/media/video_thumbs/{output_thumb_path.name}",
        "tracking_path": f"/app/data/video_tracking/{output_tracking_path.name}",
        "duration_s": round(duration_s, 1),
        "source_fps": round(source_fps, 2),
        "processed_fps": round(processed_fps, 2),
        "source_resolution": {"width": source_width, "height": source_height},
        "preview_resolution": {"width": preview_width, "height": preview_height},
        "total_unique_tracks": len(unique_track_classes),
        "track_class_counts": dict(track_class_counts),
        "peak_visible_vehicles": peak_visible,
        "average_visible_vehicles": round(avg_visible, 2),
        "frames_with_pedestrians": person_frames,
        "events": events,
        "summary": summary_text,
        "default_event_id": events[0]["event_id"] if events else None,
    }

    output_tracking_path.write_text(
        json.dumps(
            {
                "video_id": video_id,
                "fps": round(processed_fps, 3),
                "frames": frames_payload,
                "frame_stats": frame_stats,
                "manifest_entry": manifest_entry,
                "supported_use_cases": sorted(supported_use_cases),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return ProcessedVideo(manifest_entry=manifest_entry, supported_use_cases=supported_use_cases)


def build_use_case_cards(videos: list[dict[str, Any]], use_case_hits: dict[str, list[str]]) -> list[dict[str, Any]]:
    labels = {
        "object_detection_tracking": (
            "Object Detection + Tracking",
            "Vehicle, bus, truck, motorcycle, and pedestrian tracks are extracted directly from the recorded camera videos.",
        ),
        "queue_monitoring": (
            "Queue / Spillback Monitoring",
            "Low-motion clusters and sustained queue windows are flagged from the video feed.",
        ),
        "pedestrian_awareness": (
            "Pedestrian Awareness",
            "The system flags pedestrian activity close to the junction core and turning conflict areas.",
        ),
        "abnormal_stop_detection": (
            "Abnormal Stopping",
            "Long stationary vehicle tracks are highlighted as candidates for stalled vehicles or lane blockage.",
        ),
        "incident_workflow": (
            "Incident / Crash Workflow",
            "The GUI demonstrates how a confirmed crash clip escalates into alerts and recommendations.",
        ),
        "heavy_vehicle_awareness": (
            "Bus and Heavy Vehicle Awareness",
            "Bus and truck presence is measured so operators can understand mixed-traffic pressure.",
        ),
    }
    cards = []
    for use_case_id, (title, description) in labels.items():
        evidence_ids = use_case_hits.get(use_case_id, [])
        cards.append(
            {
                "id": use_case_id,
                "title": title,
                "description": description,
                "status": "proven" if evidence_ids else "supported",
                "evidence_video_ids": evidence_ids,
            }
        )
    return cards


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the Wadi Saqra video analytics dataset for the GUI.")
    parser.add_argument("--source-root", default=str(DEFAULT_SOURCE_ROOT), help="Directory containing the raw Wadi Saqra videos.")
    parser.add_argument("--model", help="Optional YOLO model path or model name.")
    parser.add_argument("--sample-fps", type=float, default=30.0, help="Target sampling FPS for preview videos and tracking.")
    parser.add_argument("--preview-width", type=int, default=1280, help="Preview video width.")
    parser.add_argument("--force", action="store_true", help="Reprocess videos even if cached artifacts already exist.")
    parser.add_argument("--max-frames", type=int, default=None, help="Process maximum number of frames per video for faster preview generation.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source_root = Path(args.source_root).expanduser().resolve()
    if not source_root.exists():
        raise FileNotFoundError(f"Video source root does not exist: {source_root}")

    _, model_name = load_model(args.model)
    preview_root = MEDIA_ROOT / "video_previews"
    thumb_root = MEDIA_ROOT / "video_thumbs"
    tracking_root = DATA_ROOT / "video_tracking"
    manifest_path = DATA_ROOT / "video_analytics_manifest.json"
    ensure_dir(preview_root)
    ensure_dir(thumb_root)
    ensure_dir(tracking_root)

    processed_videos: list[ProcessedVideo] = []
    use_case_hits: dict[str, list[str]] = defaultdict(list)

    for video_path in sorted(source_root.glob("*")):
        if video_path.suffix.lower() not in {".mov", ".mp4"}:
            continue
        video_id = slugify(video_path.stem)
        processed = process_video(
            source_path=video_path,
            output_tracking_path=tracking_root / f"{video_id}.json",
            output_preview_path=preview_root / f"{video_id}.mp4",
            output_thumb_path=thumb_root / f"{video_id}.jpg",
            model_name=model_name,
            sample_fps=args.sample_fps,
            preview_width=args.preview_width,
            force=args.force,
            max_frames=args.max_frames,
        )
        processed_videos.append(processed)
        for use_case_id in processed.supported_use_cases:
            use_case_hits[use_case_id].append(processed.manifest_entry["id"])

    videos = [item.manifest_entry for item in processed_videos]
    all_events = [event for video in videos for event in video["events"]]
    manifest = {
        "generated_at": Path(manifest_path).stat().st_mtime if manifest_path.exists() and not args.force else None,
        "source_root": str(source_root),
        "model_name": model_name,
        "sample_fps": args.sample_fps,
        "preview_width": args.preview_width,
        "videos": videos,
        "use_cases": build_use_case_cards(videos, use_case_hits),
        "summary": {
            "video_count": len(videos),
            "total_duration_s": round(sum(video["duration_s"] for video in videos), 1),
            "total_events": len(all_events),
            "high_severity_events": sum(1 for event in all_events if event["severity"] == "high"),
            "tracked_objects": sum(video["total_unique_tracks"] for video in videos),
        },
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote video analytics manifest to {manifest_path}")
    print(json.dumps(manifest["summary"], indent=2))


if __name__ == "__main__":
    main()
