import json
import os
import datetime

# Configuration
SANDBOX_DIR = "../data_sandbox"
OUTPUT_DIR = os.path.join(SANDBOX_DIR, "detector/generated/phase2")
REAL_GOOGLE_JSON = os.path.join(SANDBOX_DIR, "detector/daily_traffic_profile.json")

# Specific Artifacts
PROBE_PROFILE_JSON = os.path.join(OUTPUT_DIR, "google_route_probe_profile.json")
CONTEXT_JSON = os.path.join(OUTPUT_DIR, "same_day_traffic_context.json")

def run_google_context():
    print("Running Phase 2 Google Maps Context Sync...")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    if not os.path.exists(REAL_GOOGLE_JSON):
        print(f"ERROR: Google API results missing at {REAL_GOOGLE_JSON}")
        # Save UNAVAILABLE state
        error_state = {"status": "SOURCE UNAVAILABLE", "error": "Google Maps API data not found in sandbox"}
        with open(PROBE_PROFILE_JSON, 'w') as f: json.dump(error_state, f)
        with open(CONTEXT_JSON, 'w') as f: json.dump(error_state, f)
        return

    # Read real API results
    with open(REAL_GOOGLE_JSON, 'r') as f:
        real_data = json.load(f)

    # Process into context summary
    summary = {}
    # Since the real script currently probes one "Main Corridor", we map it to the primary approach (West/East)
    # in this feasibility build
    avg_congestion = sum(d["congestion_ratio"] for d in real_data) / len(real_data) if real_data else 1.0
    
    summary = {
        "RT-MAIN": {
            "avg_congestion": round(avg_congestion, 2),
            "peak_status": "Heavy" if avg_congestion > 1.4 else "Moderate"
        }
    }

    with open(PROBE_PROFILE_JSON, 'w') as f:
        json.dump({
            "site_id": "AMM-WS-01",
            "generated_at": datetime.datetime.now().isoformat(),
            "profile": real_data,
            "status": "LIVE"
        }, f, indent=2)

    with open(CONTEXT_JSON, 'w') as f:
        json.dump({
            "context_type": "Google Maps Routes API (Live)",
            "summary": summary,
            "status": "LIVE"
        }, f, indent=2)

    print(f"Google Context Synced. Artifacts saved to {OUTPUT_DIR}")

if __name__ == "__main__":
    run_google_context()
