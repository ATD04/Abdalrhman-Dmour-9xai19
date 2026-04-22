import cv2
from ultralytics import YOLO
import time

print("Loading model...")
model = YOLO("yolo26m.pt")
print("Opening video...")
cap = cv2.VideoCapture("../data_sandbox/video/raw/video1.mov")

fps = cap.get(cv2.CAP_PROP_FPS)
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
print(f"Video: {width}x{height} @ {fps}fps")

start = time.time()
for i in range(5):
    ret, frame = cap.read()
    if not ret: break
    
    results = model.track(frame, persist=True, classes=[2, 3, 5, 7], verbose=False)
    boxes = results[0].boxes
    print(f"Frame {i}: {len(boxes) if boxes else 0} objects")

end = time.time()
print(f"Processed 5 frames in {end - start:.2f}s ({5 / (end - start):.2f} fps)")
cap.release()
