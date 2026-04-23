import cv2
import json

def draw_proof():
    VIDEO_PATH = "../data_sandbox/video/raw/video1.mov"
    JSON_PATH = "../data_sandbox/video/livestream_intelligence.json"
    OUTPUT_PATH = "proof_frame_100.jpg"
    
    with open(JSON_PATH, 'r') as f:
        data = json.load(f)
        
    frames = data.get("frames", {})
    detections = frames.get("100", [])
    
    cap = cv2.VideoCapture(VIDEO_PATH)
    cap.set(cv2.CAP_PROP_POS_FRAMES, 100)
    ret, frame = cap.read()
    if not ret:
        print("Failed to read frame")
        return
        
    h, w, _ = frame.shape
    
    # Draw trip lines
    cv2.line(frame, (0, int(h*0.35)), (w, int(h*0.35)), (255, 255, 255), 2)
    cv2.line(frame, (0, int(h*0.65)), (w, int(h*0.65)), (255, 255, 255), 2)
    cv2.line(frame, (int(w*0.35), 0), (int(w*0.35), h), (255, 255, 255), 2)
    cv2.line(frame, (int(w*0.65), 0), (int(w*0.65), h), (255, 255, 255), 2)
    
    for det in detections:
        bbox = det["bbox"]
        x = int(bbox[0] * w)
        y = int(bbox[1] * h)
        bw = int(bbox[2] * w)
        bh = int(bbox[3] * h)
        
        cv2.rectangle(frame, (x, y), (x+bw, y+bh), (0, 255, 0), 3)
        cv2.putText(frame, f"#{det['id']} {det['label']} {det['conf']}", (x, max(20, y-10)), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 255, 0), 3)
        
    cv2.imwrite(OUTPUT_PATH, frame)
    print(f"Saved {OUTPUT_PATH}")

if __name__ == "__main__":
    draw_proof()
