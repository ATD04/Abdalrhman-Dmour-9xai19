from ultralytics import YOLO
import cv2
import json
import os
import numpy as np

class TrafficDetectionEngine:
    def __init__(self, model_variant="yolo26m.pt"):
        # Load the model (will download if not present)
        self.model = YOLO(model_variant)
        # Class IDs for COCO: car=2, motorcycle=3, bus=5, truck=7
        self.target_classes = [2, 3, 5, 7]
        self.conf_threshold = 0.45
        self.iou_threshold = 0.45

    def process_frame(self, frame_path):
        """
        Process a single image frame and return accurate detection metadata.
        """
        img = cv2.imread(frame_path)
        if img is None:
            return None

        height, width, _ = img.shape
        
        # Define ROI (Region of Interest)
        # We exclude the top 30% (sky/buildings) and specific edges if needed
        roi_mask = np.zeros_like(img[:, :, 0])
        roi_points = np.array([
            [0, int(height * 0.35)], # Top-left road
            [width, int(height * 0.35)], # Top-right road
            [width, height], # Bottom-right
            [0, height] # Bottom-left
        ], np.int32)
        cv2.fillPoly(roi_mask, [roi_points], 255)

        # Run inference
        results = self.model.track(
            source=img, 
            persist=True, 
            classes=self.target_classes, 
            conf=self.conf_threshold,
            iou=self.iou_threshold,
            verbose=False
        )
        
        detections = []
        if results and len(results) > 0:
            result = results[0]
            boxes = result.boxes
            
            for box in boxes:
                # Get coordinates
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                cls = int(box.cls[0])
                
                # Filter by ROI (check if center of box is in ROI)
                cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                if roi_mask[int(cy), int(cx)] == 0:
                    continue

                # Get label
                label = self.model.names[cls]
                
                # Get Tracker ID if available
                track_id = int(box.id[0]) if box.id is not None else None

                # Format for frontend [x, y, w, h] normalized
                detections.append({
                    "id": track_id or cls,
                    "label": label,
                    "confidence": round(conf, 2),
                    "bbox": [
                        round(x1 / width, 4),
                        round(y1 / height, 4),
                        round((x2 - x1) / width, 4),
                        round((y2 - y1) / height, 4)
                    ]
                })

        return {
            "frame": os.path.basename(frame_path),
            "width": width,
            "height": height,
            "objects": detections
        }

    def run_batch_inference(self, frame_dir, output_file):
        """
        Process all frames in a directory in sequence to maintain tracker stability.
        """
        # Sort frames chronologically
        frame_files = sorted([f for f in os.listdir(frame_dir) if f.endswith('.jpg')])
        frame_paths = [os.path.join(frame_dir, f) for f in frame_files]
        
        # Run tracking on the sequence
        # Source can be a folder, and it will maintain state
        results = self.model.track(
            source=frame_dir,
            persist=True,
            classes=self.target_classes,
            conf=0.25, # Lower threshold to capture more distant vehicles
            iou=self.iou_threshold,
            verbose=False,
            stream=True # Use stream for memory efficiency
        )
        
        all_meta = []
        for i, result in enumerate(results):
            frame_path = frame_paths[i]
            height, width, _ = result.orig_img.shape
            
            # ROI Mask (Simplified rect for batch)
            roi_y_start = int(height * 0.35)
            
            detections = []
            boxes = result.boxes
            if boxes:
                for box in boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = float(box.conf[0])
                    cls = int(box.cls[0])
                    track_id = int(box.id[0]) if box.id is not None else None
                    
                    # ROI Filter
                    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                    if cy < roi_y_start:
                        continue

                    detections.append({
                        "id": track_id or (1000 + i), # Fallback ID
                        "label": self.model.names[cls],
                        "confidence": round(conf, 2),
                        "bbox": [
                            round(x1 / width, 4),
                            round(y1 / height, 4),
                            round((x2 - x1) / width, 4),
                            round((y2 - y1) / height, 4)
                        ]
                    })

            all_meta.append({
                "frame": os.path.basename(frame_path),
                "width": width,
                "height": height,
                "objects": detections
            })

        with open(output_file, 'w') as f:
            json.dump(all_meta, f, indent=2)
        
        print(f"✅ Success: Generated persistent tracking ground-truth for {len(all_meta)} frames.")

if __name__ == "__main__":
    FRAME_DIR = "/Users/atd04/Documents/GitHub/Abdalrhman-Dmour-9xai19/HackathonTraffic/data_sandbox/video/frames"
    OUTPUT_FILE = "/Users/atd04/Documents/GitHub/Abdalrhman-Dmour-9xai19/HackathonTraffic/data_sandbox/annotations/spatial_annotations.json"
    engine = TrafficDetectionEngine()
    engine.run_batch_inference(FRAME_DIR, OUTPUT_FILE)
