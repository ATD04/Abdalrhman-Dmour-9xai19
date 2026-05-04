"""
Line-Crossing Vehicle Counter — Wadi Saqra
-------------------------------------------
Each car is counted ONCE per line when:
  1. Its bottom-center crosses the line
  2. Its movement direction matches the expected approach direction

Direction fil tering prevents cars going East-West from being
counted on the North or South line, and vice versa.
"""

import sys
import os
import cv2
import numpy as np
import csv
from ultralytics import YOLO
from datetime import datetime
from collections import deque

# ── Make project root importable (so src.api.state is reachable) ──────────────
_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import src.api.state as _state

# ── Config ────────────────────────────────────────────────────────────────────
VIDEO_PATH   = "Data/Video/stable_video.mp4"
OUTPUT_CSV   = "Data/output/line_counts.csv"
MODEL_NAME   = "yolo26s.pt"
CONFIDENCE   = 0.25
IMG_SIZE     = 1280
SKIP_FRAMES  = 2
HISTORY_LEN  = 8    # frames of position history used to compute movement direction
MIN_MOVEMENT = 4    # minimum pixel movement needed before counting (filters parked cars)

# ── Vehicle classes (COCO) ────────────────────────────────────────────────────
VEHICLE_CLASSES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}

# ── COUNTING LINES ────────────────────────────────────────────────────────────
# Each line needs:
#   p1, p2     : endpoints
#   color      : BGR
#   direction  : expected movement vector (dx, dy) of approaching vehicles
#                e.g. North approach cars move downward  → (0, +1)
#                     South approach cars move upward    → (0, -1)
#                     East  approach cars move leftward  → (-1, 0)
#                     West  approach cars move rightward → (+1, 0)
#   angle_tol  : how many degrees off the expected direction is still accepted (0-90)
#   max_dist   : max pixels the vehicle can be from the line segment (proximity tube)
#                keeps distant cars on other roads from being counted
LINES = {
    "North": {
        "p1": (706, 429), "p2": (912, 460),
        "color": (0, 255, 0),
        "direction": (0, 1),    # cars from north → move downward
        "angle_tol": 75,        # generous — camera angle makes movement diagonal
        "max_dist": 350,        # wide tube around the line segment
    },
    "South": {
        "p1": (667, 730), "p2": (983, 789),
        "color": (0, 0, 255),
        "direction": (0, -1),   # cars from south → move upward
        "angle_tol": 75,
        "max_dist": 350,
    },
    "East": {
        "p1": (1383, 547), "p2": (1311, 626),
        "color": (255, 100, 0),
        "direction": (-1, 0),   # cars from east → move leftward
        "angle_tol": 75,
        "max_dist": 350,
    },
    "West": {
        "p1": (168, 510), "p2": (4, 582),
        "color": (0, 165, 255),
        "direction": (1, 0),    # cars from west → move rightward
        "angle_tol": 75,
        "max_dist": 350,
    },
}

# ── Helper: signed distance from point to line ────────────────────────────────
def side_of_line(px, py, p1, p2):
    return (p2[0] - p1[0]) * (py - p1[1]) - (p2[1] - p1[1]) * (px - p1[0])

# ── Helper: perpendicular distance from point to LINE SEGMENT ─────────────────
# Unlike infinite-line distance, this returns distance to the nearest endpoint
# if the projection falls outside the segment — preventing distant cars from
# triggering a crossing on a short line.
def dist_to_segment(px, py, p1, p2):
    ax, ay = p2[0] - p1[0], p2[1] - p1[1]
    bx, by = px - p1[0],    py - p1[1]
    seg_len_sq = ax*ax + ay*ay
    if seg_len_sq == 0:
        return ((px - p1[0])**2 + (py - p1[1])**2) ** 0.5
    t = max(0.0, min(1.0, (bx*ax + by*ay) / seg_len_sq))
    proj_x = p1[0] + t * ax
    proj_y = p1[1] + t * ay
    return ((px - proj_x)**2 + (py - proj_y)**2) ** 0.5

