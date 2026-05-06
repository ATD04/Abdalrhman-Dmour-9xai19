# Feature Implementation Log

This file is updated during implementation so progress is visible even if work stops mid-stream.

## 2026-05-06 - Start

- Created the official government delivery integration plan in `documents/14_government_feature_integration_plan.md`.
- Created this live implementation log.
- Baseline repo state before implementation:
  - Existing uncommitted data changes are present under `Traffic_Project_Simulation/app/data`.
  - `new_features` has deleted old spec files and added the current feature spec files.
  - These pre-existing changes are not reverted.
- Baseline risks already identified from planning:
  - Existing backend tests fail because some modules cannot be imported consistently from package and direct-script contexts.
  - Existing Playwright chat UI smoke fails because the reference drawer no longer exposes the expected raw JSON view.
  - One-click launchers point at `scripts/start_live_simulation.py`, but the current server entrypoint lives at `scripts/core/start_live_simulation.py`.

## Gate 0 - Baseline Stabilization

- Status: complete.
- Goal: restore import, launcher, and existing test stability before feature work.
- Changes made:
  - Added `scripts/__init__.py` so the application can be imported as a normal package.
  - Added `scripts/start_live_simulation.py` as a compatibility wrapper for the existing one-click launchers.
  - Updated import fallbacks in server, data-source, traffic-count, live-video, and video-analytics modules so tests, package imports, and direct script execution use the same code.
  - Updated `simulation_lab.py`, `sumo_traci_runner.py`, and `messaging/alert_dispatch.py` import compatibility.
  - Restored a visible `Raw JSON` section in the Chat reference drawer so source evidence remains inspectable.
- Verification completed:
  - `.venv/bin/python Traffic_Project_Simulation/scripts/core/start_live_simulation.py --help` passes.
  - `.venv/bin/python Traffic_Project_Simulation/scripts/start_live_simulation.py --help` passes.
  - `.venv/bin/python -m pytest -q Traffic_Project_Simulation/tests/test_zone_support.py Traffic_Project_Simulation/tests/test_traffic_counts.py Traffic_Project_Simulation/tests/test_anomaly_fusion.py Traffic_Project_Simulation/tests/test_alert_dispatch.py` passed: 18 tests.
  - `.venv/bin/python -m pytest -q Traffic_Project_Simulation/tests/e2e/test_chat_ui.py` passed: 1 test.
  - `.venv/bin/python -m pytest -q Traffic_Project_Simulation/tests/test_chat_http.py Traffic_Project_Simulation/tests/test_chat_service.py Traffic_Project_Simulation/tests/test_chat_retrieval.py Traffic_Project_Simulation/tests/test_chat_citations.py Traffic_Project_Simulation/tests/e2e/test_chat_ui.py` passed: 12 tests.
- Additional fix:
  - Restored `/api/assistant/query` import compatibility through `cli.assistant_query`.
- Next verification:
  - Completed full existing suite before feature work: `.venv/bin/python -m pytest -q Traffic_Project_Simulation/tests` passed: 90 tests, 5 deprecation warnings in backtester timestamp handling.

## Feature 1 - Forecast Extension On Current GBM Forecaster

- Status: complete.
- Goal: extend the existing GBM/seasonal-naive forecaster with 60-minute support, recommendation/spillback metadata, and report-ready API fields without replacing the current model architecture.
- Changes made:
  - Extended `FlowForecaster.predict_all()` to normalize horizons into a 5-60 minute operational window.
  - Added schema versioning, `forecast_for`, `recommendation`, `spillback_risk`, `percentile_rank`, historical P20/P80, and estimated storage pressure per forecast point.
  - Kept existing `veh_per_hour`, `confidence`, `lower_bound`, and `upper_bound` fields unchanged for current frontend compatibility.
  - Persisted latest forecast snapshots from `/api/flow-forecast` to ignored runtime file `app/data/latest_flow_forecast.json`.
  - Added `.gitignore` entries for generated latest forecast/report runtime JSON.
  - Updated backtester timestamp generation to timezone-aware UTC.
