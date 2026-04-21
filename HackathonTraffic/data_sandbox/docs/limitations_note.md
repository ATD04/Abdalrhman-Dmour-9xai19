# Limitations Note — AMM-WS-01 Traffic Data Sandbox

This document transparently records the known limitations of the Phase 1 sandbox. These must be clearly understood before using this package in Phase 2 feasibility builds or Phase 3 integration.

---

## 1. Visual Source
- **Not a live feed**: The video environment is a representative file-replay source. It was not captured at the Wadi Saqra intersection.
- **Perspective mismatch**: Camera angle, field of view, and lighting may not precisely match actual site conditions.
- **No weather variation**: The video does not include rain, fog, or night-time footage.
- **Resolution of limitation**: This is acceptable for sandbox development. Phase 3 must replace or calibrate against actual site footage.

## 2. SUMO Simulation Accuracy
- **Demand is modeled, not observed**: Vehicle counts are generated using stochastic SUMO routing, not from real loop detector measurements at the site.
- **Signal plan is representative**: Phase durations are based on standard urban intersection design assumptions, not obtained from the municipality.
- **No pedestrian modeling**: The current simulation does not include pedestrian crossings, which could affect left-turn phase behavior in reality.
- **Resolution of limitation**: Data is labeled `SIMULATED_REPRESENTATIVE` throughout. Calibration against real counts must happen in Phase 3.

## 3. Ground-Truth Annotations
- **Sample-level only**: Vehicle-level bounding box annotations are provided for a subset of frames only, not the full video duration.
- **Event labels are synthetic**: Incident annotations (stalled vehicle, spillback) are defined against simulated data, not validated against real observed events.
- **Resolution of limitation**: Sufficient for Phase 2 precision/recall benchmarking. Phase 3 must augment with real labeled events.

## 4. Forecasting Dataset
- **24h extrapolated from 8h simulation**: The full 24-hour cycle was extended using demand factor profiles, not a second SUMO run.
- **Single day only**: There is no multi-day or multi-week historical dataset. Seasonal effects are not modeled.
- **Resolution of limitation**: Adequate for prototype model training. Phase 3 must acquire multi-day real counts for production model validation.

## 5. Metadata Coordinates
- **GPS coordinates are approximate**: Camera and detector positions were derived from OSM data and manual estimation, not GPS survey.
- **Pixel stop-line coordinates**: Defined against the representative video, not calibrated to the actual site camera geometry.

---

> All limitations are documented for transparency with hackathon evaluators. This sandbox is presented as a **synthetic but structured dataset** suitable for feasibility testing and AI module development.
