from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import json
import csv
import os

app = FastAPI(
    title="9XAI Traffic Sandbox Viewer API",
    description="Internal monitoring and preview layer for the AMM-WS-01 Traffic Data Sandbox. Supporting tool only.",
    version="0.1.2"
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
PHASE2_DIR = os.path.join(SANDBOX_DIR, "detector/generated/phase2")

# Serve Video Files as Static Assets
app.mount("/video", StaticFiles(directory=os.path.join(SANDBOX_DIR, "video")), name="video")
app.mount("/frames", StaticFiles(directory=os.path.join(SANDBOX_DIR, "video/frames")), name="frames")

@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "AMM-WS-01 Traffic Sandbox Viewer — Phase 1 Package Active.",
        "sandbox_dir": SANDBOX_DIR,
        "mode": "SANDBOX_PREVIEW"
    }

@app.get("/api/v1/spatial-annotations")
def get_spatial_annotations():
    """Ground-truth bounding box annotations from YOLO batch run."""
    ann_path = os.path.join(SANDBOX_DIR, "annotations/spatial_annotations.json")
    if os.path.exists(ann_path):
        with open(ann_path, 'r') as f:
            return json.load(f)
    return []

@app.get("/api/v1/stream-detections")
def get_stream_detections():
    """Frame-synced detection data for live YOLO overlay on video."""
    intel_path = os.path.join(SANDBOX_DIR, "video/livestream_intelligence.json")
    if os.path.exists(intel_path):
        with open(intel_path, 'r') as f:
            return json.load(f)
    return {"metadata": {}, "frames": {}}

@app.get("/api/v1/site-info")
def get_site_info():
    """Intersection metadata + lane map. Integration reference."""
    metadata_path = os.path.join(SANDBOX_DIR, "metadata/intersection_metadata.json")
    lane_path = os.path.join(SANDBOX_DIR, "metadata/lane_map.json")
    camera_path = os.path.join(SANDBOX_DIR, "metadata/camera_registry.json")

    with open(metadata_path, 'r') as f:
        metadata = json.load(f)
    with open(lane_path, 'r') as f:
        lanes = json.load(f)

    cameras = {}
    if os.path.exists(camera_path):
        with open(camera_path, 'r') as f:
            cameras = json.load(f)

    return {"metadata": metadata, "lanes": lanes, "cameras": cameras}

