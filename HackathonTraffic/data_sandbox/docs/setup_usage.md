# Setup and Usage Guide — AMM-WS-01 Traffic Data Sandbox

This guide covers how to set up and use the sandbox package for development, testing, and Phase 2 module building.

---

## 1. Prerequisites

| Requirement | Version | Purpose |
|---|---|---|
| Python | 3.9+ | Backend, data scripts |
| Node.js | 18+ | Sandbox Viewer (optional) |
| Eclipse SUMO | 1.26.0 | Re-running simulation (optional) |

---

## 2. Repository Structure

```
HackathonTraffic/
├── backend/              # FastAPI Sandbox Viewer (support tool)
├── frontend/             # React Sandbox Monitor (support tool)
└── data_sandbox/         # PRIMARY DELIVERABLE — Sandbox Package
    ├── video/            # Stream source, clips, manifests
    ├── detector/         # Detector logs (raw + forecasting-ready)
    ├── signals/          # Signal timing event logs
    ├── metadata/         # Full integration map
    ├── annotations/      # Ground-truth + benchmark seeds
    ├── schemas/          # Data contracts for all modules
    ├── fault_samples/    # Bad-data test cases
    └── docs/             # Methodology, policies, naming conventions
```

---

## 3. Starting the Sandbox Viewer (Optional)

> The viewer is an internal support tool, not the primary Phase 1 deliverable.

**Backend (FastAPI):**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend (React):**
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

---

## 4. Using the Core Datasets

### Detector Demand Data
```python
import csv
with open('data_sandbox/detector/forecasting_ready/demand_forecast_source.csv') as f:
    reader = csv.DictReader(f)
    for row in reader:
        # row['timestamp'], row['detector_id'], row['vehicle_count']
        pass
```

### Signal Timing Log
```python
import csv
with open('data_sandbox/signals/logs/signal_timing_log.csv') as f:
    reader = csv.DictReader(f)
    for row in reader:
        # row['timestamp'], row['phase_number'], row['signal_state']
        pass
```

### Video Stream (file replay)
```
http://localhost:8000/video/raw/video1.mp4  # CAM-01-N (AM Peak)
http://localhost:8000/video/raw/video2.mp4  # CAM-02-S (PM Peak)
```

---

## 5. Validating Sandbox Schemas

```bash
# Quick check: validate key JSON files are parseable
python3 -c "
import json, os
files = [
  'data_sandbox/metadata/camera_registry.json',
  'data_sandbox/metadata/approach_map.json',
  'data_sandbox/metadata/phase_movement_map.json',
  'data_sandbox/schemas/detection_output_schema.json',
  'data_sandbox/schemas/event_notification_schema.json',
]
for f in files:
    with open(f) as fp:
        json.load(fp)
    print(f'OK: {f}')
"
```

---

## 6. Re-Running the SUMO Simulation (Optional)

> Only needed if regenerating detector/signal log data from scratch.

```bash
cd data_sandbox/simulation/sumo
sumo -c wadi_saqra.sumocfg
# Then run: backend/scripts/sumo_to_sandbox.py to normalize outputs
```

---

## 7. Key Reference Files

| Purpose | File |
|---|---|
| ID conventions | `docs/naming_conventions.md` |
| System boundaries | `docs/isolation_note.md` |
| Data assumptions | `docs/source_assumptions.md` |
| Known limitations | `docs/limitations_note.md` |
| Benchmarking targets | `annotations/benchmark_seed.json` |
| Forecasting features | `detector/forecasting_ready/feature_definitions.json` |
