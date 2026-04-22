# Data Dictionary — AMM-WS-01 Traffic Data Sandbox v2.0

This document is the single authoritative reference for all datasets, schemas, and outputs in the sandbox package.

---

## 1. Detector Data

### `detector/raw_sumo_output.csv`
Raw 1-minute vehicle counts from the SUMO simulation.

| Field | Type | Description |
|---|---|---|
| `timestamp` | DATETIME | End of 1-minute window (YYYY-MM-DD HH:MM:SS) |
| `detector_id` | STRING | Maps to `approach_map.json` |
| `vehicle_count` | INTEGER | Total vehicles in the window |

### `detector/forecasting_ready/demand_forecast_source.csv`
**Official forecasting-ready dataset. Primary input for Phase 2 demand forecasting models.**

| Field | Type | Description |
|---|---|---|
| `timestamp` | DATETIME | End of 15-min window (2026-04-21 HH:MM:SS) |
| `date` | DATE | Calendar date |
| `time_of_day` | STRING | HH:MM — useful for periodic feature encoding |
| `detector_id` | STRING | Maps to `approach_map.json` |
| `vehicle_count` | INTEGER | **Target variable** — vehicles in the 15-min window |
| `is_weekday` | BINARY | 1 = weekday, 0 = weekend |
| `is_holiday` | BINARY | 1 = public holiday |
| `peak_hour_flag` | BINARY | 1 = within AM peak (07–09) or PM peak (16–19) |

See `detector/forecasting_ready/feature_definitions.json` for recommended derived features.

---

## 2. Signal Timing Data

### `signals/logs/signal_timing_log.csv`
Event-based log of traffic signal phase transitions.

| Field | Type | Description |
|---|---|---|
| `timestamp` | DATETIME | Precise event time (2026-04-21 HH:MM:SS.mmm) |
| `intersection_id` | STRING | Always `AMM-WS-01` |
| `phase_number` | INTEGER | Phase 1–4 (maps to `phase_movement_map.json`) |
| `signal_state` | STRING | `GREEN_ON`, `YELLOW_ON`, or `RED_ON` |

See `metadata/cycle_definitions.json` for phase timing assumptions and `metadata/phase_movement_map.json` for lane mappings.

---

## 3. Video & Stream Data

### `video/manifests/stream_source_manifest.json`
Formal registration of all simulated stream sources. Ingestion modules must reference this file for camera IDs, FPS, and source paths.

### `video/manifests/clip_manifest.json`
Logical index of video clips organized by traffic condition and intended use (training / validation / demo).

| Field | Type | Description |
|---|---|---|
| `clip_id` | STRING | Unique ID (e.g., `CLB-001`) |
| `label` | STRING | Scenario label (e.g., `peak_am_01`) |
| `source_video` | STRING | Path relative to `video/` |
| `start_time` / `end_time` | STRING | HH:MM:SS window |
| `traffic_condition` | STRING | Condition type |
| `expected_events` | ARRAY | Events the detector should flag |
| `intended_use` | STRING | `training`, `validation`, or `demo` |

---

## 4. Metadata Pack

| File | Purpose |
|---|---|
| `intersection_metadata.json` | GPS, camera specs, general site profile |
| `lane_map.json` | Lane-level type definitions (Through, Turn) |
| `approach_map.json` | Cardinal approaches → lane IDs → detector IDs |
| `camera_registry.json` | Camera IDs, mounting heights, orientations |
| `roi_masks.json` | AI monitoring zones (pixel polygons) |
| `stop_lines.json` | Pixel coordinates of stop lines per lane |
| `phase_movement_map.json` | Phase numbers → movements → lanes |
| `cycle_definitions.json` | Green/amber durations, optimization bounds |
| `zones.json` | Queue spillback assessment zones |

---

## 5. Annotations

| File | Purpose |
|---|---|
| `ground_truth_detection/vehicle_labels_sample.json` | Vehicle-level bounding box subset for detection validation |
| `event_validation/incidents.csv` | Labeled traffic incidents with timestamps |
| `event_validation/event_windows.csv` | Validation windows for precision/recall benchmarking |
| `event_validation/queue_spillback_events.csv` | Queue spillback event labels |
| `spatial_annotations.json` | Persistent tracking bounding boxes from YOLO batch run |
| `benchmark_seed.json` | Target thresholds for Phase 2 benchmarking |

---

## 6. Schema Contracts

| File | Covers |
|---|---|
| `schemas/detector_log_schema.json` | Detector ingestion input |
| `schemas/signal_log_schema.json` | Signal timing ingestion input |
| `schemas/detection_output_schema.json` | Phase 2 detection module output |
| `schemas/forecast_output_schema.json` | Phase 2 forecasting module output |
| `schemas/event_notification_schema.json` | Incident alert format (storage-ready) |

---

## 7. Fault Samples

| File | Fault Type |
|---|---|
| `fault_samples/corrupted_detector_logs/sample_corrupted_log.csv` | Invalid IDs, negative counts, missing values |
| `fault_samples/video_missing_frames/fault_manifest.json` | Simulated frame dropout windows |
