# Data Dictionary: Traffic Data Sandbox (Updated)

This document describes the schema and contents of the datasets generated for the Phase 1 Traffic Data Sandbox.

## 1. Detector Counts (`detector/detector_counts.csv`)
Aggregated vehicle counts collected at 15-minute intervals. 

| Column | Type | Description |
| :--- | :--- | :--- |
| `timestamp` | DATETIME | The end-time of the 15-minute aggregation window (YYYY-MM-DD HH:MM:SS format). |
| `detector_id` | STRING | ID mapping directly to `lane_map.json` (e.g., L1-T1 for Approach 1, Through Lane 1). |
| `vehicle_count` | INTEGER | Total count of vehicles detected in the 15-minute window. |
| `occupancy_percentage` | FLOAT | Percentage of time the detector was occupied (0-100). |

## 2. Signal Timing Logs (`signals/signal_timing_log.csv`)
Event-based logs simulating real-time signal phase transitions.

| Column | Type | Description |
| :--- | :--- | :--- |
| `timestamp` | DATETIME | Precise event timestamp (YYYY-MM-DD HH:MM:SS.mmm). |
| `intersection_id` | STRING | ID of the intersection (AMM-WS-01). |
| `phase_number` | INTEGER | The signal phase number (1-4). |
| `signal_state` | STRING | The current state (GREEN ON, YELLOW ON, RED ON). |

## 3. Annotation Layer (`annotations/`)
- `incidents.csv`: Labeled traffic incidents (stalled vehicles, congestion) tied to video timestamps.
- `event_windows.csv`: Structured validation windows for benchmarking AI accuracy.

## 4. Metadata & Video
- `metadata/`: JSON files for intersection, lanes, and zones.
- `video/clips/clip_manifest.json`: Logical indexing of traffic conditions in sample videos.