# ── Helper: check if vehicle movement matches expected approach direction ──────
def moving_correct_direction(history, expected_dir, angle_tol):
    """
    history     : deque of (px, py) positions (oldest first)
    expected_dir: (dx, dy) unit-ish vector, e.g. (0, 1) = downward
    angle_tol   : degrees tolerance
    Returns True if vehicle is moving roughly in expected_dir.
    """
    if len(history) < 3:
        return True  # not enough history, allow it

    # Use oldest and newest position to get overall movement vector
    oldest = history[0]
    newest = history[-1]
    dx = newest[0] - oldest[0]
    dy = newest[1] - oldest[1]
    magnitude = (dx**2 + dy**2) ** 0.5

    if magnitude < MIN_MOVEMENT:
        return False  # barely moved — parked or noise, don't count

    # Normalise
    dx /= magnitude
    dy /= magnitude

    # Dot product with expected direction
    ex, ey = expected_dir
    em = (ex**2 + ey**2) ** 0.5
    ex /= em
    ey /= em

    dot = dx * ex + dy * ey   # 1 = same direction, -1 = opposite, 0 = perpendicular
    angle = np.degrees(np.arccos(np.clip(dot, -1, 1)))

    return angle <= angle_tol

# ── Draw lines ────────────────────────────────────────────────────────────────
def draw_lines(frame, counts):
    for name, line in LINES.items():
        color = line["color"]
        p1, p2 = line["p1"], line["p2"]
        cv2.line(frame, p1, p2, color, 3)
        mx = (p1[0] + p2[0]) // 2
        my = (p1[1] + p2[1]) // 2
        cv2.putText(frame, f"{name}: {counts[name]}",
                    (mx - 40, my - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
        cv2.circle(frame, p1, 5, color, -1)
        cv2.circle(frame, p2, 5, color, -1)
    return frame

# ── Draw panel ────────────────────────────────────────────────────────────────
def draw_panel(frame, counts):
    panel_h = 45 + len(counts) * 38
    cv2.rectangle(frame, (10, 10), (270, panel_h), (0, 0, 0), -1)
    cv2.rectangle(frame, (10, 10), (270, panel_h), (255, 255, 255), 2)
    cv2.putText(frame, "VEHICLE COUNTS", (18, 36),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
    for i, (direction, count) in enumerate(counts.items()):
        color = LINES[direction]["color"]
        cv2.putText(frame, f"  {direction}: {count}",
                    (18, 68 + i * 36),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.85, color, 2)
    return frame

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("Loading YOLO26 model...")
    model = YOLO(MODEL_NAME)
    print("✓ Model loaded\n")

    cap = cv2.VideoCapture(VIDEO_PATH)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    w   = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h   = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"Video: {w}x{h} @ {fps:.1f}fps — {total_frames} frames\n")

    counts      = {name: 0   for name in LINES}
    prev_side   = {name: {}  for name in LINES}
    counted_ids = {name: set() for name in LINES}

    # Position history per vehicle: tid → deque of (px, py)
    pos_history = {}

    csv_rows   = [["timestamp", "frame", "direction", "vehicle_id", "vehicle_type", "confidence"]]
    frame_num  = 0
    loop_num   = 0
    display_scale = min(1.0, 1400 / w)

    print("Press Q to quit early.  Video will loop continuously.\n")

    with _state.lock:
        _state.detection_running = True
        _state.detection_start_time = datetime.now()

    while True:
        ret, frame = cap.read()
        if not ret:
            # ── End of video: loop back to start ─────────────────────────
            loop_num += 1
            print(f"\n  [Loop {loop_num} complete — restarting video]\n")
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            frame_num   = 0
            counts      = {name: 0   for name in LINES}
            prev_side   = {name: {}  for name in LINES}
            counted_ids = {name: set() for name in LINES}
            pos_history = {}
            with _state.lock:
                for k in _state.live_counts:
                    _state.live_counts[k] = 0
            continue

        frame_num += 1
        if frame_num % SKIP_FRAMES != 0:
            continue

        results = model.track(
            frame,
            tracker="bytetrack.yaml",
            persist=True,
            verbose=False,
            conf=CONFIDENCE,
            imgsz=IMG_SIZE,
            iou=0.45,
            classes=list(VEHICLE_CLASSES.keys()),
        )

        if (results[0].boxes is not None
                and results[0].boxes.id is not None
                and len(results[0].boxes) > 0):

            boxes     = results[0].boxes.xyxy.cpu().numpy()
            track_ids = results[0].boxes.id.cpu().numpy().astype(int)
            class_ids = results[0].boxes.cls.cpu().numpy().astype(int)
            confs     = results[0].boxes.conf.cpu().numpy()

            for box, tid, cid, conf in zip(boxes, track_ids, class_ids, confs):
                x1, y1, x2, y2 = map(int, box)
                px = (x1 + x2) // 2
                py = y2   # bottom-center = ground contact point

                # Update position history
                if tid not in pos_history:
                    pos_history[tid] = deque(maxlen=HISTORY_LEN)
                pos_history[tid].append((px, py))

                # Draw box
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 220, 220), 1)
                cv2.circle(frame, (px, py), 4, (0, 220, 220), -1)
                cv2.putText(frame, f"#{tid}", (x1, y1 - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 220, 220), 1)

                for line_name, line in LINES.items():
                    if tid in counted_ids[line_name]:
                        continue

                    p1, p2 = line["p1"], line["p2"]
                    current_side = side_of_line(px, py, p1, p2)

                    if tid in prev_side[line_name]:
                        last_side = prev_side[line_name][tid]

                        # Step 1: did it cross?
                        if last_side * current_side < 0:
                            # Step 2: is it moving in the right direction?
                            history = pos_history.get(tid, deque())
                            dir_ok = moving_correct_direction(
                                history, line["direction"], line["angle_tol"]
                            )
                            # Step 3: is the vehicle close enough to the line segment?
                            near_ok = dist_to_segment(px, py, p1, p2) <= line["max_dist"]

                            if dir_ok and near_ok:
                                counts[line_name] += 1
                                counted_ids[line_name].add(tid)
                                vtype = VEHICLE_CLASSES.get(cid, "vehicle")
                                csv_rows.append([
                                    datetime.now().isoformat(), frame_num,
                                    line_name, tid, vtype, f"{conf:.2f}"
                                ])
                                print(f"  [{line_name}] {vtype} #{tid}  |  "
                                      f"N={counts['North']}  S={counts['South']}  "
                                      f"E={counts['East']}  W={counts['West']}")
                                # push to live dashboard state
                                with _state.lock:
                                    _state.live_counts[line_name] = counts[line_name]

                    # Always update side so next frame knows where car was
                    prev_side[line_name][tid] = current_side

        # ── Push per-frame live stats to dashboard ────────────────────────
        if (results[0].boxes is not None
                and results[0].boxes.id is not None
                and len(results[0].boxes) > 0):
            _boxes     = results[0].boxes.xyxy.cpu().numpy()
            _track_ids = results[0].boxes.id.cpu().numpy().astype(int)
            _class_ids = results[0].boxes.cls.cpu().numpy().astype(int)
            _confs     = results[0].boxes.conf.cpu().numpy()

            visible   = len(_track_ids)
            n_moving  = 0
            n_stopped = 0
            n_cars = n_trucks = n_buses = n_motos = 0
            for _tid, _cid in zip(_track_ids, _class_ids):
                hist = pos_history.get(_tid)
                if hist and len(hist) >= 3:
                    dx = hist[-1][0] - hist[0][0]
                    dy = hist[-1][1] - hist[0][1]
                    if (dx**2 + dy**2) ** 0.5 >= MIN_MOVEMENT:
                        n_moving += 1
                    else:
                        n_stopped += 1
                else:
                    n_moving += 1   # new track, assume moving
                if _cid == 2:  n_cars   += 1
                elif _cid == 7: n_trucks += 1
                elif _cid == 5: n_buses  += 1
                elif _cid == 3: n_motos  += 1

            avg_conf = float(_confs.mean()) if len(_confs) else 0.0
            session_tracks = len(pos_history)
        else:
            visible = n_moving = n_stopped = 0
            n_cars = n_trucks = n_buses = n_motos = 0
            avg_conf = 0.0
            session_tracks = len(pos_history)

        with _state.lock:
            _state.live_stats["visible_now"]    = visible
            _state.live_stats["moving"]         = n_moving
            _state.live_stats["stopped"]        = n_stopped
            _state.live_stats["cars"]           = n_cars
            _state.live_stats["trucks"]         = n_trucks
            _state.live_stats["buses"]          = n_buses
            _state.live_stats["motos"]          = n_motos
            _state.live_stats["session_tracks"] = session_tracks
            _state.live_stats["avg_confidence"] = round(avg_conf * 100)
            _state.frame_time = frame_num / fps   # video-synced clock (resets on loop)

        frame = draw_lines(frame, counts)
        frame = draw_panel(frame, counts)
        cv2.putText(frame, f"Frame {frame_num}/{total_frames}",
                    (w - 280, h - 15),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (180, 180, 180), 2)

        # Push annotated frame to dashboard (resize to 960px wide to save bandwidth)
        thumb_w = 960
        thumb_h = int(h * (thumb_w / w))
        thumb = cv2.resize(frame, (thumb_w, thumb_h))
        with _state.lock:
            _state.latest_frame = thumb

        display = cv2.resize(frame, (int(w * display_scale), int(h * display_scale)))
        cv2.imshow("Wadi Saqra — Line Counter", display)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("\nStopped early by user.")
            break

    with _state.lock:
        _state.detection_running = False
        _state.detection_start_time = None

    cap.release()
    cv2.destroyAllWindows()

    with open(OUTPUT_CSV, "w", newline="") as f:
        csv.writer(f).writerows(csv_rows)
    print(f"\n✓ CSV saved to {OUTPUT_CSV}")

    print()
    print("=" * 45)
    print("    FINAL VEHICLE COUNTS — WADI SAQRA")
    print("=" * 45)
    for direction, count in counts.items():
        print(f"  {direction:<6} signal:  {count:>4} vehicles")
    print("-" * 45)
    print(f"  {'TOTAL':<6}           {sum(counts.values()):>4} vehicles")
    print("=" * 45)

