# Government Delivery Feature Integration Plan

## Summary

- Integrate the specs in `new_features` by adapting them to the current SUMO + Python HTTP server + static JS + local Ollama stack.
- No feature is complete until existing regressions are fixed, touched-area tests pass, full regression passes, and the project can be launched from the documented run paths.
- Maintain a live implementation log at `Traffic_Project_Simulation/documents/15_feature_implementation_log.md` and update it immediately after each accepted feature.

## Execution Rules

- Gate 0 before feature work: make `scripts/` importable in direct, module, and test contexts; restore launcher compatibility; and fix current failing backend/frontend tests.
- Canonical run path after Gate 0: both one-click launchers and the module-safe command must start the server entrypoint.
- Implementation order: forecast extension, zone-calibration hardening, YOLOv8 incident pipeline, replay backend + Replay tab, report backend + Reports tab, full regression and delivery evidence.
- After each feature: append feature name, summary, files changed, API/schema changes, tests run, pass/fail, open blockers, and next safe resume point to the implementation log.
- After final regression: record exact commands and outcomes in `documents/test_execution_report.md`.

## Public Interfaces And Behavior Changes

- Add two tabs: `Replay` after `Analytics`, and `Reports` after `Replay`.
- Add `GET /api/replay`: read-only chronological replay buffer, oldest-first, with enriched snapshot fields for timeline, deltas, per-direction table, and markers.
- Add `POST /api/report/generate` and `GET /api/report/latest`; report sections are `status`, `approaches`, `incidents`, `forecasts`, `actions`, and `health`, plus minimal metadata.
- Extend `GET /api/flow-forecast` without replacing the current GBM/seasonal-naive forecaster. Add 60-minute support and report-ready recommendation/spillback fields.
- Keep `/api/zones` as the single zone calibration contract; harden validation and frontend controls instead of adding a parallel incompatible endpoint.
- Extend live-video diagnostics to expose incident-detector health and incident events for replay, reports, and system diagnostics.

## Key Changes

- Forecast feature: keep current GBM forecaster, add 60-minute support, forecast snapshot persistence, richer metadata, recommendation fields, and spillback risk.
- Zone calibration: harden the existing editor with reset/default/export behavior, stricter validation, clearer global/video scope handling, and safe live reload semantics.
- YOLOv8 incident detection: add a second optional detector for crash/fire incidents. It is disabled when weights are unavailable and uses temporal confirmation before emitting incidents.
- Replay feature: enrich the history buffer and expose a read-only Replay tab with scrubber, marker filter, play/pause, KPI tiles, per-direction table, and before/after deltas.
- Report feature: build a deterministic local collector first, use local Ollama only for optional narrative/action phrasing, validate JSON strictly, and fall back to rule-based output when the model is unavailable.
- Frontend structure: add dedicated modules for Replay and Reports to avoid further growing the main `index.js` file.

## Test Plan

- Gate 0 baseline: `pytest -q Traffic_Project_Simulation/tests` and Playwright smoke tests must be green before feature work is marked started.
- Forecast tests: 5/15/30/60 horizons, no negative predictions, bound ordering, recommendation/spillback classification, endpoint contract, and backtests.
- Zone tests: invalid shape rejection, line-vs-polygon handling, CRUD round trip, live reload behavior, direction mapping, and frontend save/delete/reset/export smoke.
- Incident tests: mocked YOLOv8 post-processing, temporal confirmation, dedupe, direction mapping, state merge, alert routing, and degraded behavior when weights or dependencies are unavailable.
- Replay tests: endpoint schema/order, marker generation, cursor clamping, delta math, play/pause/filter navigation, and frontend smoke.
- Report tests: schema validation, deterministic fallback, invalid-JSON fallback, action ordering, API contract, raw JSON viewer, and tab smoke.
- Final regression: launcher works, direct module launch works, core APIs respond, and all feature-specific plus existing suites finish green.

## Assumptions And Defaults

- `Replay Timeline - Portable Feature Spec.md` and its `(1)` copy are duplicates and implemented once.
- Smart adaptation is locked in: Streamlit, Claude, Prophet, and foreign path references from the feature specs are treated as intent when they conflict with this project.
- The implementation must not leave the repository in a partially added but unstable state. If a feature cannot reach green tests, stop at the last stable checkpoint and record the blocker in the log.
