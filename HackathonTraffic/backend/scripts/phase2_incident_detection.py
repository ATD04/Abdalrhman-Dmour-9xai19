import json
import os
import datetime
import uuid

# Configuration
SANDBOX_DIR = "../data_sandbox"
INPUT_JSON = os.path.join(SANDBOX_DIR, "video/livestream_intelligence.json")
OUTPUT_DIR = os.path.join(SANDBOX_DIR, "detector/generated/phase2")
NOTIFICATIONS_OUTPUT = os.path.join(OUTPUT_DIR, "event_notifications.json")

def is_in_core_intersection(cx, cy):
    # ROI-INTERSECTION-CORE: [[0.25, 0.5], [0.75, 0.5], [0.85, 0.75], [0.15, 0.75]]
    # Simplified bounds for feasibility check
    if 0.15 <= cx <= 0.85 and 0.45 <= cy <= 0.80:
        return True
    return False

def run_incident_detection():
    print("Running Phase 2 Incident Detection Quick Build...")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    if not os.path.exists(INPUT_JSON):
        print(f"Error: {INPUT_JSON} not found.")
        return

    with open(INPUT_JSON, 'r') as f:
        data = json.load(f)

    frames = data.get("frames", {})
    metadata = data.get("metadata", {})
    fps = metadata.get("fps", 30)
    site_id = metadata.get("site_id", "AMM-WS-01")
    
    track_history = {}
    notifications = []
    lane_counts = {"south_approach": 0, "queue_start_frame": None}
    
    # Process frames for behavior analysis
    for f_idx_str in sorted(frames.keys(), key=lambda x: int(x)):
        f_idx = int(f_idx_str)
        detections = frames[f_idx_str]
        
        current_in_south = 0
        for det in detections:
            tid = det.get("id")
            bbox = det.get("bbox") # [x, y, w, h]
            cx = bbox[0] + bbox[2]/2
            cy = bbox[1] + bbox[3]/2
            
            # Density Tracking for Queue Detection
            if cy > 0.75: current_in_south += 1
            
            # Stalled Vehicle Tracking
            if tid not in track_history:
                track_history[tid] = {"start": f_idx, "positions": [(cx, cy)], "notified": False}
            else:
                track_history[tid]["positions"].append((cx, cy))
                
                # Analyze Dwell Time (Stationary for > 5s)
                frames_present = f_idx - track_history[tid]["start"]
                if frames_present > (fps * 5) and not track_history[tid]["notified"]:
                    pos = track_history[tid]["positions"]
                    dist = ((pos[-1][0]-pos[0][0])**2 + (pos[-1][1]-pos[0][1])**2)**0.5
                    if dist < 0.03 and is_in_core_intersection(cx, cy):
                        notifications.append({
                            "event_id": f"EVT-{site_id}-STALL-{uuid.uuid4().hex[:4].upper()}",
                            "timestamp": datetime.datetime.now().isoformat(),
                            "event_type": "stalled_vehicle",
                            "zone_id": "ROI-INTERSECTION-CORE",
                            "approach": "South",
                            "confidence_score": 0.92,
                            "severity": "High",
                            "snapshot_path": f"snapshots/stall_{tid}_{f_idx}.jpg",
                            "clip_ref": f"clip_stall_{tid}.mp4",
                            "notes": f"Vehicle #{tid} stationary in intersection core for >5s."
                        })
                        track_history[tid]["notified"] = True

        # Queue Spillback Detection Logic
        if current_in_south >= 8:
            if lane_counts["queue_start_frame"] is None:
                lane_counts["queue_start_frame"] = f_idx
            elif (f_idx - lane_counts["queue_start_frame"]) > (fps * 10):
                notifications.append({
                    "event_id": f"EVT-{site_id}-QUEUE-{uuid.uuid4().hex[:4].upper()}",
                    "timestamp": datetime.datetime.now().isoformat(),
                    "event_type": "queue_spillback",
                    "zone_id": "ROI-SOUTH-APPROACH",
                    "approach": "South",
                    "confidence_score": 0.85,
                    "severity": "Medium",
                    "snapshot_path": f"snapshots/queue_south_{f_idx}.jpg",
                    "clip_ref": "video_source_1.mp4",
                    "congestion_indicator": "Critical Density (>8 veh in ROI)",
                    "notes": f"Persistent queue detected in South approach."
                })
                lane_counts["queue_start_frame"] = f_idx + (fps * 60) # Cool down 1 min

    with open(NOTIFICATIONS_OUTPUT, 'w') as f:
        json.dump(notifications, f, indent=2)
        
    print(f"Incident Detection Complete. Generated {len(notifications)} structured notifications.")
    print(f"Artifacts saved to {NOTIFICATIONS_OUTPUT}")

if __name__ == "__main__":
    run_incident_detection()