- Verification completed:
  - `.venv/bin/python -m pytest -q Traffic_Project_Simulation/tests/test_forecaster_features.py Traffic_Project_Simulation/tests/test_backtester.py` passed: 17 tests.
  - `.venv/bin/python Traffic_Project_Simulation/scripts/utils/backtester.py --horizon 60` passed with overall MAE 12.6 veh/h across 2672 predictions.
- Next safe resume point:
  - Forecast feature is ready for downstream Replay and Reports use.

## Feature 2 - Zone Calibration Hardening

- Status: complete.
- Goal: strengthen the existing zone editor/API with stricter validation, default recovery, exportability, and safer operator feedback.
- Changes made:
  - Added backend geometry validation for too-short line zones, tiny polygons, and self-intersecting polygons.
  - Preserved `is_line` in normalized zone payloads so frontend and backend agree on line-zone intent.
  - Added `GET /api/zones/defaults` and `POST /api/zones/reset` for restoring metadata default zones.
  - Added Video Analytics toolbar controls for Reset and Export.
  - Added frontend draft validation before saving a zone.
  - Made Video Analytics use-case rendering tolerant of compact manifest payloads used by tests and partial builds.
- Verification completed:
  - `.venv/bin/python -m pytest -q Traffic_Project_Simulation/tests/test_zone_support.py Traffic_Project_Simulation/tests/test_traffic_counts.py` passed: 9 tests.
  - `node --check Traffic_Project_Simulation/app/video-analytics.js && node --check Traffic_Project_Simulation/app/index.js` passed.
  - `.venv/bin/python -m pytest -q Traffic_Project_Simulation/tests/e2e/test_video_zone_ui.py Traffic_Project_Simulation/tests/e2e/test_chat_ui.py` passed: 2 tests.
- Next safe resume point:
  - Zone calibration is ready for live-video incident mapping and operator-facing export/reset workflows.

## Feature 3 - YOLOv8 Incident Detection Pipeline

- Status: complete.
- Goal: add optional crash/fire incident detection alongside the existing vehicle-counting model, with conservative temporal confirmation and safe degraded behavior when weights are unavailable.
- Changes made:
  - Added `live_video/incident_detector.py` with optional YOLOv8 loading, class normalization, zone/direction mapping, temporal confirmation, dedupe, and recent-event retention.
  - Integrated the detector into `LiveVideoStreamProcessor` without coupling it to vehicle counting.
  - Added incident detector diagnostics to `/api/live-video-stats`.
  - Added `video_incidents` to live engine state and alert dispatch candidates.
  - Added incident-detector config under `live_video.incident_detection`, disabled by default until weights are available.
  - Extended anomaly video-fusion handling to recognize confirmed crash/fire events.
- Verification completed:
  - `.venv/bin/python -m pytest -q Traffic_Project_Simulation/tests/test_live_video_incident_detector.py Traffic_Project_Simulation/tests/test_anomaly_fusion.py` passed: 10 tests.
  - `.venv/bin/python -m pytest -q Traffic_Project_Simulation/tests/test_traffic_counts.py Traffic_Project_Simulation/tests/test_zone_support.py` passed: 9 tests.
- Next safe resume point:
  - Confirmed visual incidents are available for Replay markers and Reports.

## Feature 4 - Replay API And Frontend Tab

- Status: complete.
- Goal: expose a read-only replay buffer from live history and add an operator scrubber tab with markers, playback, deltas, and per-direction state.
- 2026-05-06 resume checkpoint:
  - Reviewed the in-progress branch and confirmed that the backend currently exposes only a minimal `/api/replay` payload with chronological snapshots.
  - Confirmed the frontend still lacks the `Replay` and `Reports` tabs, and no report-generation API has been added yet.
  - Safe next action: enrich replay payload/schema first, then implement deterministic report generation and wire both tabs into the UI with dedicated modules and tests.
- Changes made:
  - Enriched `scripts/core/replay.py` so each snapshot now carries timeline labels, elapsed time, delta math, per-direction rows, marker typing, and replay summary metadata.
  - Added automatic replay markers for phase changes, queue jumps, speed drops, anomaly incidents, and vision incidents.
  - Added the `Replay` tab to `app/index.html` with a dedicated `app/replay.js` module and `app/styles/replay-reports.css`.
  - Implemented scrubber, play/pause, marker filtering, KPI tiles, marker list, and per-direction state table without further growing the main dashboard logic.
