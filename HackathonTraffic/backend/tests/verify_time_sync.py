import os
import json
import csv

SANDBOX_DIR = "data_sandbox"
CANONICAL_DATE = "2026-04-21"

def check_csv(file_path):
    if not os.path.exists(file_path):
        return f"MISSING: {file_path}"
    with open(file_path, 'r') as f:
        reader = csv.reader(f)
        header = next(reader)
        if 'timestamp' not in header:
            return f"NO TIMESTAMP COLUMN: {file_path}"
        ts_idx = header.index('timestamp')
        row = next(reader)
        if CANONICAL_DATE in row[ts_idx]:
            return f"OK: {file_path}"
        else:
            return f"DATE MISMATCH ({row[ts_idx]}): {file_path}"

def check_manifest(file_path):
    if not os.path.exists(file_path):
        return f"MISSING: {file_path}"
    with open(file_path, 'r') as f:
        data = json.load(f)
        sources = data.get('sources', [])
        for s in sources:
            start = s.get('timestamp_start', '')
            if CANONICAL_DATE not in start:
                return f"DATE MISMATCH ({start}): {file_path}"
        return f"OK: {file_path}"

def run_checks():
    files_to_check = [
        ("CSV", os.path.join(SANDBOX_DIR, "signals/logs/signal_timing_log.csv")),
        ("CSV", os.path.join(SANDBOX_DIR, "detector/forecasting_ready/demand_forecast_source.csv")),
        ("CSV", os.path.join(SANDBOX_DIR, "detector/raw_sumo_output.csv")),
        ("MANIFEST", os.path.join(SANDBOX_DIR, "video/manifests/stream_source_manifest.json")),
    ]
    
    print("=== Phase 1 Time Alignment Verification ===")
    for ftype, path in files_to_check:
        if ftype == "CSV":
            print(check_csv(path))
        else:
            print(check_manifest(path))

if __name__ == "__main__":
    run_checks()
