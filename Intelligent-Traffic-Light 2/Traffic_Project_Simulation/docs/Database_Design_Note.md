# Phase 3: Database Structure and Design Note

## 1. Overview
The Phase 3 storage system is designed for high-frequency traffic data logging, auditability, and historical analysis. It uses a hybrid approach:
- **Relational (SQLite)**: For structured queries and reporting.
- **Flat-File (JSONL)**: For raw, immutable audit trails.

## 2. SQLite Schema Details

### Table: `events`
Logs detected incidents and operational anomalies.
- `id`: Primary Key (Integer)
- `timestamp`: ISO8601 (Text)
- `sim_time`: Simulation step (Float)
- `event_type`: (e.g., wrong_way, queue_spillback, abnormal_stopping)
- `severity`: (info, warning, critical)
- `direction`: Impacted approach
- `message`: Human-readable description
- `metadata`: JSON payload of raw evidence

### Table: `forecasts`
Stores multi-horizon traffic predictions.
- `id`: Primary Key (Integer)
- `timestamp`: ISO8601 (Text)
- `horizon_minutes`: 15, 30, or 60
- `direction`: Predicted approach
- `veh_per_hour`: Predicted flow rate
- `confidence`: Model confidence score (0-1)

### Table: `system_health`
Monitors the operational status of the stack.
- `id`: Primary Key (Integer)
- `timestamp`: ISO8601 (Text)
- `ingestion_rate_fps`: Live video processing speed
- `dropped_frames`: Count of skipped frames
- `uptime_s`: Seconds since process start
- `error_count`: Count of active API/System errors

## 3. Data Retention & Archiving
- **JSONL Logs**: Rotated daily (`logs/audit_YYYY-MM-DD.jsonl`).
- **Database**: Optimized for the latest 30 days of high-fidelity data.

## 4. Normalization
All timestamps are normalized to UTC ISO8601. All velocity units are stored in km/h, and distances in meters, following the handbook's standardization requirements.
