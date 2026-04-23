import json
import os
import datetime
import uuid

# Configuration
SANDBOX_DIR = "../data_sandbox"
INPUT_JSON = os.path.join(SANDBOX_DIR, "video/livestream_intelligence.json")
OUTPUT_DIR = os.path.join(SANDBOX_DIR, "detector/generated/phase2")

# Specific Artifacts
COUNTS_JSON = os.path.join(OUTPUT_DIR, "live_directional_counts.json")
PRESSURE_JSON = os.path.join(OUTPUT_DIR, "live_queue_pressure.json")

def classify_approach(cx, cy):
    # Wadi Saqra approach mapping
    if cy < 0.35: return "North"
    if cy > 0.65: return "South"
    if cx < 0.35: return "West"
    if cx > 0.65: return "East"
    return "Core"

def run_directional_analysis():
    print("Running Phase 2 Directional Analysis...")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    with open(INPUT_JSON, 'r') as f:
        data = json.load(f)

    frames = data.get("frames", {})
    last_frame_id = max(int(f) for f in frames.keys())
    
    current_counts = {"North": 0, "South": 0, "East": 0, "West": 0}
    queue_pressure = {"North": 0, "South": 0, "East": 0, "West": 0}
    
    # Analyze current frame for immediate demand
    current_detections = frames[str(last_frame_id)]
    for det in current_detections:
        cx = det["bbox"][0] + det["bbox"][2]/2
        cy = det["bbox"][1] + det["bbox"][3]/2
        approach = classify_approach(cx, cy)
        if approach in current_counts:
            current_counts[approach] += 1
            queue_pressure[approach] += 1.2 # Weight for being in approach ROI

    # Normalize Pressure (0-100)
    normalized_pressure = {k: min(100, round((v/10)*100)) for k, v in queue_pressure.items()}

    # Save Directional Counts
    with open(COUNTS_JSON, 'w') as f:
        json.dump({
            "generated_at": datetime.datetime.now().isoformat(),
            "site_id": "AMM-WS-01",
            "counts": current_counts
        }, f, indent=2)

    # Save Queue Pressure
    with open(PRESSURE_JSON, 'w') as f:
        json.dump({
            "generated_at": datetime.datetime.now().isoformat(),
            "pressure_indices": normalized_pressure,
            "status_map": {k: "Critical" if v > 70 else "Normal" for k, v in normalized_pressure.items()}
        }, f, indent=2)

    print(f"Directional Analysis Complete. Artifacts saved to {OUTPUT_DIR}")

if __name__ == "__main__":
    run_directional_analysis()
