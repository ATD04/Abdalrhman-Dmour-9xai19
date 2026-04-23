import json
import csv
import os

INPUT_JSON = "../data_sandbox/video/livestream_intelligence.json"
OUTPUT_CSV = "../data_sandbox/annotations/event_validation/incidents.csv"

def is_in_illegal_stop_zone(cx, cy):
    # This represents the actual central intersection box where stopping blocks traffic.
    # We exclude the areas approaching the intersection where stop-lines/queues exist.
    # E.g. core intersection: x between 0.4 and 0.6, y between 0.4 and 0.6
    if 0.4 <= cx <= 0.6 and 0.4 <= cy <= 0.6:
        return True
    return False

def generate_incidents():
    print("Generating grounded incidents from video tracking data (Masked)...")
    if not os.path.exists(INPUT_JSON):
        print(f"Waiting for {INPUT_JSON}...")
        return
        
    with open(INPUT_JSON, 'r') as f:
        data = json.load(f)

    frames = data.get("frames", {})
    fps = data.get("metadata", {}).get("fps", 42.4)
    
    track_history = {}
    
    for f_idx_str in sorted(frames.keys(), key=lambda x: int(x)):
        f_idx = int(f_idx_str)
        detections = frames[f_idx_str]
        
        for det in detections:
            track_id = det.get("id")
            if track_id is None: continue
            
            bbox = det.get("bbox")
            cx = bbox[0] + bbox[2]/2
            cy = bbox[1] + bbox[3]/2
            
            if track_id not in track_history:
                track_history[track_id] = {"start_frame": f_idx, "last_frame": f_idx, "positions": []}
            
            track_history[track_id]["last_frame"] = f_idx
            track_history[track_id]["positions"].append((f_idx, cx, cy))

    incidents = []
    incident_id = 1
    
    for track_id, history in track_history.items():
        frames_present = history["last_frame"] - history["start_frame"]
        
        # Must be stationary for > 10 seconds (approx 420 frames)
        if frames_present > 400: 
            pos = history["positions"]
            start_cx, start_cy = pos[0][1], pos[0][2]
            end_cx, end_cy = pos[-1][1], pos[-1][2]
            
            distance = ((end_cx - start_cx)**2 + (end_cy - start_cy)**2)**0.5
            
            # Barely moved over 10+ seconds
            if distance < 0.03: 
                # Check if it stopped in the illegal zone (center) vs legal queue (edges)
                if is_in_illegal_stop_zone(end_cx, end_cy):
                    start_time_s = history["start_frame"] / fps
                    end_time_s = history["last_frame"] / fps
                    
                    def fmt(s):
                        return f"{int(s//3600):02d}:{int((s%3600)//60):02d}:{int(s%60):02d}"
                    
                    incidents.append({
                        "event_id": f"INC_{incident_id:03d}",
                        "event_type": "Stalled Vehicle",
                        "start_time": fmt(start_time_s),
                        "end_time": fmt(end_time_s),
                        "video_file": "raw/video1.mov",
                        "notes": f"Vehicle ID {track_id} stationary for {frames_present} frames inside active intersection."
                    })
                    incident_id += 1

    os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)
    with open(OUTPUT_CSV, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=["event_id", "event_type", "start_time", "end_time", "video_file", "notes"])
        writer.writeheader()
        if not incidents:
            writer.writerow({
                "event_id": "INC_000", "event_type": "No Critical Stalls", "start_time": "00:00:00", "end_time": "00:01:51",
                "video_file": "raw/video1.mov", "notes": "No vehicles blocked the central intersection. Legal queues ignored."
            })
        for inc in incidents:
            writer.writerow(inc)

    print(f"Generated {len(incidents)} grounded incidents (Excluding legal queues).")

if __name__ == "__main__":
    generate_incidents()
