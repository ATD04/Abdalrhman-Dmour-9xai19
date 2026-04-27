# 03 Code Walkthrough

## Main Files
### `scripts/build_simulation_data.py`
This script reads the sandbox files and creates `app/data/simulation_dataset.json`.

Key responsibilities:
1. aggregate detector data into network and directional demand
2. align signal-phase state to each 15-minute timestamp
3. load incidents and congestion events
4. generate Model 1 detection outputs
5. generate Model 2 insight outputs
6. generate Model 3 forecast outputs
7. derive demo scenarios
8. detect the available live video

### `scripts/serve_simulation.py`
This script runs the local simulation server.

Key responsibilities:
1. rebuild the dataset if needed
2. expose local API endpoints
3. serve the dashboard files
4. serve the live video file to the browser
5. expose glossary and model-stack endpoints
6. provide a health endpoint for verification

### `scripts/verify_simulation.py`
This script checks that the deliverable is complete.

It validates:
1. required files exist
2. generated dataset exists
3. detector count is correct
4. timeline/scenario payloads are present
5. video configuration exists

### `app/index.html`
Defines the dashboard structure and layout.

### `app/styles.css`
Defines the visual identity of the simulation dashboard.

### `app/app.js`
Loads API data, manages playback state, renders YOLO-style overlays, updates KPIs, explains the metrics, renders model cards, and switches scenarios.

## Why The Code Was Structured This Way
1. Clear separation between build-time logic and run-time logic.
2. Easy to explain to judges and teammates.
3. Easy to extend in Phase 2 without rewriting the whole stack.

## What To Say If Asked Why No Database Was Used
For Phase 1, a prebuilt JSON simulation dataset is faster, simpler, and more stable for demo delivery.
If the project moves into Phase 2 or production, the same logic can move behind a persistent store or streaming pipeline.
