# Module Interaction Logic (Phase 2)

This document defines the interface and dependencies between the Phase 2 modules.

## 1. Data Acquisition -> Intelligence Modules
- **Interface:** JSON Artifacts in `data_sandbox/detector/generated/phase2/`.
- **Contract:** Intelligence modules must poll or wait for the completion of the Acquisition Layer.
- **Dependency:** `normalized_demand.json` is the primary source for Forecasting and Incident Detection.

## 2. Forecasting -> Signal Optimization
- **Interface:** `forecast_outputs.json`.
- **Logic:** The Optimization module reads predicted volumes for the next 15-60 minutes to calculate green-time adjustments.
- **Safety:** If forecasting confidence is below 70%, Optimization must flag recommendations as "Low Confidence - Manual Review Required".

## 3. Incident Detection -> Phase 2 Dashboard
- **Interface:** `event_notifications.json` + `livestream_intelligence.json`.
- **Logic:** The dashboard merges historical validated incidents (Phase 1) with real-time detections (Phase 2) to provide a unified incident timeline.

## 4. Monitoring -> Dashboard
- **Interface:** Backend `/api/v1/phase2/system-health`.
- **Logic:** Tracks file existence, record counts, and ingestion uptime to populate the Health HUD.

## 5. Storage / Logging Touchpoints
- **Primary:** `data_sandbox/detector/generated/phase2/`
- **Secondary:** `backend/logs/` (Standard output from scripts)
- **Visual Snapshot:** `data_sandbox/video/snapshots/` (Linked from event notifications)
