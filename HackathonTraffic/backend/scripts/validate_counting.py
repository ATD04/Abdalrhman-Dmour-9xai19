import json

def run_validation():
    with open("../data_sandbox/video/livestream_intelligence.json", 'r') as f:
        data = json.load(f)

    frames = data.get("frames", {})
    fps = data.get("metadata", {}).get("fps", 42.4)
    
    # Let's validate seconds 20 to 60
    start_frame = int(0 * fps)
    mid_frame = int(20 * fps)
    end_frame = int(60 * fps)
    
    # App.jsx trip-lines
    N_LINE = 0.35
    S_LINE = 0.65
    E_LINE = 0.65
    W_LINE = 0.35
    
    cumulative_ids = set()
    track_history = {}
    
    for f_idx in range(0, end_frame + 1):
        f_str = str(f_idx)
        if f_str not in frames: continue
        detections = frames[f_str]
        
        current_ids = set([d["id"] for d in detections])
        for tid in list(track_history.keys()):
            if tid not in current_ids:
                del track_history[tid]
                
        for det in detections:
            tid = det["id"]
            cx = det["bbox"][0] + det["bbox"][2]/2
            cy = det["bbox"][1] + det["bbox"][3]/2
            
            if tid not in cumulative_ids:
                prev = track_history.get(tid)
                if prev:
                    crossedNorth = prev["cy"] < N_LINE and cy >= N_LINE
                    crossedSouth = prev["cy"] > S_LINE and cy <= S_LINE
                    crossedWest  = prev["cx"] < W_LINE and cx >= W_LINE
                    crossedEast  = prev["cx"] > E_LINE and cx <= E_LINE
                    
                    if crossedNorth or crossedSouth or crossedWest or crossedEast:
                        cumulative_ids.add(tid)
            
            track_history[tid] = {"cx": cx, "cy": cy}
            
        if f_idx == start_frame: count_0 = len(cumulative_ids)
        if f_idx == mid_frame: count_20 = len(cumulative_ids)
            
    count_60 = len(cumulative_ids)
    print(f"Total counted vehicles up to sec 0: {count_0}")
    print(f"Total counted vehicles up to sec 20: {count_20}")
    print(f"Total counted vehicles up to sec 60: {count_60}")

if __name__ == "__main__":
    run_validation()
