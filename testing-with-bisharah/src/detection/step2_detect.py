"""
STEP 2 — Vehicle Detection & Counting per Signal
--------------------------------------------------
After running step1_find_zones.py, paste your zone coordinates
into the ZONES section below, then run this script.

Output:
  - Live window showing detection boxes and zone counts
  - Final count per direction printed to terminal
  - CSV saved to Data/output/counts.csv
"""

import cv2
import numpy as np
import csv
from ultralytics import YOLO
from datetime import datetime

# ── Config ───────────────────────────────────────────────────────────────────
VIDEO_PATH  = "Data/Video/stable_video.mp4"
OUTPUT_CSV  = "Data/output/counts.csv"
MODEL_NAME  = "yolo26n.pt"    # downloads automatically on first run
CONFIDENCE  = 0.4             # minimum confidence threshold
SKIP_FRAMES = 3               # process every Nth frame (3 = faster, 1 = most accurate)

# ── Vehicle class IDs (COCO dataset) ─────────────────────────────────────────
VEHICLE_CLASSES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}

# ── ZONES ─────────────────────────────────────────────────────────────────────
# Video: stable_video.mp4  —  1920x1080
# Clicked coords × 1.2 (display was 1600px wide, original is 1920px wide)
ZONES = {
    "North": np.array([
        [874,  490],
        [572,  456],
        [744,  379],
        [1036, 425],
    ]),
    "South": np.array([
        [706,  691],
        [1061, 740],
        [730,  980],
        [386,  839],
    ]),
    "East": np.array([
        [1350, 539],
        [1226, 622],
        [1664, 677],
        [1711, 523],
    ]),
    "West": np.array([
        [293,  522],
        [44,   619],
        [0,    576],
        [197,  503],
    ]),
}

# Zone display colors (BGR)
ZONE_COLORS = {
    "North": (0, 255, 0),      # Green
    "South": (0, 0, 255),      # Red
    "East":  (255, 100, 0),    # Blue
    "West":  (0, 165, 255),    # Orange
}

# ── Helper: check if a vehicle box overlaps with a zone ─────────────────────
# Tests 5 key points of the bounding box — if ANY point is inside the zone,
# the vehicle is counted. This catches cars that are partially in the zone.
def box_in_zone(x1, y1, x2, y2, polygon):
    # bottom-center (where car touches ground), center, and 3 other key points
    points = [
        ((x1 + x2) / 2, y2),          # bottom-center  ← most important
        ((x1 + x2) / 2, (y1 + y2) / 2),  # center
        (x1 + (x2 - x1) * 0.25, y2),  # bottom-left quarter
        (x1 + (x2 - x1) * 0.75, y2),  # bottom-right quarter
        ((x1 + x2) / 2, y1 + (y2 - y1) * 0.75),  # lower body
    ]
    for px, py in points:
        if cv2.pointPolygonTest(polygon, (int(px), int(py)), False) >= 0:
            return True
    return False

# ── Draw zones on frame ───────────────────────────────────────────────────────
def draw_zones(frame):
    overlay = frame.copy()
    for name, polygon in ZONES.items():
        color = ZONE_COLORS[name]
        cv2.fillPoly(overlay, [polygon], (*color[::-1][:3], 40))  # semi-transparent fill
        cv2.polylines(frame, [polygon], True, color, 3)
        cx = int(polygon[:, 0].mean())
        cy = int(polygon[:, 1].mean())
        cv2.putText(frame, name, (cx - 30, cy),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.2, color, 3)
    cv2.addWeighted(overlay, 0.15, frame, 0.85, 0, frame)
    return frame

