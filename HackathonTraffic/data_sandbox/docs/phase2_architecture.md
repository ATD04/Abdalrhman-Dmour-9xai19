# Phase 2 Architecture & Feasibility Build

## Core Objective
The Phase 2 architecture proves that the hardest parts of the "AI-Based Traffic Monitoring and Traffic Flow Forecasting" pipeline are technically feasible before full Phase 3 integration. This is an explicit "Crack-the-Code" feasibility build grounded in the real Phase 1 dataset.

## System Components
1. **Data Acquisition Layer:** Standardizes heterogeneous raw inputs (video telemetry, SUMO-derived baseline counts, signal event logs) into normalized, fault-tolerant streams.
2. **Real-Time Incident Detection Engine:** A video-grounded CV pipeline (YOLO26m + ByteTrack) executing zone-masked logic to detect queue spillback and abnormal stalling, producing strictly structured Event Notifications.
3. **Traffic Flow Forecasting Module:** Analyzes normalized historical demands to produce 15/30/60m prediction horizons via baseline/moving average models, proving predictive viability.
4. **Signal Optimization Support:** A deterministic rule-engine correlating demand forecasts with existing cycle definitions and phase mappings to generate structured adjustment recommendations.
5. **Dashboard Quick Build (React):** A unified Dual-Source visualization layer isolating external Google route context from the localized localized CV truth, while surfacing new forecasting and health metrics.

## Data Flow
`Raw Video & Logs` -> `Data Acquisition Layer` -> `Normalization` -> `Forecasting / Incident Detection` -> `Optimization Support` -> `Dashboard UI`.
