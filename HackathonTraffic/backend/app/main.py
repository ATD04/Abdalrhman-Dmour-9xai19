from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import json
import csv
import os

app = FastAPI(
    title="9XAI Hackathon Traffic Logic API",
    description="Backend API for Data Ingestion, Logic, and Real-Time Event Dashboard",
    version="0.1.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SANDBOX_DIR = os.path.join(BASE_DIR, "data_sandbox")

# Serve Video Files as Static Assets
app.mount("/video", StaticFiles(directory=os.path.join(SANDBOX_DIR, "video")), name="video")
app.mount("/frames", StaticFiles(directory=os.path.join(SANDBOX_DIR, "video/frames")), name="frames")

@app.get("/")
def root():
    return {"status": "ok", "message": "Traffic Intelligence Backend is running. Phase 0 successful."}

@app.get("/api/v1/spatial-annotations")
def get_spatial_annotations():
    ann_path = os.path.join(SANDBOX_DIR, "annotations/spatial_annotations.json")
    if os.path.exists(ann_path):
        with open(ann_path, 'r') as f:
            return json.load(f)
    return []

@app.get("/api/v1/stream-detections")
def get_stream_detections():
    intel_path = os.path.join(SANDBOX_DIR, "video/livestream_intelligence.json")
    if os.path.exists(intel_path):
        with open(intel_path, 'r') as f:
            return json.load(f)
    return {"metadata": {}, "frames": {}}

@app.get("/api/v1/site-info")
def get_site_info():
    metadata_path = os.path.join(SANDBOX_DIR, "metadata/intersection_metadata.json")
    lane_path = os.path.join(SANDBOX_DIR, "metadata/lane_map.json")
    
    with open(metadata_path, 'r') as f:
        metadata = json.load(f)
    with open(lane_path, 'r') as f:
        lanes = json.load(f)
        
    return {"metadata": metadata, "lanes": lanes}

@app.get("/api/v1/traffic-stats")
def get_traffic_stats():
    counts_path = os.path.join(SANDBOX_DIR, "detector/detector_counts.csv")
    data = []
    with open(counts_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            data.append(row)
    
    # Simple aggregation for the chart: average count per timestamp
    agg_data = {}
    for entry in data:
        ts = entry["timestamp"]
        count = int(entry["vehicle_count"])
        if ts not in agg_data:
            agg_data[ts] = {"timestamp": ts, "total_count": 0, "count_entries": 0}
        agg_data[ts]["total_count"] += count
        agg_data[ts]["count_entries"] += 1
        
    chart_data = []
    for ts in sorted(agg_data.keys()):
        item = agg_data[ts]
        chart_data.append({
            "time": ts.split(" ")[1][:5], # Just get HH:MM
            "volume": item["total_count"] // item["count_entries"]
        })
        
    return chart_data

@app.get("/api/v1/incidents")
def get_incidents():
    incidents_path = os.path.join(SANDBOX_DIR, "annotations/incidents.csv")
    incidents = []
    if os.path.exists(incidents_path):
        with open(incidents_path, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                incidents.append(row)
    return incidents

@app.get("/api/v1/clips")
def get_clips():
    manifest_path = os.path.join(SANDBOX_DIR, "video/clips/clip_manifest.json")
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r') as f:
            return json.load(f)
    return {"clips": []}
