# 02 Architecture

## High-Level Flow
1. Sandbox files act as the raw source.
2. Model 1 is represented by YOLO-style visual detection outputs over the CCTV feed.
3. Model 2 converts those outputs plus detector data into operational insights.
4. Model 3 generates short-horizon traffic forecasts.
5. `scripts/build_simulation_data.py` transforms all of that into a single simulation dataset.
6. `scripts/serve_simulation.py` exposes local APIs and serves the dashboard.
7. `app/index.html` + `app/app.js` render the operator-facing simulation.

## Architecture Layers
### Data Layer
- Detector CSVs provide 15-minute traffic demand.
- Signal logs provide signal-phase context.
- Metadata provides geometry and site meaning.
- Annotation files provide incident and congestion reference events.

### Simulation Layer
The builder script generates:
- timeline snapshots
- daily totals
- scenario presets
- active alert windows
- video source configuration
- Model 1 detection outputs
- Model 2 insight outputs
- Model 3 forecast outputs

### Model Layer
#### Model 1 / Detection
- simulated vehicle boxes
- vehicle classes
- track IDs
- stopped-object candidates
- occupancy and speed proxies

#### Model 2 / Insights
- anomaly score
- dominant direction
- bottleneck explanation
- queue risk interpretation
- operator recommendations

#### Model 3 / Forecasting
- next 15-minute volume
- next 30-minute volume
- next 45-minute volume
- trend label
- forecast confidence

### API Layer
The local server exposes:
- `/api/health`
- `/api/summary`
- `/api/timeline`
- `/api/scenarios`
- `/api/incidents`
- `/api/daily-totals`
- `/api/metadata`
- `/api/video`
- `/api/glossary`
- `/api/model-stack`

### Frontend Layer
The dashboard displays:
- CCTV-like live feed panel
- YOLO-style object detection overlay
- KPI cards
- model stack cards
- forecast cards
- phase states
- direction load bars
- network demand chart
- metric glossary and plain-English explanation
- daily totals bars
- active alerts
- document links

## Video Strategy
The current simulation uses the available local video source and presents it inside a CCTV-styled frame with:
- timestamp overlay
- RTSP-style text overlay
- muted loop playback
- scanline and vignette treatment

This is enough for a Phase 1 demo, while keeping the architecture ready for:
- real RTSP streams
- multiple camera feeds
- scenario-specific clip libraries

## Why A Single Built Dataset Was Used
For a demo and dashboard simulation, a single generated JSON dataset is useful because:
1. it keeps the frontend simple
2. it makes verification easier
3. it avoids heavy query logic for a local prototype
4. it keeps the code easy to explain during discussion
