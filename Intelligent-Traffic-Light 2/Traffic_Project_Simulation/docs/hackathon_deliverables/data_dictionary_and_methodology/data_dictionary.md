# Data Dictionary — Wadi Saqra Intelligent Traffic Light

## Section 1: Data Sources Overview

| Source Name                | Type         | Update Frequency | Format   | Role in System                        | Normalization Applied                |
|---------------------------|--------------|------------------|----------|---------------------------------------|--------------------------------------|
| Google Routes / Traffic API| External API | 30s              | JSON     | Live traffic speeds, delays           | UTC ISO8601, km/h, approach mapping  |
| SUMO Microsimulation      | Simulation   | 1s               | CSV/JSON | Simulated vehicle states, queues      | UTC ISO8601, m, km/h, lane mapping   |
| YOLO26x Video Analytics   | Model Output | 5–15 FPS         | JSON     | Vehicle detections, tracking events   | UTC ISO8601, bbox px, confidence     |
| Signal Timing Logs        | Log File     | 1s               | CSV      | Phase state events                    | UTC ISO8601, phase/state mapping     |
| ML Forecasting Outputs    | Model Output | 15/30/60 min     | JSON     | Traffic flow predictions              | UTC ISO8601, veh/15min, approach     |
| Anomaly Detection Outputs | Model Output | 1s–15min         | JSON     | Anomaly scores, event classifications | UTC ISO8601, score, event type       |
| System Health Metrics     | Internal     | 1s               | JSON     | Ingestion rate, dropped frames, uptime| UTC ISO8601, FPS, count, seconds     |

## Section 2: Field-Level Dictionary

### events (SQLite table)
| Field Name   | Data Type | Unit   | Description                                 | Example Value         | Nullable | Notes                       |
|--------------|-----------|--------|---------------------------------------------|----------------------|----------|-----------------------------|
| id           | Integer   | —      | Primary key                                 | 1                    | No       | Auto-increment              |
| timestamp    | Text      | UTC    | Event timestamp (ISO8601)                   | 2024-03-01T07:12:15Z | No       |                             |
| sim_time     | Float     | s      | Simulation step                             | 123.0                | No       |                             |
| event_type   | Text      | —      | Event type (see annotation schema)          | wrong_way_driving    | No       |                             |
| severity     | Text      | —      | info, warning, critical                     | critical             | No       |                             |
| direction    | Text      | —      | Impacted approach label                     | N-in                 | No       |                             |
| message      | Text      | —      | Human-readable description                  | "Vehicle stopped..." | No       |                             |
| metadata     | JSON      | —      | Raw evidence payload                        | {"track_id": 4}     | Yes      |                             |

### forecasts (SQLite table)
| Field Name      | Data Type | Unit      | Description                        | Example Value | Nullable | Notes |
|-----------------|-----------|-----------|------------------------------------|---------------|----------|-------|
| id              | Integer   | —         | Primary key                        | 1             | No       |       |
| timestamp       | Text      | UTC       | Forecast timestamp (ISO8601)       | 2024-03-01T07:15:00Z | No |   |
| horizon_minutes | Integer   | min       | Prediction horizon                 | 15            | No       | 15/30/60 |
| direction       | Text      | —         | Approach label                     | N-in          | No       |       |
| veh_per_hour    | Float     | veh/h     | Predicted flow rate                | 420.5         | No       |       |
| confidence      | Float     | 0–1       | Model confidence score             | 0.91          | No       |       |

### system_health (SQLite table)
| Field Name      | Data Type | Unit   | Description                        | Example Value | Nullable | Notes |
|-----------------|-----------|--------|------------------------------------|---------------|----------|-------|
| id              | Integer   | —      | Primary key                        | 1             | No       |       |
| timestamp       | Text      | UTC    | Health check timestamp (ISO8601)   | 2024-03-01T07:12:15Z | No |   |
| ingestion_rate_fps | Float  | FPS    | Video processing speed             | 12.3          | No       |       |
| dropped_frames  | Integer   | count  | Skipped frames                     | 2             | No       |       |
| uptime_s        | Integer   | s      | Seconds since process start        | 3600           | No      |       |
| error_count     | Integer   | count  | Active API/system errors           | 0             | No       |       |

