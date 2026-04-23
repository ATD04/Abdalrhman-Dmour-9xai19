# Phase 2 Monitoring & Fault-Handling Policy

## Ingestion Fault Tolerance
The Data Acquisition Layer enforces strict schema validation on all incoming telemetry:
- **Corrupted Records:** If a JSON payload or CSV row is malformed or missing required timestamps, the record is immediately dropped. The anomaly is logged to an internal `invalid_records_log.json` artifact for review.
- **Time Drift:** The system forces all incoming timestamps into an ISO8601 standard, aligning heterogeneous sources (e.g., matching signal logs with video streams).

## Dashboard System Health
The Phase 2 dashboard explicitly exposes system health indicators:
1. **Ingestion Status:** Online / Degraded / Offline.
2. **Dropped Frames:** Running tally of CV frames dropped due to processing latency.
3. **Stream Uptime:** Continuous operation counter.
4. **Invalid Records:** Number of discarded corrupted payloads, alerting operators to upstream sensor failures.
