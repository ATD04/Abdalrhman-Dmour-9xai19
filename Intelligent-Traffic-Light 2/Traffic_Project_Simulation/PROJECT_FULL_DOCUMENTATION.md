# Intelligent Traffic Light Project — Full Documentation

## 1. Project Overview

The Wadi Saqra Intelligent Traffic Light system is a real-time, AI-powered traffic management and digital twin platform for the Wadi Saqra intersection in Amman, Jordan. It fuses live Google Routes data, SUMO microsimulation, YOLO-based video analytics, ML forecasting, and anomaly detection, all visualized in a bilingual (English/Arabic) web dashboard.

---

## 2. System Architecture

### 2.1. Core Layers

- **Data Acquisition**: Ingests video streams, Google Traffic API, and signal logs. Handles timestamp and unit normalization.
- **Digital Twin (Intelligence Layer)**: SUMO-based simulation engine running a real-time model of the intersection.
- **Forecasting Module**: Predicts traffic demand 15, 30, and 60 minutes ahead using historical and real-time data.
- **Incident Detection**: Detects wrong-way driving, queue spillback, abnormal stops, and stalled vehicles.
- **Storage & Logging**: Persists events, health metrics, and forecasts to SQLite and JSONL logs.
- **Operator Interface**: Bilingual dashboard for real-time visualization and decision support.

### 2.2. Key Design Principles

- **Read-Only Simulation**: No direct control of field hardware; all recommendations are advisory.
- **Bilingual UI**: Full support for English and Arabic.
- **Resilient Ingestion**: Automatic reconnection and exponential backoff for all data streams.
- **Security**: Local storage only, no cloud dependencies; all simulation commands are read-only.

---

## 3. Folder Structure & Major Components

```
Traffic_Project_Simulation/
├── app/                        # Frontend (HTML, CSS, JS)
│   ├── index.html / index.js / index.css
│   ├── video-analytics.js / video-analytics.css
│   ├── data/                   # Runtime data (logs, manifests, tracking JSON)
│   └── media/                  # Processed video previews and thumbnails
├── config/
│   ├── live_config.json        # Main configuration (committed)
│   └── *.local.json            # Local overrides — credentials (git-ignored)
├── scripts/
│   ├── start_live_simulation.py   # Main server entry point
│   ├── sumo_traci_runner.py       # SUMO/TraCI engine
│   ├── live_support.py            # Google API + helpers
│   ├── build_video_analytics_dataset.py  # YOLO26x video processor
│   ├── data_sources/              # Data source abstraction layer
│   ├── forecasting/               # ML flow forecasting
│   ├── anomaly/                   # ML anomaly detection
│   └── live_video/                # Live YOLO stream processor
├── sumo_scenarios/live/        # Generated SUMO network files
├── tests/                      # Pytest smoke tests
├── requirements-live.txt       # Python dependencies
├── start_simulation.command    # One-click launcher (macOS/Linux)
└── start_simulation.bat        # One-click launcher (Windows)
```

---

## 4. Backend Components

- **sumo_traci_runner.py**: Orchestrates the SUMO simulation and synchronizes with live data.
- **stream_processor.py**: Handles video ingestion and auto-reconnect.
- **acquisition.py**: Normalizes and validates incoming data.
- **flow_forecaster.py**: ML-based traffic prediction engine.
- **storage_manager.py**: Handles all data logging (SQLite and JSONL).
- **live_support.py**: Google API integration and helpers.

---

## 5. Frontend Components

- **index.html / index.js / index.css**: Main dashboard, tabs, and cards.
- **video-analytics.js / video-analytics.css**: Video analytics overlay, camera vehicle count, event logs, and summary cards.
- **Bilingual UI**: All UI elements support both English and Arabic.

---

## 6. Data & Configuration

- **config/live_config.json**: Central configuration for SUMO, Google API, data sources, adaptive signal, video, ML, and anomaly detection.
- **data/**: Stores runtime logs, manifests, and tracking data.
- **sumo_scenarios/**: Contains SUMO network, route, and configuration files.

---

## 7. Database Design

- **Relational (SQLite)**: Structured queries and reporting.
  - `events`: Logs incidents and anomalies.
  - `forecasts`: Stores multi-horizon predictions.
  - `system_health`: Monitors stack health.
- **Flat-File (JSONL)**: Immutable audit trails, rotated daily.
- **Normalization**: All timestamps in UTC ISO8601, velocities in km/h, distances in meters.

---

## 8. Feature Evolution & Major Phases

- **Phase 1**: SUMO simulation, basic dashboard, Google API integration.
- **Phase 2**: YOLO26x video analytics, event detection, ML forecasting.
- **Phase 3**: Bilingual UI, AI anomaly detection, camera-based vehicle counting, What-If Decision Preview, premium dark theme.
- **Recent**: Full CSS-only visual upgrade to a “dark, premium, AI operations center” style.

---

## 9. Running the System

### Quick Start

```bash
# macOS / Linux
./start_simulation.command

# Windows
start_simulation.bat
```

### Manual Start

```bash
python3 scripts/build_video_analytics_dataset.py --source-root ../Traffic_Data_Sandbox/live_stream --force
python3 scripts/forecasting/flow_forecaster.py --out scripts/forecasting/model_artifact.pkl
python3 scripts/anomaly/detector.py --out scripts/anomaly/model_artifact.pkl
python3 scripts/start_live_simulation.py --open
```

Dashboard opens at: **http://127.0.0.1:3100**

---

## 10. Dashboard Features

- **Live Digital Twin**: Real-time SUMO simulation, Google traffic, queue/speed/signal KPIs, emissions, ML forecast, anomaly alerts, theme toggle.
- **Video Analytics**: YOLO26x detection/tracking, event logs, camera vehicle count, timeline, recommendations.
- **AI What-If Decision Preview**: Simulates signal changes and shows predicted impact.
- **Camera Intelligence Summary**: Aggregates vehicle counts and detection confidence.
- **Bilingual Support**: All features in English and Arabic.
- **Premium Dark Theme**: Modern, high-contrast, AI operations center look (CSS-only).

---

## 11. API Reference

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

## 12. Testing

```bash
python3 -m pytest tests/ -q
```

---

## 13. Troubleshooting

- **SUMO not found**: Update `sumo.binary` in config.
- **Server not running**: Restart with `python3 scripts/start_live_simulation.py --open`
- **No videos in analytics**: Run the build step for video analytics.
- **YOLO26x slow/first run**: Ensure internet for model download.
- **Google API timeouts**: System auto-falls back to detector data.

---

## 14. Extending & Customizing

- **Add new detectors or cameras**: Update data sources and config.
- **Change simulation network**: Replace SUMO scenario files.
- **Customize UI**: Edit CSS/HTML in `app/`.
- **Add new ML models**: Extend `forecasting/` or `anomaly/` scripts.

---

## 15. Visual Theme

- **index.css** and **video-analytics.css** now use a premium dark palette with gradients, glows, and high-contrast cards, strictly via CSS.
- No backend or JS logic was changed for theming.

---

## 16. References & Further Reading

- See `docs/` for detailed design, database, and technical handover notes.
- All code is documented inline for further developer reference.

---

If you need even more granular details (e.g., per-script, per-function, or per-UI-component), see the docs folder or request a specific area to expand.