- Verification completed:
  - `.venv/bin/python -m pytest -q Traffic_Project_Simulation/tests/test_replay_features.py` passed: 2 tests.
  - `.venv/bin/python -m pytest -q Traffic_Project_Simulation/tests/e2e/test_replay_reports_ui.py` passed for Replay smoke coverage.
- Next safe resume point:
  - Replay is now ready for operator use and report cross-linking.

## Feature 5 - Reports API And Frontend Tab

- Status: complete.
- Goal: build a deterministic operational report generator with optional Ollama phrasing, strict validation, persisted latest-report storage, and an operator-facing Reports tab.
- Changes made:
  - Added `scripts/core/reporting.py` with deterministic situation-report assembly, strict payload validation, persisted latest-report handling, and optional LLM wording enhancement with safe fallback.
  - Added `GET /api/report/latest` and `POST /api/report/generate` in the live server.
  - Reused the current forecaster and live incident streams so reports reflect actual forecast, anomaly, and vision-detection state.
  - Added the `Reports` tab to `app/index.html` with a dedicated `app/reports.js` module for loading, generating, and rendering reports, including a raw JSON viewer.
- Verification completed:
  - `.venv/bin/python -m pytest -q Traffic_Project_Simulation/tests/test_report_features.py` passed: 3 tests.
  - `.venv/bin/python -m pytest -q Traffic_Project_Simulation/tests/e2e/test_replay_reports_ui.py` passed for Reports smoke coverage.
- Next safe resume point:
  - Run full regression and delivery verification across the entire project.

## Final Regression And Delivery Evidence

- Status: complete.
- Commands and outcomes:
  - `node --check Traffic_Project_Simulation/app/index.js`
  - `node --check Traffic_Project_Simulation/app/replay.js`
  - `node --check Traffic_Project_Simulation/app/reports.js`
  - Result: passed.
  - `.venv/bin/python -m pytest -q Traffic_Project_Simulation/tests/test_replay_features.py Traffic_Project_Simulation/tests/test_report_features.py Traffic_Project_Simulation/tests/e2e/test_replay_reports_ui.py`
  - Result: passed, 6 tests.
  - `.venv/bin/python Traffic_Project_Simulation/scripts/core/start_live_simulation.py --help`
  - `.venv/bin/python Traffic_Project_Simulation/scripts/start_live_simulation.py --help`
  - Result: both launcher paths passed.
  - `.venv/bin/python -m pytest -q Traffic_Project_Simulation/tests`
  - Result: passed, 104 tests.
  - Real live server startup on port `3199` passed, and `GET /api/health`, `GET /api/replay`, and `GET /api/report/latest` all responded successfully.
- Runtime note:
  - In the local environment, Google Routes failed after retries and the running server safely fell back to `detector_data`; this degraded path remained operational and produced valid Replay and Report payloads.

## 2026-05-06 Operator Fix Pass - Simulation Lab, Replay, Reports

- Status: complete.
- Goal: address the follow-up operator issues reported after the first delivery pass:
  - clarify the two Simulation Lab engine choices,
  - reduce the "nothing happens yet" feeling while a what-if job is running,
  - eliminate Replay/Reports 404 failures against older or partially updated servers,
  - verify the real SUMO path instead of relying only on mocked tests.
