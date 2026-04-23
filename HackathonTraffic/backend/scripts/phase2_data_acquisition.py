import json
import csv
import os
import datetime

# Configuration
SANDBOX_DIR = "../data_sandbox"
INPUT_DEMAND = os.path.join(SANDBOX_DIR, "detector/forecasting_ready/demand_forecast_source.csv")
INPUT_SIGNALS = os.path.join(SANDBOX_DIR, "signals/logs/signal_timing_log.csv")
OUTPUT_DIR = os.path.join(SANDBOX_DIR, "detector/generated/phase2")

# Outputs
DEMAND_JSON = os.path.join(OUTPUT_DIR, "normalized_demand.json")
SIGNALS_JSON = os.path.join(OUTPUT_DIR, "normalized_signals.json")
INVALID_LOG = os.path.join(OUTPUT_DIR, "invalid_records_log.json")

def parse_timestamp(ts_str):
    """Normalize mixed timestamp formats to ISO 8601."""
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%H:%M:%S"
    ]
    for fmt in formats:
        try:
            return datetime.datetime.strptime(ts_str, fmt).isoformat()
        except:
            continue
    return None

def run_data_acquisition():
    print("Running Phase 2 Data Acquisition Quick Build...")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    normalized_demand = []
    normalized_signals = []
    invalid_records = []
    
    # 1. Normalize Demand Data
    if os.path.exists(INPUT_DEMAND):
        with open(INPUT_DEMAND, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                ts = parse_timestamp(row.get("timestamp", ""))
                if not ts:
                    invalid_records.append({"source": "demand", "record": row, "reason": "Invalid Timestamp"})
                    continue
                
                normalized_demand.append({
                    "timestamp_iso": ts,
                    "detector_id": row.get("detector_id"),
                    "volume": int(row.get("vehicle_count", 0)),
                    "peak_hour": bool(int(row.get("peak_hour_flag", 0)))
                })
    
    # 2. Normalize Signal Data
    if os.path.exists(INPUT_SIGNALS):
        with open(INPUT_SIGNALS, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                ts = parse_timestamp(row.get("timestamp", ""))
                if not ts:
                    invalid_records.append({"source": "signals", "record": row, "reason": "Invalid Timestamp"})
                    continue
                
                normalized_signals.append({
                    "timestamp_iso": ts,
                    "phase_id": row.get("phase_number"),
                    "state": row.get("signal_state")
                })

    # Save Reviewable Artifacts
    with open(DEMAND_JSON, 'w') as f:
        json.dump(normalized_demand, f, indent=2)
    with open(SIGNALS_JSON, 'w') as f:
        json.dump(normalized_signals, f, indent=2)
    with open(INVALID_LOG, 'w') as f:
        json.dump({
            "total_invalid": len(invalid_records),
            "timestamp": datetime.datetime.now().isoformat(),
            "records": invalid_records
        }, f, indent=2)

    print(f"Acquisition Complete. Normalized {len(normalized_demand)} demand records and {len(normalized_signals)} signal records.")
    print(f"Invalid records isolated: {len(invalid_records)}")
    print(f"Artifacts saved to {OUTPUT_DIR}")

if __name__ == "__main__":
    run_data_acquisition()
