# 04 Demo Guide

## Demo Objective
Show that the sandbox is no longer just data files.
It now behaves like an operator-facing traffic intelligence prototype.

## Suggested Demo Sequence
1. Start with the live feed panel and explain that Model 1 is represented as a YOLO-style detection overlay.
2. Point to the KPI cards and explain that they are driven by sandbox detector data and signal timing context.
3. Show the Model Stack panel and explain the three-model logic.
4. Show the Forecast Outlook panel and explain that Model 3 is using the extracted structured signals.
5. Move the timeline slider to show playback over time.
6. Switch between scenarios:
   - Normal Flow
   - Congested
   - Queue Spillback
   - Stalled Vehicle
   - Abnormal Stopping
   - Crash Demo
7. Open the documents panel to show explainability and project readiness.

## What To Say During The Demo
1. The detector data drives the operational metrics.
2. The signal log adds phase-awareness to the same timeline.
3. The object detection overlay shows what Model 1 would output visually.
4. The insight panel shows what Model 2 means operationally.
5. The forecast panel shows what Model 3 would predict next.
6. This is the Phase 1 bridge to forecasting, incident detection, and optimization.

## Demo Commands
### Build
`python3 scripts/build_simulation_data.py`

### Run
`python3 scripts/serve_simulation.py`

### Verify
`python3 scripts/verify_simulation.py`

## Health Check
Open:
`http://127.0.0.1:3100/api/health`

Expected result:
JSON with status `ok`