# ── Draw live counts ──────────────────────────────────────────────────────────
def draw_counts(frame, counts):
    panel_h = 40 + len(counts) * 40
    cv2.rectangle(frame, (10, 10), (300, panel_h), (0, 0, 0), -1)
    cv2.rectangle(frame, (10, 10), (300, panel_h), (255, 255, 255), 2)
    cv2.putText(frame, "VEHICLE COUNTS", (20, 38),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    for i, (direction, count) in enumerate(counts.items()):
        color = ZONE_COLORS[direction]
        cv2.putText(frame, f"{direction}: {count}",
                    (20, 75 + i * 38),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)
    return frame

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("Loading YOLO26 model...")
    model = YOLO(MODEL_NAME)
    print("✓ Model loaded")

    cap = cv2.VideoCapture(VIDEO_PATH)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps          = cap.get(cv2.CAP_PROP_FPS)
    w            = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h            = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"Video: {w}x{h} @ {fps:.1f}fps — {total_frames} frames")

    # Per-zone tracking: set of vehicle IDs seen in each zone (avoids double counting)
    seen_ids = {zone: set() for zone in ZONES}
    counts   = {zone: 0     for zone in ZONES}

    # CSV log
    csv_rows = [["timestamp", "frame", "direction", "vehicle_id", "vehicle_type", "confidence"]]

    frame_num = 0
    start_time = datetime.now()

    # Display scale (for showing on screen — original resolution may be too large)
    display_scale = min(1.0, 1400 / w)

    print("\nPress Q to quit early.\n")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_num += 1

        # Skip frames for speed
        if frame_num % SKIP_FRAMES != 0:
            continue

        # Run YOLO26 with ByteTrack
        results = model.track(
            frame,
            tracker="bytetrack.yaml",
            persist=True,
            verbose=False,
            conf=CONFIDENCE,
            classes=list(VEHICLE_CLASSES.keys()),
        )

        if (results[0].boxes is not None and
                results[0].boxes.id is not None and
                len(results[0].boxes) > 0):

            boxes      = results[0].boxes.xyxy.cpu().numpy()
            track_ids  = results[0].boxes.id.cpu().numpy().astype(int)
            class_ids  = results[0].boxes.cls.cpu().numpy().astype(int)
            confs      = results[0].boxes.conf.cpu().numpy()

            for box, tid, cid, conf in zip(boxes, track_ids, class_ids, confs):
                x1, y1, x2, y2 = map(int, box)

                # Draw bounding box
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 255), 2)
                cv2.putText(frame, f"#{tid}", (x1, y1 - 6),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
                # Draw bottom-center dot (the ground point used for zone detection)
                bc = ((x1 + x2) // 2, y2)
                cv2.circle(frame, bc, 4, (0, 255, 255), -1)

                # Check each zone using bounding box overlap (not just center point)
                for zone_name, polygon in ZONES.items():
                    if box_in_zone(x1, y1, x2, y2, polygon):
                        if tid not in seen_ids[zone_name]:
                            seen_ids[zone_name].add(tid)
                            counts[zone_name] += 1
                            vehicle_type = VEHICLE_CLASSES.get(cid, "vehicle")
                            ts = datetime.now().isoformat()
                            csv_rows.append([ts, frame_num, zone_name, tid, vehicle_type, f"{conf:.2f}"])
                            print(f"  [{zone_name}] {vehicle_type} #{tid} detected  |  "
                                  f"Total: N={counts['North']} S={counts['South']} "
                                  f"E={counts['East']} W={counts['West']}")

        # Draw zones and counts
        frame = draw_zones(frame)
        frame = draw_counts(frame, counts)

        # Progress
        progress = f"Frame {frame_num}/{total_frames}"
        cv2.putText(frame, progress, (w - 300, h - 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 2)

        # Resize for display
        display = cv2.resize(frame, (int(w * display_scale), int(h * display_scale)))
        cv2.imshow("Wadi Saqra — Vehicle Detection", display)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("\nStopped early by user.")
            break

    cap.release()
    cv2.destroyAllWindows()

    # Save CSV
    with open(OUTPUT_CSV, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerows(csv_rows)
    print(f"\n✓ CSV saved to {OUTPUT_CSV}")

    # Final results
    elapsed = (datetime.now() - start_time).seconds
    print()
    print("=" * 45)
    print("       FINAL VEHICLE COUNTS — WADI SAQRA")
    print("=" * 45)
    print(f"  North signal:  {counts['North']:>4} vehicles")
    print(f"  South signal:  {counts['South']:>4} vehicles")
    print(f"  East  signal:  {counts['East']:>4} vehicles")
    print(f"  West  signal:  {counts['West']:>4} vehicles")
    print("-" * 45)
    print(f"  TOTAL:         {sum(counts.values()):>4} vehicles")
    print("=" * 45)
    print(f"  Processed in {elapsed}s")

if __name__ == "__main__":
    main()
