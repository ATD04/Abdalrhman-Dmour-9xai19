# Real-Time Incident Detection (RTID) Plan — Phase 2

This module provides the "Visual Intelligence" for the Wadi Saqra site. It transforms raw pixels from the DAL into structured event notifications.

---

## 1. Input Requirements (Phase 1 Artifacts)
- **Source**: Frames from the DAL (emulated `video1.mp4`).
- **Context**: `roi_masks.json` and `stop_lines.json` to define monitoring zones.
- **Validation**: `clip_manifest.json` and `incidents.csv` for ground truth comparison.

---

## 2. Core Build Tasks

### **Task A: Detection & Tracking Pipeline**
- **Action**: Implement **YOLOv8-Medium** for multi-class vehicle detection (Car, Bus, Truck, Motorcycle).
- **Tracking**: Integrate **ByteTrack** to maintain unique vehicle IDs across frames.
- **ROI Filtering**: Apply `roi_masks.json` to ignore detections outside the roadway (e.g., in building windows or far background).

### **Task B: Heuristic Incident Logic**
Implement specialized detection logic for Phase 2:
1.  **Stalled Vehicle**: Identify a vehicle ID that remains stationary (`velocity < 2km/h`) within a "Through" lane for >30 seconds while the signal is Green.
2.  **Queue Spillback**: Monitor the `Z4-QUE` zone in `zones.json`. If vehicle occupancy in this zone exceeds 80% for >2 cycles, trigger a spillback alert.
3.  **Unexpected Trajectory**: Detect vehicles performing illegal movements (e.g., U-turns from a "Through Only" lane) by comparing their tracking path against `lane_map.json`.

### **Task C: Event Notification Generation**
- **Action**: When an incident is confirmed, produce a JSON object following `event_notification_schema.json`.
- **Content**: Include `event_type`, `location_id`, `confidence`, and a `snapshot_path`.

---

## 3. Validation Strategy
- **Benchmark**: Run the IDM against the "Validation" clips in `clip_manifest.json`.
- **Metrics**: 
    - **Precision**: How many detected incidents were real?
    - **Recall**: How many incidents from `incidents.csv` did we miss?
    - **Latency**: Processing time per frame (Target: <33ms for 30 FPS).

---

## 4. Implementation Logic (Feasibility Build)
For the Phase 2 quick build, focus on **robust tracking** first. If tracking is stable, incident logic becomes a simple "time-in-zone" or "trajectory-check" calculation.
