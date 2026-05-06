#!/usr/bin/env python3
"""
Reprocess one preview video with YOLO11x-seg segmentation.
Single model, single pass, vehicle classes only.
"""

import json
import shutil
import subprocess
import sys
import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO

SCRIPT_DIR  = Path(__file__).parent
PREVIEW_DIR = SCRIPT_DIR / "app/media/video_previews"
OUTPUT_DIR  = SCRIPT_DIR / "app/media/video_previews_segmentation"

COLORS = {
    "car":        ( 80, 220,  80),
    "truck":      ( 40, 180, 255),
    "bus":        ( 66, 209, 255),
    "motorcycle": (200, 100, 255),
}
VEHICLE_IDS = [2, 3, 5, 7]  # COCO: car, motorcycle, bus, truck


def main():
    video_path = PREVIEW_DIR / "img-5208.mp4"
    if not video_path.exists():
        print(f"❌ Not found: {video_path}"); return 1

    print("🔄 Loading YOLO11x-seg …")
    model = YOLO("yolo11x-seg.pt")
    print(f"✅ yolo11x-seg  task={model.task}")

    cap   = cv2.VideoCapture(str(video_path))
    fps   = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    W     = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H     = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"📹 {W}x{H}  {fps:.1f}fps  {total} frames")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    tmp   = OUTPUT_DIR / "img-5208_raw.mp4"
    out   = OUTPUT_DIR / "img-5208_segmentation.mp4"
    writer = cv2.VideoWriter(str(tmp), cv2.VideoWriter_fourcc(*"mp4v"), fps, (W, H))

    print("🔄 Processing (every 2nd frame, vehicles only) …")
    idx, last = 0, None
    while True:
        ok, frame = cap.read()
        if not ok: break
        if idx % 2 == 0:
            res = model(frame, conf=0.40, iou=0.40, classes=VEHICLE_IDS, verbose=False)
            last = res[0] if res else None
        if last is not None:
            frame = draw(frame, last, W, H)
        writer.write(frame)
        idx += 1
        if idx % 200 == 0:
            print(f"   [{idx/total*100:5.1f}%] {idx}/{total}", end="\r", flush=True)

    print(f"\n   [100.0%] {idx}/{total}")
    cap.release(); writer.release()

    if shutil.which("ffmpeg"):
        print("🔁 Re-encoding H.264 …")
        subprocess.run(["ffmpeg","-y","-i",str(tmp),"-c:v","libx264","-crf","22",
            "-preset","fast","-movflags","+faststart","-pix_fmt","yuv420p",str(out)],
            check=True, capture_output=True)
        tmp.unlink(missing_ok=True)
    else:
        tmp.rename(out)

    dest = PREVIEW_DIR / "img-5208_seg.mp4"
    shutil.copy2(str(out), str(dest))
    print(f"✅ Done → {dest}")

    manifest = SCRIPT_DIR / "app/data/video_analytics_manifest.json"
    if manifest.exists():
        data = json.loads(manifest.read_text())
        for v in data.get("videos", []):
            if v["id"] == "img-5208":
                v["preview_path"] = "/app/media/video_previews/img-5208_seg.mp4"
                v["label"] = "IMG_5208 ✦ YOLO11 Seg"
                break
        manifest.write_text(json.dumps(data, ensure_ascii=False, indent=2))
        print("📋 Manifest updated — refresh browser")
    return 0


def draw(frame, result, W, H):
    boxes, masks = result.boxes, result.masks
    if boxes is None or len(boxes) == 0:
        return frame
    n = len(boxes)
    if masks is not None and masks.data is not None:
        for i in range(min(n, len(masks.data))):
            try:
                color = COLORS.get(result.names[int(boxes[i].cls[0].item())], COLORS["car"])
                m = masks.data[i].cpu().numpy().astype(np.float32)
                if m.ndim == 3: m = m[0]
                m = cv2.resize(m, (W, H), interpolation=cv2.INTER_LINEAR)
                px = m > 0.5
                frame[px] = (frame[px].astype(np.float32)*0.60
                             + np.array(color, np.float32)*0.40).clip(0,255).astype(np.uint8)
            except Exception: pass
    for i in range(n):
        x1,y1,x2,y2 = boxes[i].xyxy[0].cpu().numpy().astype(int)
        name  = result.names[int(boxes[i].cls[0].item())]
        conf  = float(boxes[i].conf[0].item())
        color = COLORS.get(name, COLORS["car"])
        cv2.rectangle(frame,(x1,y1),(x2,y2),(0,0,0),3)
        cv2.rectangle(frame,(x1,y1),(x2,y2),color,2)
        label = f"{name} {conf:.0%}"
        font,scale,thick = cv2.FONT_HERSHEY_SIMPLEX,0.58,1
        (tw,th),bl = cv2.getTextSize(label,font,scale,thick)
        ly1 = max(y1-th-bl-6,0)
        cv2.rectangle(frame,(x1,ly1),(x1+tw+6,y1),color,cv2.FILLED)
        cv2.putText(frame,label,(x1+3,y1-bl-2),font,scale,(0,0,0),thick,cv2.LINE_AA)
    return frame


if __name__ == "__main__":
    sys.exit(main())
