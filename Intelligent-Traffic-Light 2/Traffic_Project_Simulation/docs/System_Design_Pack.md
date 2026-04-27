# Phase 3: First-Site Full Stack Intelligence Build — System Design Pack

## 1. System Overview
The Wadi Saqra Traffic Digital Twin (Phase 3) is a comprehensive, real-time traffic monitoring and forecasting system. It fuses live Google Routes corridor data with a high-fidelity SUMO simulation and video analytics to provide predictive insights for the Wadi Saqra intersection in Amman, Jordan.

## 2. Core Architecture
The system follows a modular, layer-based architecture:
- **Data Acquisition Layer**: Ingests video streams, Google Traffic API data, and signal timing logs. Performs timestamp standardization and unit conversion.
- **Intelligence Layer (Digital Twin)**: A SUMO-based simulation engine that runs a real-time parallel model of the intersection.
- **Forecasting Module**: Uses historical and real-time data to predict traffic demand 15, 30, and 60 minutes ahead.
- **Incident Detection Engine**: Monitors for wrong-way driving, abnormal stopping, queue spillback, and stalled vehicles.
- **Storage & Logging Layer**: Persists events, health metrics, and forecasts to a relational SQLite database and auditable JSONL logs.
- **Operator Interface**: A bilingual (English/Arabic) dashboard providing real-time visualization and decision support.

## 3. Data Flow
1. **Ingestion**: `stream_processor.py` (Video) + `CompositeDataSource` (Google/Fallback).
2. **Refining**: `acquisition.py` normalizes units and timestamps.
3. **Simulation**: `sumo_traci_runner.py` updates the digital twin state.
4. **Analysis**: `flow_forecaster.py` generates multi-horizon predictions.
5. **Output**: `storage_manager.py` logs data; SSE server pushes live state to the `Dashboard`.

## 4. Key Design Decisions
- **Isolated Intelligence**: The system is strictly read-only and isolated from control hardware, ensuring zero operational risk.
- **Webster-Based Recommendations**: Signal timing optimizations are labeled as "Advisory Only" for human decision support.
- **Bilingual Interface**: Full support for English and Arabic to cater to local operators in Amman.
- **Resilient Ingestion**: Exponential backoff and automatic reconnection logic for all data streams.

## 5. Security & Isolation
- **Read-Only TraCI**: The simulation engine reads state but does not issue `SET_PHASE` or `SET_SPEED` commands to field devices.
- **Local Storage**: Data is stored locally in SQLite/JSONL for maximum auditability without external cloud dependencies.
