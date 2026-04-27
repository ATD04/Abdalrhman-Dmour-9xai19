# Wadi Saqra Intelligent Traffic Light — Live Digital Twin

Real-time traffic management system for the Wadi Saqra intersection (Amman, Jordan).
Combines live Google Routes data with SUMO microsimulation, YOLO26x video analytics,
ML forecasting, and an AI anomaly detector — all rendered in a live web dashboard.

---

## System Requirements

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.9 + | 3.11 recommended |
| SUMO | 1.26 + | Eclipse SUMO microsimulator |
| pip | 23 + | bundled with Python |
| OS | macOS / Linux / Windows | MPS acceleration on Apple Silicon |

---

## Setup (first time)

### 1. Create a virtual environment

```bash
# from the repo root (Intelligent-Traffic-Light/)
python3 -m venv .venv
```

### 2. Activate the environment

```bash
# macOS / Linux
source .venv/bin/activate

# Windows
.venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r Traffic_Project_Simulation/requirements-live.txt
```

### 4. Install SUMO

Download from [eclipse.dev/sumo](https://eclipse.dev/sumo/) and install version 1.26 or later.

After installing, verify the binary paths in `config/live_config.json`:

```json
"sumo": {
  "binary":         "/path/to/sumo",
  "gui_binary":     "/path/to/sumo-gui",
  "netconvert_binary": "/path/to/netconvert"
}
```

**macOS default path** (installed via the .pkg installer):
```
/Library/Frameworks/EclipseSUMO.framework/Versions/1.26.0/EclipseSUMO/bin/
```

**Linux** (installed via apt / snap):
```
/usr/bin/sumo  or  /usr/local/bin/sumo
```

**Windows** (default installer):
```
C:\Program Files (x86)\Eclipse\Sumo\bin\sumo.exe
```

### 5. Configure Google Routes API (optional)

Without a Google API key the system runs on detector-data fallback — all features
remain active, only live corridor speed data will be unavailable.

To enable live Google Routes data:

1. Create a Google Cloud service account with the **Routes API** enabled.
2. Download the JSON key file.
3. Set the path in `config/live_config.json`:
   ```json
   "google": {
     "service_account_file": "config/google_service_account.local.json"
   }
   ```
4. Keep the key file outside version control (`config/*.local.json` is git-ignored).

---

## Running the System

### Quick start (one command)

```bash
# macOS / Linux
./start_simulation.command

# Windows
start_simulation.bat
```

Both scripts auto-detect the virtual environment and open the dashboard in your browser.

---

### Manual start

All commands below assume you are inside `Traffic_Project_Simulation/` with the
virtual environment activated.

#### Step 1 — Build the video analytics dataset (one-time)

Processes traffic videos with YOLO26x and builds the detection overlay.
YOLO26x is downloaded automatically (~113 MB) on the first run.

```bash
python3 scripts/build_video_analytics_dataset.py \
    --source-root "../Traffic_Data_Sandbox/live_stream" \
    --inference-fps 10 \
    --force
```

If your videos are in a different location:

```bash
python3 scripts/build_video_analytics_dataset.py \
    --source-root /path/to/your/videos \
    --inference-fps 10 \
    --force
```

#### Step 2 — Train ML models (one-time, recommended)

Trains the traffic-flow forecaster and anomaly detector on the detector CSV data.
Without this step the system falls back to statistical baselines — still functional.

```bash
python3 scripts/forecasting/flow_forecaster.py --out scripts/forecasting/model_artifact.pkl
python3 scripts/anomaly/detector.py            --out scripts/anomaly/model_artifact.pkl
```

#### Step 3 — Start the server

```bash
python3 scripts/start_live_simulation.py --open
```

The dashboard opens at **http://127.0.0.1:3100**.

---

## Dashboard Features

### Tab 1 — Live Digital Twin
- Real-time SUMO microsimulation fused with Google Routes live traffic
- Per-lane queue length, flow, speed, and signal state
- Webster signal-timing optimizer with adaptive green extension
- CO₂ / NOₓ / fuel emissions KPIs
- 15-minute ML flow forecast (YOLO26x + HistGradientBoosting)
- AI anomaly alerts (Isolation Forest)
- Dark / light theme toggle

### Tab 2 — Video Analytics
- YOLO26x object detection and BoTSORT tracking baked into preview videos
- Event detection: queue build-up, abnormal stops, pedestrian presence, crash
- Scrub-able timeline with event markers
- Per-video event log with recommendations

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `M` | Toggle SUMO map ↔ Google satellite |
| `A` | Toggle adaptive signal control |
| `T` | Toggle dark / light theme |
| `+` / `-` | Zoom in / out |
| `0` | Reset map view |
| `?` | Show shortcut reference |

---

## API Reference

```
GET  /api/health                      System status
GET  /api/live-state                  Current snapshot (gzip)
GET  /api/live-events                 SSE stream (event-driven)
GET  /api/live-history                Rolling 10-min history
GET  /api/network-geometry            Road geometry (cached, gzip)
GET  /api/signal-recommendation       Webster timing recommendation
GET  /api/flow-forecast?horizon=15    ML forecast (5 / 15 / 30 min)
GET  /api/anomaly                     AI anomaly detection result
GET  /api/emissions                   CO₂ / NOₓ / fuel summary
GET  /api/data-source                 Active data source diagnostics
POST /api/adaptive-toggle             Enable / disable adaptive control
```

---

## Configuration Reference (`config/live_config.json`)

| Key | Purpose |
|-----|---------|
| `sumo.binary` | Path to the `sumo` executable |
| `google.service_account_file` | Google API key path (`null` = fallback mode) |
| `google.poll_interval_seconds` | How often to refresh Google Routes data |
| `data_sources.primary` | `"google"` or `"detector"` |
| `data_sources.fallback_chain` | Ordered list of fallback sources |
| `adaptive_signal.enabled_on_start` | Enable adaptive control at startup |
| `adaptive_signal.queue_threshold_vehicles` | Vehicles before green extension |
| `live_video.enabled` | Enable real-time YOLO inference on live stream |
| `live_video.source` | Path or RTSP URL for live camera feed |
| `live_video.yolo_weights` | YOLO model file (`yolo26x.pt`) |
| `forecasting.enabled` | Enable ML flow forecast |
| `anomaly.enabled` | Enable AI anomaly detection |
| `emissions.enabled` | Enable emissions KPI tracking |

---

## Project Structure

```
Traffic_Project_Simulation/
├── app/                        Frontend (HTML, CSS, JS)
│   ├── index.html / index.js / index.css
│   ├── video-analytics.js / video-analytics.css
│   ├── data/                   Runtime data (logs, manifests, tracking JSON)
│   └── media/                  Processed video previews and thumbnails
├── config/
│   ├── live_config.json        Main configuration (committed)
│   └── *.local.json            Local overrides — credentials (git-ignored)
├── scripts/
│   ├── start_live_simulation.py   Main server entry point
│   ├── sumo_traci_runner.py       SUMO/TraCI engine
│   ├── live_support.py            Google API + helpers
│   ├── build_video_analytics_dataset.py  YOLO26x video processor
│   ├── data_sources/              Data source abstraction layer
│   ├── forecasting/               ML flow forecasting
│   ├── anomaly/                   ML anomaly detection
│   └── live_video/                Live YOLO stream processor
├── sumo_scenarios/live/        Generated SUMO network files
├── tests/                      Pytest smoke tests
├── requirements-live.txt       Python dependencies
├── start_simulation.command    One-click launcher (macOS/Linux)
└── start_simulation.bat        One-click launcher (Windows)
```

---

## Testing

```bash
python3 -m pytest tests/ -q
```

---

## Troubleshooting

**Server does not start — SUMO not found**
Update the `sumo.binary` path in `config/live_config.json` to match your SUMO installation.

**"Load failed" in browser**
The server process may have stopped. Restart with:
```bash
python3 scripts/start_live_simulation.py --open
```

**Video Analytics tab shows no videos**
Run the build step first:
```bash
python3 scripts/build_video_analytics_dataset.py --source-root ../Traffic_Data_Sandbox/live_stream --force
```

**YOLO26x not found / slow first run**
The model (~113 MB) is downloaded automatically from the ultralytics hub on the first run.
Ensure internet access is available for that first execution.

**Google API timeout warnings in logs**
Normal — the system automatically falls back to detector data and resumes Google polling
at the next interval. No action required.
