#!/usr/bin/env python3
"""Test segmentation on a single frame from existing video.

This script:
1. Extracts a frame from an existing processed video
2. Runs YOLOv8 segmentation on it
3. Saves the result with masks overlay
4. Shows whether segmentation is working
"""

import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO

# Paths
SIM_ROOT = Path(__file__).parent.parent
VIDEO_PATH = SIM_ROOT / "app/media/video_previews/img-5206.mp4"
OUTPUT_PATH = SIM_ROOT / "app/data/segmentation_test.jpg"

# Colors (BGR)
COLOR_CAR = (80, 220, 80)      # green
COLOR_TRUCK = (40, 180, 255)   # orange
COLOR_BUS = (66, 209, 255)     # yellow
COLOR_PERSON = (200, 80, 200)  # purple

def main():
    print("🧪 Testing YOLOv8 Segmentation on single frame...")
    print(f"   Video: {VIDEO_PATH.name}")
    
    if not VIDEO_PATH.exists():
        print(f"❌ Video not found: {VIDEO_PATH}")
        return
    
    # Load video and extract frame
    cap = cv2.VideoCapture(str(VIDEO_PATH))
    if not cap.isOpened():
        print("❌ Cannot open video")
        return
    
    # Skip to middle of video
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_count // 2)
    
    ret, frame = cap.read()
    cap.release()
    
    if not ret:
        print("❌ Cannot read frame")
        return
    
    print(f"✅ Extracted frame {frame_count // 2}/{frame_count}")
    print(f"   Frame size: {frame.shape[1]}x{frame.shape[0]}")
    
    # Load segmentation model
    print("\n🔄 Loading segmentation model...")
    try:
        model = YOLO(SIM_ROOT / "models/yolo11x-seg.pt")
        print("✅ Loaded YOLO11x-seg model")
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        return
    
    if model.task != "segment":
        print(f"❌ Model task is '{model.task}', expected 'segment'")
        return
    
    print(f"✅ Model loaded: {model.task}")
    
    # Run inference
    print("\n🔄 Running segmentation inference...")
    results = model(frame, conf=0.25, iou=0.45, verbose=False)
    
    if not results or len(results) == 0:
        print("❌ No results from model")
        return
    
    result = results[0]
    boxes = result.boxes
    masks = result.masks
    
    if boxes is None or len(boxes) == 0:
        print("⚠️  No detections found in frame")
        return
    
    print(f"✅ Found {len(boxes)} detections")
    
    # Check if masks are available
    if masks is None:
        print("❌ No segmentation masks! Model might not be segmentation model.")
        return
    
    print(f"✅ Segmentation masks available: {len(masks.data)} masks")
    
    # Draw masks
    print("\n🎨 Drawing segmentation masks...")
    overlay = frame.copy()
    
    for i in range(len(masks.data)):
        try:
            # Get mask
            mask_np = masks.data[i].cpu().numpy()
            if mask_np.ndim == 3:
                mask_np = mask_np[0]
            
            # Resize mask to match frame dimensions
            h, w = frame.shape[:2]
            mask_np = cv2.resize(mask_np, (w, h), interpolation=cv2.INTER_LINEAR)
            mask_np = (mask_np > 0.5).astype(bool)  # Threshold after resize
            
            # Get class
            cls_id = int(boxes[i].cls[0].cpu().item())
            class_name = model.names[cls_id]
            
            # Choose color
            if class_name == "person":
                color = COLOR_PERSON
            elif class_name == "truck":
                color = COLOR_TRUCK
            elif class_name == "bus":
                color = COLOR_BUS
            else:
                color = COLOR_CAR
            
            # Create colored mask
            mask_colored = np.zeros_like(frame, dtype=np.uint8)
            mask_colored[mask_np] = color
            
            # Blend
            cv2.addWeighted(overlay, 0.85, mask_colored, 0.15, 0, overlay)
            
        except Exception as e:
            print(f"   Warning: Failed to draw mask {i}: {e}")
    
    # Blend overlay back
    result_frame = frame.copy()
    cv2.addWeighted(result_frame, 0.4, overlay, 0.6, 0, result_frame)
    
    # Draw bounding boxes and labels
    for i in range(len(boxes)):
        box = boxes[i]
        cls_id = int(box.cls[0].cpu().item())
        conf = float(box.conf[0].cpu().item())
        class_name = model.names[cls_id]
        
        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
        
        # Color
        if class_name == "person":
            color = COLOR_PERSON
        elif class_name == "truck":
            color = COLOR_TRUCK
        elif class_name == "bus":
            color = COLOR_BUS
        else:
            color = COLOR_CAR
        
        # Box
        cv2.rectangle(result_frame, (x1, y1), (x2, y2), (0, 0, 0), 4)
        cv2.rectangle(result_frame, (x1, y1), (x2, y2), color, 2)
        
        # Label
        label = f"{class_name} {conf:.0%}"
        font = cv2.FONT_HERSHEY_SIMPLEX
        (tw, th), baseline = cv2.getTextSize(label, font, 0.5, 1)
        cv2.rectangle(result_frame, (x1, y1 - th - baseline - 4), (x1 + tw + 6, y1), color, cv2.FILLED)
        cv2.putText(result_frame, label, (x1 + 3, y1 - baseline - 1), font, 0.5, (0, 0, 0), 1, cv2.LINE_AA)
    
    # Save result
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(OUTPUT_PATH), result_frame)
    
    print(f"\n✅ Segmentation test complete!")
    print(f"   Output saved: {OUTPUT_PATH}")
    print(f"   Detections: {len(boxes)}")
    print(f"   Masks: {len(masks.data)}")
    print(f"\n🎯 Segmentation is working correctly!")
    print(f"   The masks are semi-transparent colored overlays on each vehicle.")
    print(f"\n   To see this in the video player:")
    print(f"   1. Re-process videos with: python3 scripts/build_video_analytics_dataset.py --source /path/to/video.mp4 --force")
    print(f"   2. Refresh browser at http://localhost:3100/")

if __name__ == "__main__":
    main()