@app.get("/api/v1/traffic-stats")
def get_traffic_stats():
    """
    Reads from the FORECASTING-READY 24h/15min dataset.
    Aggregates across all detectors per timestamp for dashboard chart.
    Path: detector/forecasting_ready/demand_forecast_source.csv
    """
    counts_path = os.path.join(SANDBOX_DIR, "detector/forecasting_ready/demand_forecast_source.csv")

    # Fallback to raw SUMO output if forecasting dataset missing
    if not os.path.exists(counts_path):
        counts_path = os.path.join(SANDBOX_DIR, "detector/raw_sumo_output.csv")

    if not os.path.exists(counts_path):
        return []

    data = []
    with open(counts_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            data.append(row)

    # Aggregate across all detectors per 15-min timestamp
    agg_data = {}
    for entry in data:
        ts = entry["timestamp"]
        try:
            count = int(entry["vehicle_count"])
        except (ValueError, KeyError):
            continue
        if ts not in agg_data:
            agg_data[ts] = {"timestamp": ts, "total_count": 0, "count_entries": 0,
                            "peak_hour": entry.get("peak_hour_flag", "0")}
        agg_data[ts]["total_count"] += count
        agg_data[ts]["count_entries"] += 1

    chart_data = []
    for ts in sorted(agg_data.keys()):
        item = agg_data[ts]
        chart_data.append({
            "time": ts.split(" ")[1][:5],   # HH:MM
            "volume": item["total_count"] // item["count_entries"],
            "is_peak": int(item["peak_hour"])
        })

    return chart_data

@app.get("/api/v1/incidents")
def get_incidents():
    """
    Reads validated incident events.
    Path: annotations/event_validation/incidents.csv
    """
    incidents_path = os.path.join(SANDBOX_DIR, "annotations/event_validation/incidents.csv")
    incidents = []
    if os.path.exists(incidents_path):
        with open(incidents_path, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                incidents.append(row)
    return incidents

@app.get("/api/v1/clips")
def get_clips():
    """
    Returns the structured clip manifest with scenario labels and intended use.
    Path: video/manifests/clip_manifest.json
    """
    manifest_path = os.path.join(SANDBOX_DIR, "video/manifests/clip_manifest.json")
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r') as f:
            return json.load(f)
    return {"clips": []}

@app.get("/api/v1/signal-status")
def get_signal_status():
    """
    Returns signal phase event log.
    Path: signals/logs/signal_timing_log.csv
    """
    signal_path = os.path.join(SANDBOX_DIR, "signals/logs/signal_timing_log.csv")
    signals = []
    if os.path.exists(signal_path):
        with open(signal_path, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                signals.append(row)
    return signals

@app.get("/api/v1/metadata/cameras")
def get_cameras():
    """Camera registry from metadata pack."""
    path = os.path.join(SANDBOX_DIR, "metadata/camera_registry.json")
    if os.path.exists(path):
        with open(path, 'r') as f:
            return json.load(f)
    return {}

@app.get("/api/v1/metadata/phases")
def get_phase_map():
    """Phase-to-movement-to-lane mapping."""
    path = os.path.join(SANDBOX_DIR, "metadata/phase_movement_map.json")
    if os.path.exists(path):
        with open(path, 'r') as f:
            return json.load(f)
    return {}

@app.get("/api/v1/metadata/cycles")
def get_cycle_definitions():
    """Signal cycle timing assumptions and optimization levers."""
    path = os.path.join(SANDBOX_DIR, "metadata/cycle_definitions.json")
    if os.path.exists(path):
        with open(path, 'r') as f:
            return json.load(f)
    return {}

@app.get("/api/v1/traffic-profile")
def get_traffic_profile():
    """
    Returns the Google Maps route duration profile across the day.
    Path: detector/daily_traffic_profile.json
    """
    profile_path = os.path.join(SANDBOX_DIR, "detector/daily_traffic_profile.json")
    if os.path.exists(profile_path):
        with open(profile_path, 'r') as f:
            return json.load(f)
    return []

@app.get("/api/v1/phase2/video-intelligence")
async def get_video_intel():
    counts_path = os.path.join(PHASE2_DIR, "live_directional_counts.json")
    pressure_path = os.path.join(PHASE2_DIR, "live_queue_pressure.json")
    try:
        with open(counts_path, 'r') as f: counts = json.load(f)
        with open(pressure_path, 'r') as f: pressure = json.load(f)
        return {"counts": counts, "pressure": pressure}
    except:
        return {"error": "Video intelligence data missing"}

@app.get("/api/v1/phase2/google-context")
async def get_google_context():
    profile_path = os.path.join(PHASE2_DIR, "google_route_probe_profile.json")
    try:
        with open(profile_path, 'r') as f: profile = json.load(f)
        return profile
    except:
        return {"error": "Google context missing"}

@app.get("/api/v1/phase2/decision-support")
async def get_decision_support():
    rec_path = os.path.join(PHASE2_DIR, "current_phase_recommendation.json")
    support_path = os.path.join(PHASE2_DIR, "signal_decision_support.json")
    outlook_path = os.path.join(PHASE2_DIR, "same_day_signal_outlook.json")
    forecast_path = os.path.join(PHASE2_DIR, "fused_short_term_forecast.json")
    bench_path = os.path.join(PHASE2_DIR, "forecasting_benchmarks.json")
    try:
        with open(rec_path, 'r') as f: rec = json.load(f)
        with open(support_path, 'r') as f: support = json.load(f)
        with open(outlook_path, 'r') as f: outlook = json.load(f)
        with open(forecast_path, 'r') as f: forecast = json.load(f)
        with open(bench_path, 'r') as f: bench = json.load(f)
        return {
            "recommendation": rec, 
            "support": support, 
            "outlook": outlook, 
            "forecast": forecast,
            "benchmarks": bench.get("model_comparisons", [])
        }
    except:
        return {"error": "Decision support data missing"}

@app.get("/api/v1/phase2/incidents")
def get_phase2_incidents():
    path = os.path.join(PHASE2_DIR, "event_notifications.json")
    if os.path.exists(path):
        with open(path, 'r') as f: return json.load(f)
    return []

@app.get("/api/v1/phase2/system-health")
def get_system_health():
    """Returns detailed system health indicators for the Phase 2 dashboard."""
    invalid_path = os.path.join(SANDBOX_DIR, "detector/generated/phase2/invalid_records_log.json")
    invalid_count = 0
    if os.path.exists(invalid_path):
        with open(invalid_path, 'r') as f:
            data = json.load(f)
            invalid_count = data.get("total_invalid", 0)
            
    # Heuristic/Mocked values for real-time indicators in this feasibility build
    return {
        "ingestion_status": "ONLINE",
        "stream_uptime_min": 142,
        "dropped_frames": 14,
        "sync_state": "SYNCHRONIZED",
        "invalid_record_count": invalid_count,
        "last_refresh": "Just Now"
    }

@app.get("/api/v1/sandbox/health")
def sandbox_health():
    """
    Quick health check: verifies all primary sandbox files exist.
    Returns a checklist of file existence for system monitoring.
    """
    checks = {
        "forecasting_dataset": "detector/forecasting_ready/demand_forecast_source.csv",
        "signal_timing_log": "signals/logs/signal_timing_log.csv",
        "stream_manifest": "video/manifests/stream_source_manifest.json",
        "clip_manifest": "video/manifests/clip_manifest.json",
        "phase_movement_map": "metadata/phase_movement_map.json",
        "camera_registry": "metadata/camera_registry.json",
        "detection_schema": "schemas/detection_output_schema.json",
        "event_schema": "schemas/event_notification_schema.json",
        "benchmark_seed": "annotations/benchmark_seed.json",
        "incidents": "annotations/event_validation/incidents.csv",
        "phase2_forecasts": "detector/generated/phase2/demand_forecasts.json",
        "phase2_recommendations": "detector/generated/phase2/signal_recommendations.json"
    }
    result = {}
    all_ok = True
    for key, rel_path in checks.items():
        exists = os.path.exists(os.path.join(SANDBOX_DIR, rel_path))
        result[key] = "OK" if exists else "MISSING"
        if not exists:
            all_ok = False

    return {
        "sandbox_status": "HEALTHY" if all_ok else "DEGRADED",
        "checks": result
    }
