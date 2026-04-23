import json
import csv
import os

INPUT_JSON = "../data_sandbox/video/livestream_intelligence.json"
OUTPUT_CSV = "../data_sandbox/detector/baseline_video_count.csv"
OUTPUT_NOTE = "../data_sandbox/docs/baseline_count_note.md"

def extract_baseline():
    print(f"Reading {INPUT_JSON}...")
    with open(INPUT_JSON, 'r') as f:
        data = json.load(f)

    metadata = data.get("metadata", {})
    fps = metadata.get("fps", 30)
    total_frames = metadata.get("total_frames", 0)
    frames = data.get("frames", {})

    duration_minutes = (total_frames / fps) / 60.0
    print(f"Video duration: {duration_minutes:.2f} minutes ({total_frames} frames @ {fps} fps)")

    # Track unique IDs per approach
    # We will divide the normalized screen (0 to 1) into 4 rough quadrants/areas to assign approaches.
    # N: y < 0.4
    # S: y > 0.6
    # W: x < 0.4, y between 0.4 and 0.6
    # E: x > 0.6, y between 0.4 and 0.6
    
    counted_ids = set()
    approach_counts = {"North": 0, "South": 0, "East": 0, "West": 0}

    for f_idx_str, detections in frames.items():
        for det in detections:
            det_id = det.get("id")
            if det_id is None or det_id in counted_ids:
                continue
            
            bbox = det.get("bbox", [0,0,0,0])
            cx = bbox[0] + bbox[2] / 2
            cy = bbox[1] + bbox[3] / 2
            
            # Simple heuristic for approach based on where we first see the vehicle
            if cy < 0.4:
                approach_counts["North"] += 1
            elif cy > 0.6:
                approach_counts["South"] += 1
            elif cx < 0.5:
                approach_counts["West"] += 1
            else:
                approach_counts["East"] += 1
                
            counted_ids.add(det_id)

    # Calculate rates
    results = []
    for approach, count in approach_counts.items():
        rate = round(count / duration_minutes, 2) if duration_minutes > 0 else 0
        results.append({
            "Approach": approach,
            "Vehicles_Counted": count,
            "Clip_Duration_Mins": round(duration_minutes, 2),
            "Rate_Veh_Per_Min": rate
        })
        print(f"{approach}: {count} vehicles ({rate} veh/min)")

    # Write to CSV
    os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)
    with open(OUTPUT_CSV, 'w', newline='') as csvfile:
        fieldnames = ["Approach", "Vehicles_Counted", "Clip_Duration_Mins", "Rate_Veh_Per_Min"]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for row in results:
            writer.writerow(row)
            
    print(f"Successfully generated {OUTPUT_CSV}")

    # Write Methodology Note
    os.makedirs(os.path.dirname(OUTPUT_NOTE), exist_ok=True)
    note_content = f"""# Baseline Video Count Note

This artifact serves as the observational ground truth for the Phase 1 Traffic Sandbox.

## Methodology
- **Source Material:** Primary drone video (`data_sandbox/video/raw/video1.mov`)
- **Extraction Engine:** YOLO26m (Medium) + ByteTrack
- **Duration Processed:** {round(duration_minutes, 2)} minutes ({total_frames} frames)
- **Total Unique Vehicles Tracked:** {len(counted_ids)}

## Extracted Baseline Rates
| Approach | Vehicles Counted | Clip Duration (min) | Rate (veh/min) |
|----------|-----------------|---------------------|----------------|
"""
    for r in results:
        note_content += f"| {r['Approach']} | {r['Vehicles_Counted']} | {r['Clip_Duration_Mins']} | {r['Rate_Veh_Per_Min']} |\n"
        
    with open(OUTPUT_NOTE, 'w') as f:
        f.write(note_content)
        
    print(f"Successfully generated {OUTPUT_NOTE}")

if __name__ == "__main__":
    extract_baseline()
