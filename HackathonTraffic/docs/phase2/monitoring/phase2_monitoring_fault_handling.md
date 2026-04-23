# Phase 2: Monitoring & Fault Handling Protocol

This document defines the monitoring strategy and recovery procedures for the Phase 2 build.

## 1. System Health HUD
The Phase 2 Results Hub surfaces four critical health indicators:
- **Ingestion Status:** Verified connectivity to normalized data artifacts.
- **Stream Uptime:** Cumulative runtime of the intelligence dashboard.
- **Dropped Frames:** Real-time count of frames skipped by the rendering engine to maintain 30FPS UI performance.
- **Fault Count:** Cumulative count of corrupted or invalid records isolated from the input stream.

## 2. Fault Handling Procedures

### Scenario A: Invalid Data Record
- **Detection:** Timestamp parsing failure or missing mandatory fields in the Acquisition Layer.
- **Handling:** Record is appended to `invalid_records_log.json`. The pipeline continues processing subsequent valid records.
- **Resolution:** Review the isolation log to identify recurring source issues.

### Scenario B: Intelligence Lag
- **Detection:** Latency between frame capture and detection overlay exceeding 100ms.
- **Handling:** Browser throttles overlay rendering; System Health HUD increments `Dropped Frames`.
- **Resolution:** Reduce dashboard panel count or simplify CV bounding box transparency.

### Scenario C: Backend API Disconnection
- **Detection:** Fetch failure in React dashboard.
- **Handling:** UI enters "Offline" mode; Retains last cached data for presentation.
- **Resolution:** Restart the FastAPI backend (`uvicorn app.main:app`).

## 3. Logging Strategy
Each intelligence script generates a summary output upon completion, providing an audit trail of:
- Number of processed records.
- Number of detected events.
- Success/Failure status for artifact generation.
