"""
STEP 1 — Find Zone Coordinates
--------------------------------
Run this script first.
A window will open showing the first frame of your video.
Click the 4 corners of each zone (North / South / East / West).
The coordinates will be printed — copy them into step2_detect.py
"""

import cv2

VIDEO_PATH = "Data/Video/stable_video.mp4"

clicked_points = []

def click_event(event, x, y, flags, params):
    if event == cv2.EVENT_LBUTTONDOWN:
        clicked_points.append((x, y))
        print(f"  ({x}, {y}),")
        cv2.circle(img, (x, y), 6, (0, 255, 0), -1)
        cv2.putText(img, str(len(clicked_points)), (x + 8, y - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        cv2.imshow("Click Zone Corners — Press Q when done", img)

# Load first frame
cap = cv2.VideoCapture(VIDEO_PATH)
ret, img = cap.read()
cap.release()

if not ret:
    print("ERROR: Cannot open video")
    exit()

# Resize for easier viewing if too large
h, w = img.shape[:2]
scale = 1.0
if w > 1600:
    scale = 1600 / w
    img = cv2.resize(img, (int(w * scale), int(h * scale)))
    print(f"Video resized for display: {int(w*scale)}x{int(h*scale)} (scale={scale:.2f})")
    print(f"NOTE: Divide your coordinates by {scale:.2f} to get original pixel coords")
    print(f"      OR just use the printed coords directly — the detection script will scale too.\n")

print("=" * 50)
print("Instructions:")
print("  Click the 4 corners of each zone:")
print("  1) North zone  (cars coming from the top)")
print("  2) South zone  (cars coming from the bottom)")
print("  3) East zone   (cars coming from the right)")
print("  4) West zone   (cars coming from the left)")
print()
print("  Each zone needs 4 corner clicks.")
print("  Coordinates will print below as you click.")
print("  Press Q when done.")
print("=" * 50)
print()
print("Clicked coordinates:")

cv2.imshow("Click Zone Corners — Press Q when done", img)
cv2.setMouseCallback("Click Zone Corners — Press Q when done", click_event)
cv2.waitKey(0)
cv2.destroyAllWindows()

print()
print("=" * 50)
print(f"Total points clicked: {len(clicked_points)}")
print("Copy the coordinates above into step2_detect.py")
print("=" * 50)
