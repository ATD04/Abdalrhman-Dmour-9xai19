# Traffic Data Sandbox — Data Dictionary

This document defines the schema and data provenance for the synthetic Phase 1 Traffic Sandbox datasets. 

## 1. Traffic Detector Dataset (`detector/generated/traffic_detector_dataset.csv`)

This dataset represents a synthetic 2-week history of 15-minute vehicle counts at the Wadi Saqra intersection.

**Provenance / Generation Methodology:**
- **Baseline Observation:** Vehicle count rates (veh/min) were extracted programmatically using YOLO26m multi-object tracking on the primary drone video (`video1.mov`).
- **Scaling Mechanism:** Relative congestion ratios (derived from standard urban weekday/weekend curves) were applied to scale the baseline count across all hours of a 2-week period.
- **Realism Noise:** A Gaussian noise function (std dev = 8%) was applied to all calculated counts to prevent artificial uniformity.

### Schema:

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | String (YYYY-MM-DD HH:MM) | The start time of the 15-minute aggregation interval. |
| `intersection_id` | String | Unique identifier for the intersection (`INT_001`). |
| `approach` | String | The compass direction the traffic is coming from (North, South, East, West). |
| `detector_id` | String | The unique ID of the virtual detector loop (e.g., `DET_N_01`). |
| `vehicle_count` | Integer | Total number of vehicles detected entering the intersection from this approach during the 15-minute interval. |
| `day_type` | String | Classifies the day profile (`Weekday`, `Saturday`, `Sunday_holiday`). |

---

## 2. Signal Timing Log (`signals/logs/signal_timing_log.csv`)

This is a synthetic supporting artifact defining the assumed traffic light phase changes over time. It is generated independently of the detector methodology based on standard pre-timed cycle assumptions.

### Schema:

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | String (YYYY-MM-DD HH:MM:SS) | Exact time of the signal state change. |
| `intersection_id` | String | Unique identifier for the intersection (`INT_001`). |
| `phase_number` | Integer | The active movement phase (e.g., Phase 1 = N/S Through). |
| `signal_state` | String | State of the signal (`Green`, `Yellow`, `Red`). |

---

## 3. Incident Annotations (`annotations/event_validation/incidents.csv`)

A separate manual annotation layer highlighting specific anomalous events within the video or the historical logs for validation testing.

### Schema:

| Field | Type | Description |
|-------|------|-------------|
| `event_id` | String | Unique identifier for the incident. |
| `event_type` | String | Type of incident (e.g., `Congestion`, `Stalled Vehicle`). |
| `start_time` | String (HH:MM:SS) | Relative start time of the incident in the video or log. |
| `end_time` | String (HH:MM:SS) | Relative end time of the incident. |
| `notes` | String | Contextual notes about the event. |
