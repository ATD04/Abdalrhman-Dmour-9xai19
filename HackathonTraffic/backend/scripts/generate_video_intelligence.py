from ultralytics import YOLO
import cv2
import json
import os
import numpy as np

class VideoIntelligenceEngine:
    def __init__(self, video_path, model_variant="yolov8m.pt"):
        self.video_path = video_path
        self.model = YOLO(model_variant)
        self.target_classes = [2, 3, 5, 7, 1] # car, motorcycle, bus, truck, bicycle
        self.conf_threshold = 0.22 # Aggressive for distant detections
        self.iou_threshold = 0.45

    def generate_full_log(self, output_path):
        """
        Processes the entire video and generates a frame-indexed intelligence log.
        """
        cap = cv2.VideoCapture(self.video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        print(f"🎬 Starting Full Intelligence Scan: {total_frames} frames @ {fps}fps")
        
        # YOLO track on the video file directly is most efficient for tracking stability
        # We will iterate through results to build our JSON
        results = self.model.track(
            source=self.video_path,
            persist=True,
            classes=self.target_classes,
            conf=self.conf_threshold,
            iou=self.iou_threshold,
            verbose=False,
            stream=True
        )
        
        intelligence_log = {}
        
        # ROI: Exclude top 35%
        roi_y_min = int(height * 0.35)
        
        # Tracking history for speed calculation {id: [last_cx, last_cy, last_time]}
        tracker_history = {}

        for i, result in enumerate(results):
            if i % 100 == 0:
                print(f"📡 Processing Progress: {i}/{total_frames} frames ({(i/total_frames)*100:.1f}%)")
            
            detections = []
            boxes = result.boxes
            if boxes:
                for box in boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = float(box.conf[0])
                    cls = int(box.cls[0])
                    track_id = int(box.id[0]) if box.id is not None else None
                    
                    cx = (x1 + x2) / 2
                    cy = (y1 + y2) / 2
                    
                    # ROI Filter
                    if cy < roi_y_min:
                        continue

                    # Speed Estimation (Simulated km/h based on movement)
                    speed_kmh = 0
                    if track_id is not None:
                        if track_id in tracker_history:
                            prev_cx, prev_cy = tracker_history[track_id]
                            # Distance moved in pixels
                            dist = ((cx - prev_cx)**2 + (cy - prev_cy)**2)**0.5
                            # Apply perspective scaling (cars higher up move fewer pixels for same speed)
                            perspective_scale = 1 + (1.0 - (cy / height)) * 2 
                            speed_kmh = dist * perspective_scale * 0.5 # Heuristic multiplier
                        tracker_history[track_id] = (cx, cy)

                    detections.append({
                        "id": track_id,
                        "label": self.model.names[cls],
                        "conf": round(conf, 2),
                        "speed": round(speed_kmh, 1),
                        "bbox": [
                            round(x1 / width, 4),
                            round(y1 / height, 4),
                            round((x2 - x1) / width, 4),
                            round((y2 - y1) / height, 4)
                        ]
                    })
            
            intelligence_log[i] = detections

        # Final structure
        final_output = {
            "metadata": {
                "fps": fps,
                "width": width,
                "height": height,
                "total_frames": total_frames,
                "model": "YOLOv8n-Traffic-Tuned"
            },
            "frames": intelligence_log
        }
        
        with open(output_path, 'w') as f:
            json.dump(final_output, f)
            
        cap.release()
        print(f"✅ Intelligence Scan Complete. Log saved to: {output_path}")

if __name__ == "__main__":
    VIDEO_PATH = "/Users/atd04/Documents/GitHub/Abdalrhman-Dmour-9xai19/HackathonTraffic/data_sandbox/video/YTDown.com_YouTube_Media_52ao3WsInBo_001_1080p.mp4"
    OUTPUT_PATH = "/Users/atd04/Documents/GitHub/Abdalrhman-Dmour-9xai19/HackathonTraffic/data_sandbox/video/livestream_intelligence.json"
    
    engine = VideoIntelligenceEngine(VIDEO_PATH)
    engine.generate_full_log(OUTPUT_PATH)