if __name__ == "__main__":
    import threading
    import time
    import webbrowser
    import socket
    import uvicorn

    # ── Always run from the project root so relative paths (Data/) work ───────
    os.chdir(_ROOT)

    # ── Check if port 8000 is already taken ───────────────────────────────────
    def _port_free(port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(("127.0.0.1", port)) != 0

    if not _port_free(8000):
        print("⚠ Port 8000 already in use. Kill the old server first:")
        print("  lsof -ti :8000 | xargs kill -9")
        raise SystemExit(1)

    # ── Start FastAPI server in background thread ─────────────────────────────
    def _start_server():
        uvicorn.run("src.api.main:app", host="127.0.0.1", port=8000,
                    log_level="warning", use_colors=False)

    server_thread = threading.Thread(target=_start_server, daemon=True)
    server_thread.start()
    print("Starting API server on http://localhost:8000 …")
    time.sleep(1.5)   # wait for uvicorn to be ready

    # ── Start Google Maps traffic poller every 15 min ─────────────────────────
    try:
        from src.acquisition.google_traffic import run_loop as _google_loop
        google_thread = threading.Thread(
            target=_google_loop, args=(15,), daemon=True
        )
        google_thread.start()
        print("Google Maps poller started (every 15 min)")
    except Exception as e:
        print(f"Google Maps poller skipped: {e}")

    # ── Open dashboard served over HTTP (avoids file:// stream restrictions) ──
    webbrowser.open("http://localhost:8000")
    print("Dashboard opened at http://localhost:8000\n")

    main()
