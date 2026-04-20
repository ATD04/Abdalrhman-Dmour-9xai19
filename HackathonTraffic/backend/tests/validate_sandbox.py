import json
import csv
import os
from datetime import datetime

class SandboxTester:
    def __init__(self, root_dir):
        self.root = root_dir
        self.results = []

    def log(self, check, status, message):
        self.results.append({"Check": check, "Status": status, "Message": message})

    def test_files_exist(self):
        paths = [
            "data_sandbox/metadata/intersection_metadata.json",
            "data_sandbox/metadata/lane_map.json",
            "data_sandbox/detector/detector_counts.csv",
            "data_sandbox/signals/signal_timing_log.csv",
            "data_sandbox/annotations/incidents.csv",
            "backend/app/services/video_sim.py"
        ]
        for p in paths:
            exists = os.path.exists(os.path.join(self.root, p))
            self.log("File Existence", "PASS" if exists else "FAIL", f"Path: {p}")

    def test_id_alignment(self):
        try:
            lane_file = os.path.join(self.root, "data_sandbox/metadata/lane_map.json")
            with open(lane_file, 'r') as f:
                lane_ids = set([l["id"] for l in json.load(f)["lanes"]])

            detector_ids = set()
            counts_file = os.path.join(self.root, "data_sandbox/detector/detector_counts.csv")
            with open(counts_file, 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    detector_ids.add(row["detector_id"])

            missing = detector_ids - lane_ids
            if not missing:
                self.log("ID Alignment", "PASS", "All detector IDs match lane map IDs.")
            else:
                self.log("ID Alignment", "FAIL", f"Detectors {missing} not in lane map.")
        except Exception as e:
            self.log("ID Alignment", "ERROR", str(e))

    def test_time_series(self):
        try:
            timestamps = set()
            counts_file = os.path.join(self.root, "data_sandbox/detector/detector_counts.csv")
            with open(counts_file, 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    timestamps.add(row["timestamp"])
            
            unique_ts = len(timestamps)
            if unique_ts == 96: # 24h / 15m
                self.log("Time Continuity", "PASS", "Dataset covers full 24h (96 intervals).")
            else:
                self.log("Time Continuity", "FAIL", f"Found {unique_ts} intervals; expected 96.")
        except Exception as e:
            self.log("Time Continuity", "ERROR", str(e))

    def run_all(self):
        print(f"\n--- Phase 1 Sandbox Audit: {datetime.now().strftime('%Y-%m-%d')} ---\n")
        self.test_files_exist()
        self.test_id_alignment()
        self.test_time_series()
        
        print(f"{'Check':<20} {'Status':<10} {'Message'}")
        print("-" * 60)
        for r in self.results:
            print(f"{r['Check']:<20} {r['Status']:<10} {r['Message']}")
        
        if any(r["Status"] == "FAIL" for r in self.results):
            print("\n❌ VERDICT: Phase 1 has localized issues. Fix before Phase 2.")
        else:
            print("\n✅ VERDICT: Phase 1 is Solid. Ready for Phase 2.")

if __name__ == "__main__":
    tester = SandboxTester(".")
    tester.run_all()
