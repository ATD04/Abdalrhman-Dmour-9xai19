"""
Line Placement Helper — click the 2 endpoints of each counting line
--------------------------------------------------------------------
Run this, click 2 points per road (start + end of the line),
then paste the printed coordinates into step3_line_count.py
"""

import cv2
import numpy as np

VIDEO_PATH = "Data/Video/stable_video.mp4"

ROADS = ["North", "South", "East", "West"]
COLORS = {
    "North": (0, 255, 0),
    "South": (0, 0, 255),
    "East":  (255, 100, 0),
    "West":  (0, 165, 255),
}

# Load first frame
cap = cv2.VideoCapture(VIDEO_PATH)
ret, orig = cap.read()
cap.release()
assert ret, "Cannot open video"

h, w = orig.shape[:2]
scale = min(1.0, 1400 / w)
display = cv2.resize(orig, (int(w * scale), int(h * scale)))

clicked = []
lines_done = {}
current_road_idx = 0

def click(event, x, y, flags, _):
    global clicked, current_road_idx
    if event != cv2.EVENT_LBUTTONDOWN:
        return
    if current_road_idx >= len(ROADS):
        return

    ox, oy = int(x / scale), int(y / scale)   # back to original resolution
    clicked.append((ox, oy))
    road = ROADS[current_road_idx]
    color = COLORS[road]

    cv2.circle(display, (x, y), 7, color, -1)
    cv2.putText(display, str(len(clicked) % 2 + 1 or 2),
                (x + 8, y - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

    if len(clicked) % 2 == 0:
        # Both endpoints clicked → draw the line
        p1_orig = clicked[-2]
        p2_orig = clicked[-1]
        lines_done[road] = (p1_orig, p2_orig)

        p1d = (int(p1_orig[0] * scale), int(p1_orig[1] * scale))
        p2d = (int(p2_orig[0] * scale), int(p2_orig[1] * scale))
        cv2.line(display, p1d, p2d, color, 3)
        mx = (p1d[0] + p2d[0]) // 2
        my = (p1d[1] + p2d[1]) // 2
        cv2.putText(display, road, (mx - 20, my - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)

        print(f'  "{road}": {{"p1": {p1_orig}, "p2": {p2_orig}}},')
        current_road_idx += 1

        if current_road_idx < len(ROADS):
            next_road = ROADS[current_road_idx]
            print(f"\nNow click 2 endpoints for: {next_road} (color: {next_road})")

    cv2.imshow(win, display)

win = "Click line endpoints — 2 clicks per road"
cv2.imshow(win, display)
cv2.setMouseCallback(win, click)

print("=" * 55)
print("For each road, click the START and END of the counting line.")
print("Place lines ACROSS the road, BEFORE the stop line.")
print("=" * 55)
print(f"\nStart with: {ROADS[0]}  (green)")
print("Click 2 points across that road, then move to next.\n")

cv2.waitKey(0)
cv2.destroyAllWindows()

print("\n" + "=" * 55)
print("COPY THIS INTO step3_line_count.py → LINES section:")
print("=" * 55)
for road, (p1, p2) in lines_done.items():
    color_name = {"North":"(0, 255, 0)","South":"(0, 0, 255)",
                  "East":"(255, 100, 0)","West":"(0, 165, 255)"}[road]
    print(f'    "{road}": {{"p1": {p1}, "p2": {p2}, "color": {color_name}}},')
