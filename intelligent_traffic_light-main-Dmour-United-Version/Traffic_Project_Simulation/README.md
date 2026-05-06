# Wadi Saqra Intelligent Traffic Light — Live Digital Twin

Real-time traffic management system for the Wadi Saqra intersection (Amman, Jordan).
Combines live detector sensor data with SUMO microsimulation, YOLO11x-seg instance
segmentation, HCM 2010 traffic engineering, ML forecasting, and an AI anomaly detector —
all rendered in a live web dashboard with a bilingual (Arabic / English) AI assistant.

---

## System Requirements

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.9 + | 3.11 recommended |
| SUMO | 1.26 + | Eclipse SUMO microsimulator |
| pip | 23 + | bundled with Python |
| Ollama | 0.20 + | Local grounded chat runtime (`gemma4:latest`) |
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

The system runs on **detector data by default** — all dashboard features remain fully
active without a Google API key. Detector data is sourced from 22 real loop-detector
CSVs calibrated to the Wadi Saqra intersection.

To enable live Google Routes corridor data as the primary source:

1. Create a Google Cloud project with the **Routes API** enabled.
2. Create a service account and download the JSON key file.
3. Place the key file at `config/google_service_account.local.json`.
4. Edit `config/live_config.local.json` to switch the primary source:
   ```json
   {
     "google": {
       "service_account_file": "config/google_service_account.local.json"
     },
     "data_sources": {
       "primary": "google",
       "fallback_chain": ["detector"]
     }
   }
   ```
5. Keep the key file outside version control (`config/*.local.json` is git-ignored).

> **Note**: If the Google project is deleted or the API quota is exceeded, the system
> automatically falls back to detector data with no operator action required.

### 6. Configure local LLM chat

The Chat tab uses Ollama locally by default.

```bash
ollama list
ollama pull gemma4:latest  # only needed if the model is not already installed
```

The dashboard checks Ollama through `GET /api/chat/health`.

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

Processes traffic videos with **YOLO11x-seg** (instance segmentation) and builds
colour-coded overlay videos. The model is downloaded automatically (~119 MB) on
the first run.

```bash
python3 scripts/video/build_video_analytics_dataset.py \
    --source-root "../Traffic_Data_Sandbox/live_stream" \
    --inference-fps 10 \
    --force
```

If your videos are in a different location:

```bash
python3 scripts/video/build_video_analytics_dataset.py \
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
python3 scripts/core/start_live_simulation.py --open
```

The dashboard opens at **http://127.0.0.1:3100**.

---

## Dashboard Features

### Tab 1 — Dashboard
- **High-Fidelity Digital Twin**: Realistic top-down vehicle rendering (body, windows, headlights, and dynamic brake lights).
- **Realistic Road Geometry**: Asphalt-textured road beds with lane markings and spatial grid.
- **Interactive Signal HUD**: Head-Up Display for real-time signal timing, countdowns, and progress bars.
- **Enhanced Data Overlays**: Frosted-glass UI for direction-specific traffic metrics (queue, flow, speed, delay).
- **Intelligent Scaling**: Vehicles maintain visibility across all zoom levels through dynamic inverse-scaling.
- AI anomaly alerts (Isolation Forest) and adaptive signal recommendations with HCM 2010 LOS grading.

### Tab 2 — Digital Twin (Simulation Lab)
- **Realistic Intersection View**: Rebuilt rendering engine with 3D-style signal heads (glow effects) and realistic queued vehicles.
- **Split-View Comparison**: Baseline vs. Candidate timing rendered with high-fidelity car shapes and animations.
- HCM 2010 capacity model: saturation flow 1800 veh/h/lane, v/c ratio, LOS A–F.
- Webster signal-timing optimizer with adaptive green extension.

### Tab 3 — Analytics
- **Optimized UX**: Scrollable Volume Heat Map container displaying one table at a time for better readability.
- 5 / 15 / 30 minute traffic-flow forecast (GBM model) and per-direction anomaly scores.
- Historical peak-hour summaries and demand pressure panels.

### Tab 4 — Chat (AI Assistant)
- Bilingual (Arabic / English) grounded LLM via Ollama (`gemma4:latest`)
- Supports colloquial Arabic: Egyptian (دلوقتي), Levantine (هلأ), Gulf dialects
- Read-only MCP-style tools over live and historical project data
- Clickable citations that open the exact source payload
- Safe refusal for unsupported or out-of-scope questions
- Complete answers — `num_predict` tuned to avoid mid-sentence truncation

### Tab 5 — Video Analytics
- **YOLO11x-seg** instance segmentation with colour-coded vehicle masks
- BoTSORT multi-object tracking baked into preview videos
- Event detection: queue build-up, abnormal stops, pedestrian presence, crash
- Scrub-able timeline with event markers
- Per-video event log with recommendations

### Tab 6 — System
- Runtime health and data-source diagnostics
- Alert dispatch diagnostics
- Chat/Ollama readiness status

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
GET  /api/chat/health                 Local LLM readiness + tool inventory
POST /api/chat/query                  Grounded LLM chat query
POST /api/chat/reset                  Reset chat conversation state
GET  /api/chat/reference/<ref_id>     Materialize a chat citation
POST /api/adaptive-toggle             Enable / disable adaptive control
```

---

## Configuration Reference (`config/live_config.json`)

| Key | Purpose |
|-----|---------|
| `sumo.binary` | Path to the `sumo` executable |
| `google.service_account_file` | Google API key path (`null` = detector fallback) |
| `google.poll_interval_seconds` | How often to refresh Google Routes corridor data |
| `data_sources.primary` | `"detector"` (default) or `"google"` |
| `data_sources.fallback_chain` | Ordered fallback list — e.g. `["google"]` or `["detector"]` |
| `adaptive_signal.enabled_on_start` | Enable adaptive control at startup |
| `adaptive_signal.queue_threshold_vehicles` | Vehicles before green extension |
| `live_video.enabled` | Enable real-time YOLO inference on live stream |
| `live_video.source` | Path or RTSP URL for live camera feed |
| `live_video.yolo_weights` | YOLO model file (`yolo26x.pt`) |
| `forecasting.enabled` | Enable ML flow forecast |
| `anomaly.enabled` | Enable AI anomaly detection |
| `llm.model` | Local Ollama model used by the Chat tab (`gemma4:latest`) |
| `llm.base_url` | Ollama API base URL |
| `llm.num_predict` | Max tokens for chat responses (default `1024`) |
| `llm.request_timeout_seconds` | Ollama request timeout in seconds (default `120`) |
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
│   ├── chat/                      Grounded LLM chat + read-only tools
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
python3 scripts/core/start_live_simulation.py --open
```

**Video Analytics tab shows no videos**
Run the build step first:
```bash
python3 scripts/video/build_video_analytics_dataset.py --source-root ../Traffic_Data_Sandbox/live_stream --force
```

**YOLO26x not found / slow first run**
The model (~113 MB) is downloaded automatically from the ultralytics hub on the first run.
Ensure internet access is available for that first execution.

**Google API timeout / circuit-breaker warnings in logs**
Normal — the system automatically falls back to detector data. The circuit breaker
retries every 5 minutes. If the Google Cloud project has been deleted or billing
disabled, set `data_sources.primary` to `"detector"` in `config/live_config.local.json`
to eliminate the retry noise entirely.

**Chat answers appear truncated**
Increase `llm.num_predict` in `config/live_config.local.json` (default is `1024`).
Also ensure `llm.request_timeout_seconds` is at least `120` for longer responses.
