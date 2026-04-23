# Phase 2: Monitoring & Fault Handling Protocol

This document defines how the system maintains resilience and reports its internal state.

## 1. Health Monitoring HUD
The dashboard surfaces four critical health indicators:
- **Ingestion Status:** Tracks connectivity to the data acquisition backend.
- **Stream Uptime:** Cumulative runtime of the visual intelligence pipeline.
- **Dropped Frames:** Real-time counter of frames skipped by the rendering engine to maintain 30FPS performance.
- **Invalid Record Count:** Cumulative count of corrupted logs isolated from the normalized stream.

## 2. Fault Handling Strategies

### A. Data Corruption (Record Level)
- **Detection:** Schema validation and timestamp parsing checks in `phase2_data_acquisition.py`.
- **Handling:** Corrupted records are logged to `invalid_records_log.json` and skipped. The pipeline does not terminate.
- **Reporting:** Surfaced as "Faults" in the System Health HUD.

### B. Visual Intelligence Lag
- **Detection:** Browser-side draw-time monitoring.
- **Handling:** The UI automatically throttles the overlay rendering (skipping frames) to ensure the video playback remains smooth.
- **Reporting:** Surfaced as "Dropped Frames" in the HUD.

### C. Backend API Disconnection
- **Detection:** Fetch failure in React `useEffect`.
- **Handling:** UI enters a "Degraded" state; Existing data persists in memory; Automatic reconnection attempts every 5 seconds.
- **Reporting:** Status changes to "OFFLINE" with a red visual indicator.

## 3. Audit Logging
Every Phase 2 script generates a summary output upon completion:
- `normalized_demand.json`: Success audit for traffic data.
- `event_notifications.json`: Success audit for incident detection.
- `forecasting_benchmarks.json`: Success audit for model performance.
- `signal_recommendations.json`: Success audit for optimization support.
