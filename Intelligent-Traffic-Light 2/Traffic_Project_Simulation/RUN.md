# Wadi Saqra Live Digital Twin — Run Guide

> Full setup instructions are in **README.md**.
> This file covers the day-to-day run sequence only.

---

## Prerequisites

- Python 3.9+ with virtualenv activated (`source .venv/bin/activate`)
- SUMO 1.26+ installed and path set in `config/live_config.json`
- Dependencies installed: `pip install -r requirements-live.txt`

All commands below are run from inside `Traffic_Project_Simulation/`.

---

## Step-by-Step Execution

### 1. Build the Video Analytics Dataset *(one-time)*

Processes traffic videos using **YOLO26x** (auto-downloaded ~113 MB on first run).
Writes preview mp4 at full source FPS for smooth playback; YOLO runs at 10 fps.

```bash
python3 scripts/build_video_analytics_dataset.py \
    --source-root "../Traffic_Data_Sandbox/live_stream" \
    --inference-fps 10 \
    --force
```

Custom video directory:
```bash
python3 scripts/build_video_analytics_dataset.py \
    --source-root /path/to/videos \
    --inference-fps 10 \
    --force
```

Re-runs **merge** with the existing manifest — previously processed videos are preserved.

---

### 2. Train the ML Models *(one-time, recommended)*

Upgrades the forecaster from seasonal-naive to gradient-boosted (768 samples/direction)
and the anomaly detector from statistical z-score to Isolation Forest.

```bash
python3 scripts/forecasting/flow_forecaster.py --out scripts/forecasting/model_artifact.pkl
python3 scripts/anomaly/detector.py            --out scripts/anomaly/model_artifact.pkl
```

---

### 3. Start the Live Simulation Server

```bash
python3 scripts/start_live_simulation.py --open
```

Dashboard opens at **http://127.0.0.1:3100**.  
The `--open` flag launches the browser automatically.

---

### 4. Dashboard Tabs

| Tab | Content |
|-----|---------|
| **Live Digital Twin** | SUMO simulation + Google Routes + Webster optimizer + ML forecast + AI anomaly |
| **Video Analytics** | YOLO26x tracks, event detection, scrub-able timeline |

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

## API Endpoints

```
GET  /api/health                      System status
GET  /api/live-state                  Current snapshot (gzip-compressed)
GET  /api/live-events                 SSE event stream (event-driven, no polling)
GET  /api/live-history                Rolling 10-min history
GET  /api/network-geometry            Cached road geometry (gzip, max-age=3600)
GET  /api/signal-recommendation       Webster optimizer result
GET  /api/flow-forecast?horizon=15    ML traffic forecast (5 / 15 / 30 min)
GET  /api/anomaly                     AI anomaly detection result
GET  /api/emissions                   CO₂ / NOₓ / fuel summary
GET  /api/data-source                 Active data source diagnostics
GET  /api/live-video-stats            YOLO live processor stats (if enabled)
POST /api/adaptive-toggle             Enable / disable adaptive control
```

---

## Configuration Highlights

`config/live_config.json` key toggles:

| Setting | Purpose |
|---------|---------|
| `data_sources.primary` | `"google"` or `"detector"` |
| `data_sources.fallback_chain` | Ordered fallback list |
| `adaptive_signal.enabled_on_start` | Adaptive control at startup |
| `live_video.enabled` | Real-time YOLO on live camera stream |
| `live_video.source` | RTSP URL or local file path |
| `forecasting.enabled` | ML flow forecast |
| `anomaly.enabled` | AI anomaly detection |
| `emissions.enabled` | Emissions KPI tracking |

---

## Development & Testing

```bash
# Run smoke tests
python3 -m pytest tests/ -q

# Generate synthetic demo data (no SUMO required)
python3 scripts/mock_live_data.py

# Verbose server logging
ITS_LOG_LEVEL=DEBUG python3 scripts/start_live_simulation.py --open
```

Logs rotate automatically in `app/data/live_server.log`.

---

## One-Click Start

```bash
# macOS / Linux
./start_simulation.command

# Windows
start_simulation.bat
```