- Changes made:
  - Renamed the Simulation Lab language around the scenario comparison so the UI now consistently distinguishes `Current Live Plan` from `Proposed Plan`.
  - Replaced the old simulation-engine dropdown with a two-card engine picker that explains the difference between `Quick Estimate` and `Detailed Digital Twin`.
  - Added an immediate Simulation Lab pending preview on the canvas and summary area, so the operator sees the live plan, proposed plan, and selected engine before the backend job completes.
  - Kept the what-if HTTP flow asynchronous and added polling-oriented UI states (`Queued`, `Running`, `Completed`) so the screen does not appear frozen.
  - Added frontend compatibility fallbacks:
    - Replay now rebuilds a local replay payload from `/api/live-history` if `/api/replay` returns `404`.
    - Reports now builds a deterministic local compatibility report from the available live APIs if `/api/report/latest` or `/api/report/generate` returns `404`.
  - Fixed a real SUMO startup bug in `scripts/simulation/simulation_lab.py`:
    - removed the conflicting manual `--remote-port` flag from the SUMO command,
    - let `traci.start(...)` manage the port itself,
    - constrained TraCI retries so failures fall back quickly instead of hanging the what-if job,
    - isolated the what-if TraCI session with `doSwitch=False` so running a SUMO what-if does not steal or close the live engine's primary TraCI connection,
    - hardened cleanup so temporary route files and TraCI connections are always released.
  - Added direct test coverage for the SUMO startup command so the duplicate-port regression is caught automatically.
- Verification completed:
  - `node --check Traffic_Project_Simulation/app/index.js`
  - `node --check Traffic_Project_Simulation/app/replay.js`
  - `node --check Traffic_Project_Simulation/app/reports.js`
  - Result: passed.
  - `pytest Traffic_Project_Simulation/tests/test_simulation_lab.py Traffic_Project_Simulation/tests/test_replay_features.py Traffic_Project_Simulation/tests/test_report_features.py Traffic_Project_Simulation/tests/e2e/test_replay_reports_ui.py -q`
  - Result: passed, 14 tests.
  - `pytest Traffic_Project_Simulation/tests/test_simulation_lab.py Traffic_Project_Simulation/tests/e2e/test_replay_reports_ui.py -q`
  - Result: passed, 10 tests, including the new direct SUMO-startup regression coverage.
  - `.venv/bin/python Traffic_Project_Simulation/scripts/start_live_simulation.py --help`
  - Result: passed from the project virtualenv.
  - `pytest Traffic_Project_Simulation/tests -q`
  - Result: passed, 109 tests.
  - Real live server startup on port `3211` passed.
  - Real endpoint checks passed:
    - `GET /api/health`
    - `GET /api/replay`
    - `GET /api/report/latest`
  - Real what-if job check passed:
    - `POST /api/simulation/what-if` with `engine=sumo`
    - job completed successfully,
    - `candidate.engine_requested = "sumo"`
    - `candidate.engine_used = "sumo"`
    - no fallback reason was emitted in the live verification run,
    - `GET /api/health` still reported `engine_status = "running"` after the what-if completed.
- Environment note:
  - `python3 Traffic_Project_Simulation/scripts/start_live_simulation.py --help` failed on the system interpreter because `pyproj` is not installed there, but the project virtualenv launcher worked correctly and was used for the real verification run.

## 2026-05-06 UI Follow-Up - Explicit Simulation Options And Report Export

- Status: complete.
- Goal:
  - make the Simulation Lab show two explicit operator-selectable options instead of only descriptive text,
  - add export actions in Reports for `JSON` and `PDF`.
- Changes made:
  - Reworked the Simulation Lab engine selector into two real radio options:
    - `Quick Estimate`
    - `Detailed Digital Twin`
  - Kept the selected engine mirrored into the hidden `sim-engine` field so the existing request pipeline still posts the correct backend value.
  - Updated the Simulation Lab CSS so the two options render as distinct selectable cards, with a responsive fallback to one-per-row on smaller widths.
  - Bumped frontend asset versions in `index.html` so browsers fetch the updated CSS/JS instead of reusing stale cached files.
  - Added `Export JSON` and `Export PDF` buttons to the Reports toolbar.
  - Implemented direct browser downloads:
    - `JSON` exports the full rendered report payload.
    - `PDF` exports a generated printable report document from the current payload.
- Verification completed:
  - `node --check Traffic_Project_Simulation/app/index.js`
  - `node --check Traffic_Project_Simulation/app/reports.js`
  - `pytest Traffic_Project_Simulation/tests/e2e/test_replay_reports_ui.py -q`
  - Result: passed, 3 tests.
  - `pytest Traffic_Project_Simulation/tests/test_simulation_lab.py Traffic_Project_Simulation/tests/test_report_features.py Traffic_Project_Simulation/tests/e2e/test_replay_reports_ui.py -q`
  - Result: passed, 13 tests.
