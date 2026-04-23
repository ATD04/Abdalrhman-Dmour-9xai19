import cv2
import json
from ultralytics import YOLO
import time
import os

VIDEO_PATH = "../data_sandbox/video/raw/video1.mov"
OUTPUT_FILE = "../data_sandbox/video/livestream_intelligence.json"

def is_in_road_roi(n_x, n_y):
    # Filter out sidewalks, sky, and extreme edges
    # Sky/horizon
    if n_y < 0.2: return False
    # Far left sidewalk/buildings
    if n_x < 0.15: return False
    # Far right
    if n_x > 0.9: return False
    return True

def main():
    print("Loading YOLO26m model with tuned tracking config...")
    model = YOLO("yolo26m.pt")
    
    print(f"Opening video {VIDEO_PATH}...")
    cap = cv2.VideoCapture(VIDEO_PATH)
    if not cap.isOpened():
        print("Error: Could not open video.")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    print(f"Video: {width}x{height} @ {fps}fps, Total Frames: {total_frames}")

    frames_dict = {}
    
    # We will process all frames
    MAX_FRAMES = total_frames
    
    f_idx = 0
    start_time = time.time()
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
            
        # Tuned parameters: bytetrack for stability, low conf for small vehicles, iou=0.45 for NMS
        results = model.track(
            frame, 
            persist=True, 
            tracker="bytetrack.yaml", 
            conf=0.15, 
            iou=0.45, 
            classes=[2, 3, 5, 7], # Car, Motorcycle, Bus, Truck
            verbose=False
        )
        
        frame_objs = []
        if results and len(results) > 0:
            boxes = results[0].boxes
            if boxes and boxes.id is not None:
                for box in boxes:
                    if box.id is None: continue
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = float(box.conf[0])
                    cls = int(box.cls[0])
                    track_id = int(box.id[0])
                    
                    # Normalize for frontend
                    n_w = (x2 - x1) / width
                    n_h = (y2 - y1) / height
                    n_x = x1 / width
                    n_y = y1 / height
                    
                    # Centroid
                    cx = n_x + n_w/2
                    cy = n_y + n_h/2
                    
                    if is_in_road_roi(cx, cy):
                        frame_objs.append({
                            "id": track_id,
                            "label": model.names[cls],
                            "conf": round(conf, 2),
                            "bbox": [round(n_x, 4), round(n_y, 4), round(n_w, 4), round(n_h, 4)]
                        })
        
        frames_dict[str(f_idx)] = frame_objs
        f_idx += 1
        
        if f_idx % 100 == 0:
            elapsed = time.time() - start_time
            print(f"Processed {f_idx}/{MAX_FRAMES} frames... ({f_idx/elapsed:.2f} fps)")

    cap.release()

    output = {
        "metadata": {
            "fps": fps,
            "width": width,
            "height": height,
            "total_frames": f_idx,
            "model": "YOLO26m-Tuned",
            "site_id": "AMM-WS-01"
        },
        "frames": frames_dict
    }

    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output, f)
        
    print(f"Successfully generated {OUTPUT_FILE} with {f_idx} tracked frames.")

if __name__ == "__main__":
    main()
