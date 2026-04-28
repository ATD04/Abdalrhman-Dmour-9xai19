# Methodology Note — Wadi Saqra Intelligent Traffic Light

## 1. Executive Summary

The Wadi Saqra Intelligent Traffic Light project leverages a hybrid data approach, combining real-world and synthetic data sources to build a robust, reproducible traffic intelligence system. The data pipeline integrates live Google Routes API feeds, SUMO microsimulation, YOLO26x video analytics, and ML-based forecasting, all normalized and validated for high reliability. This methodology ensures that the system can operate in both data-rich and data-sparse environments, supporting real-time decision-making and future scalability.

## 2. Traffic Data Sandbox Construction

The Traffic Data Sandbox was constructed to simulate a realistic urban intersection environment:
- **Video Stream Simulation**: Representative traffic footage was replayed using an RTSP-style wrapper, mimicking a live camera feed. This allowed for consistent testing and benchmarking of the video analytics pipeline.
- **Detector Dataset**: The Google Routes API provided live speed and delay data, which was mapped to a 22-detector structure representing all approaches and lanes at Wadi Saqra. This proxy approach enabled the emulation of loop detector counts in the absence of real hardware.
- **Signal Timing Dataset**: SUMO was used to generate a detailed signal phase event log, with each event mapped to the required timestamp, intersection, phase, and state format. This ensured alignment with the hackathon’s data requirements.
- **Historical Data**: Where available, historical Google API and SUMO simulation data were used to pre-train forecasting models and validate system performance.

## 3. Assumptions Made

- Single camera view covers the entire intersection.
- 15-minute aggregation resolution for forecasting and congestion events.
- 22-detector model accurately represents all approaches and lanes.
- All video is encoded in H.264 at 5–15 FPS.
- SUMO simulation step is 1 second.
- Google API polling interval is 30 seconds.
- All timestamps are UTC ISO8601.
- Confidence scores are floats in [0.0, 1.0].
- Congestion levels are encoded as 0–3 (free_flow to severe).
- The system is designed for local-only deployment (no cloud inference).
- These assumptions align with the hackathon spec except for the use of synthetic data, which was necessary due to the lack of live detector hardware.

## 4. Synthetic Data Justification

Synthetic and simulated data were used to ensure full coverage of rare and safety-critical events, such as wrong-way driving and queue spillback, which are difficult to capture in real-world footage. SUMO microsimulation was chosen for its ability to model realistic traffic dynamics and signal operations at the Wadi Saqra intersection. While synthetic data cannot capture all the variability of real detector exports, it provides a controlled environment for benchmarking and model training. The limitations of this approach are acknowledged, and the system is designed to seamlessly integrate real detector data as it becomes available.

## 5. Data Pipeline Summary

**Step-by-Step Flow:**
1. **Raw Input**: Video streams, Google API, SUMO simulation, and signal logs are ingested.
2. **Preprocessing**: Data is timestamped, normalized (units, labels), and validated.
3. **Analytics**: YOLO26x model processes video frames; SUMO provides simulation ground truth.
4. **Storage**: Events, forecasts, and health metrics are stored in SQLite and JSONL logs.
5. **API/Frontend**: Normalized data is served to the dashboard and operator interface.

**ASCII Diagram:**

Raw Data → [Preprocessing] → [Analytics/Simulation] → [Storage] → [API/Dashboard]

## 6. Reproducibility

To reproduce the full data pipeline from scratch:
- Set up the Python environment and install all dependencies from `requirements-live.txt`.
- Install SUMO and configure the binary paths in `config/live_config.json`.
- Obtain (optional) Google API credentials for live data.
- Run the video analytics build script to process footage.
- Run the forecasting and anomaly model training scripts.
- Start the live simulation server and access the dashboard at `localhost:3100`.

All steps except live Google API polling can be run fully offline using the provided sandbox datasets and SUMO simulation outputs.