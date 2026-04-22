# Time Sync Contract — AMM-WS-01 Traffic Data Sandbox

This document defines the canonical timeline and synchronization rules for all Phase 1 sandbox artifacts. Ensuring alignment across heterogeneous data sources is critical for Phase 2 ingestion and Phase 3 event logging.

---

## 1. Canonical Timeline
All timestamps in the sandbox package are aligned to a single "Canonical Day" to facilitate cross-source joining and signal-aware analysis.

| Parameter | Value |
|---|---|
| **Canonical Date** | `2026-04-21` (April 21, 2026) |
| **Timezone** | `UTC` |
| **Format** | `YYYY-MM-DD HH:MM:SS` (CSV/JSON) or `ISO 8601` (Manifests) |

## 2. Synchronization Rules

### A. Video & Stream Synchronization
- Video frames are mapped to the canonical timeline using the `stream_source_manifest.json`.
- The timestamp in the manifest (e.g., `2026-04-21T07:00:00Z`) represents the **zero-point** of the video file.
- All AI detections and incident overlays must be calculated as offsets from this start time.

### B. Detector & Signal Alignment
- Detector vehicle counts and Signal phase events share the exact same 24-hour canonical date.
- **Phase 2 Ingestion Rule**: To join detector data with signal states, the system must join on `timestamp` (for raw data) or `time_of_day` (for aggregated forecasting data).

### C. Drift Tolerance
- **Simulated Sync**: In this sandbox environment, drift is 0ms. Signal changes and detector counts are mathematically aligned to the same clock.
- **Phase 3 Requirement**: Real-world implementations must account for NTP drift and latency between the CCTV encoder and the Traffic Signal Controller (TSC).

---

## 3. Implementation Checklist for Phase 2
- [ ] Ingestion nodes must parse the `date` portion of the timestamp as `2026-04-21`.
- [ ] Forecast models must treat `is_weekday: 1` as consistent with the canonical date (Tuesday).
- [ ] Incident notifications must use the `2026-04-21` prefix for all event logging.

---

> **Honesty Note**: The canonical date is a synthetic reference used to glue representative video with simulated traffic logs. It does not imply that the video was physically recorded on that specific date.
