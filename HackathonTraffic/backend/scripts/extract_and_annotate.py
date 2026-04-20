import cv2
import json
import os

VIDEO_PATH = "/Users/atd04/Documents/GitHub/Abdalrhman-Dmour-9xai19/HackathonTraffic/data_sandbox/video/YTDown.com_YouTube_Media_52ao3WsInBo_001_1080p.mp4"
OUTPUT_DIR = "/Users/atd04/Documents/GitHub/Abdalrhman-Dmour-9xai19/HackathonTraffic/data_sandbox/video/frames"
ANNOTATION_FILE = "/Users/atd04/Documents/GitHub/Abdalrhman-Dmour-9xai19/HackathonTraffic/data_sandbox/annotations/spatial_annotations.json"

def extract_and_annotate():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    cap = cv2.VideoCapture(VIDEO_PATH)
    if not cap.isOpened():
        print("Error: Could not open video.")
        return

    frames_to_extract = [50, 150, 300, 450, 600] # Frame indices
    annotations = []

    for f_idx in frames_to_extract:
        cap.set(cv2.CAP_PROP_POS_FRAMES, f_idx)
        ret, frame = cap.read()
        if not ret:
            continue

        frame_name = f"frame_{f_idx}.jpg"
        frame_path = os.path.join(OUTPUT_DIR, frame_name)
        cv2.imwrite(frame_path, frame)
        
        # Get frame dimensions
        height, width, _ = frame.shape

        # Mock annotations for this frame (simulating a YOLO output)
        # Coordinates are relative (x, y, w, h) in 0-1 range for easy frontend scaling
        frame_ann = {
            "frame": frame_name,
            "width": width,
            "height": height,
            "objects": [
                {"id": 1, "label": "car", "bbox": [0.15, 0.45, 0.1, 0.08]}, # normalized [x, y, w, h]
                {"id": 2, "label": "car", "bbox": [0.28, 0.47, 0.08, 0.07]},
                {"id": 3, "label": "bus", "bbox": [0.45, 0.40, 0.15, 0.15]},
                {"id": 4, "label": "motorcycle", "bbox": [0.65, 0.55, 0.05, 0.05]},
                {"id": 5, "label": "car", "bbox": [0.05, 0.60, 0.12, 0.1]}
            ]
        }
        annotations.append(frame_ann)

    with open(ANNOTATION_FILE, 'w') as f:
        json.dump(annotations, f, indent=2)

    cap.release()
    print(f"Successfully extracted {len(annotations)} frames and generated spatial_annotations.json")

if __name__ == "__main__":
    extract_and_annotate()
