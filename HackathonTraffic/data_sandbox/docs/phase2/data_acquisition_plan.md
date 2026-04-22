# Data Acquisition Layer (DAL) Plan — Phase 2

The DAL is the gateway between the raw sandbox artifacts and the intelligence modules. It ensures all downstream processes receive clean, synchronized, and normalized data.

---

## 1. Input Requirements (Phase 1 Artifacts)
The DAL will ingest:
- **Video**: `video/raw/video1.mp4` (representative stream).
- **Detector Logs**: `detector/raw_sumo_output.csv` (1-min counts).
- **Signal Logs**: `signals/logs/signal_timing_log.csv` (event-based phase changes).
- **Fault Samples**: `fault_samples/` (for testing resilience).

---

## 2. Core Build Tasks

### **Task A: Video Stream Emulator**
- **Action**: Build a Python module that reads `video1.mp4` using OpenCV and "emulates" a live RTSP stream.
- **Goal**: Provide frames to the Incident Detection module at a steady 30 FPS.
- **Metadata Sync**: Attach the `timestamp_start` from `stream_source_manifest.json` to the first frame.

### **Task B: Multi-Source Normalizer**
- **Action**: Implement a synchronization buffer that joins Signal and Detector logs based on the **Time Sync Contract**.
- **Normalization**: 
    - Map raw detector IDs (e.g., `L1-T1`) to cardinal approaches (e.g., `Approach_North_Through`) using `approach_map.json`.
    - Convert SUMO signal states (`GREEN ON`) to standard Boolean flags (`is_green: true`).
- **Timestamping**: Ensure all outgoing data packets use ISO 8601 UTC timestamps.

### **Task C: Resilience & Fault Handling**
- **Action**: Use Phase 1 `fault_samples` to verify the DAL's behavior when:
    - A detector record is missing (Interpolate or flag as `NULL`).
    - A signal event is out of sequence (Apply last-known-good state).
    - The video stream drops (Wait and attempt reconnection).

---

## 3. Data Interface (Output)
The DAL will expose internal streams/APIs for other modules:
- `/dal/stream/frames`: Raw frame buffer for CV.
- `/dal/stream/traffic`: Normalized 1-minute vehicle counts.
- `/dal/stream/signals`: Current active signal phase and state.

---

## 4. Expected Performance
- **Latency**: <100ms from raw file read to normalized output.
- **Sync Accuracy**: <50ms jitter between video frames and signal state packets.
- **Resilience**: 0 crashes when processing `sample_corrupted_log.csv`.