### JSONL Audit Trail Fields
| Field Name   | Data Type | Unit   | Description                        | Example Value | Nullable | Notes |
|--------------|-----------|--------|------------------------------------|---------------|----------|-------|
| timestamp    | Text      | UTC    | Event timestamp (ISO8601)          | 2024-03-01T07:12:15Z | No |   |
| event_type   | Text      | —      | Event type                         | queue_spillback | No    |   |
| payload      | JSON      | —      | Event details                      | { ... }        | No       |   |

### API Response Fields
#### /api/live-state
| Field Name   | Data Type | Unit   | Description                        | Example Value | Nullable | Notes |
|--------------|-----------|--------|------------------------------------|---------------|----------|-------|
| timestamp    | Text      | UTC    | State timestamp (ISO8601)          | 2024-03-01T07:12:15Z | No |   |
| approaches   | JSON      | —      | Per-approach state                 | { ... }        | No       |   |
| signals      | JSON      | —      | Signal phase states                | { ... }        | No       |   |
| queues       | JSON      | m      | Queue lengths per approach         | { ... }        | No       |   |
| speeds       | JSON      | km/h   | Speeds per approach                | { ... }        | No       |   |

#### /api/flow-forecast
| Field Name      | Data Type | Unit   | Description                        | Example Value | Nullable | Notes |
|-----------------|-----------|--------|------------------------------------|---------------|----------|-------|
| timestamp       | Text      | UTC    | Forecast timestamp (ISO8601)       | 2024-03-01T07:15:00Z | No |   |
| horizon_minutes | Integer   | min    | Prediction horizon                 | 15            | No       |   |
| direction       | Text      | —      | Approach label                     | N-in          | No       |   |
| veh_per_hour    | Float     | veh/h  | Predicted flow rate                | 420.5         | No       |   |
| confidence      | Float     | 0–1    | Model confidence score             | 0.91          | No       |   |

#### /api/anomaly
| Field Name   | Data Type | Unit   | Description                        | Example Value | Nullable | Notes |
|--------------|-----------|--------|------------------------------------|---------------|----------|-------|
| timestamp    | Text      | UTC    | Anomaly detection timestamp        | 2024-03-01T07:12:15Z | No |   |
| event_type   | Text      | —      | Detected anomaly type              | sudden_congestion | No |   |
| score        | Float     | 0–1    | Anomaly score                      | 0.82          | No       |   |

#### /api/emissions
| Field Name   | Data Type | Unit   | Description                        | Example Value | Nullable | Notes |
|--------------|-----------|--------|------------------------------------|---------------|----------|-------|
| timestamp    | Text      | UTC    | Emissions summary timestamp        | 2024-03-01T07:12:15Z | No |   |
| co2_grams    | Float     | g      | CO₂ emissions                      | 120.5         | No       |   |
| nox_grams    | Float     | g      | NOₓ emissions                      | 2.1           | No       |   |
| fuel_liters  | Float     | L      | Fuel consumption                   | 0.45          | No       |   |

## Section 3: Normalization Rules

- **Timestamps**: All timestamps are standardized to UTC ISO8601 (YYYY-MM-DDTHH:MM:SS.sssZ).
- **Velocity**: All speeds are converted to km/h.
- **Distance**: All queue lengths and distances are in meters.
- **Camera ID Mapping**: Camera IDs use a site-approach convention (e.g., WadiSaqra-N-in).
- **Detector ID Naming**: Detectors are named as detector_01, detector_02, ...
- **Approach/Lane Labels**: N-in, N-out, S-in, S-out, E-in, E-out, W-in, W-out.
- **Confidence Scores**: All model confidence scores are floats in [0.0, 1.0].
- **Congestion Levels**: Encoded as 0=free_flow, 1=mild, 2=moderate, 3=severe.

## Section 4: Data Quality Rules

- **Missing Frames**: If a video frame is missing, the system skips it and logs the event.
- **Corrupted Packets**: Corrupted video or data packets are discarded; the system attempts auto-recovery.
- **Out-of-Range Detector Values**: Values outside physical limits are replaced with null and flagged.
- **Stream Reconnection**: On stream failure, the system retries every 5–10 seconds with exponential backoff.
- **Invalid Timestamps**: Timestamps outside the expected range are ignored and logged.
- **Duplicate Events**: Events with identical timestamps and payloads are deduplicated at ingestion.