# Methodology Note: Phase 1 Sandbox Construction (Strengthened)

## 1. Ground Truth & Annotations
We have introduced a rigorous annotation layer in `data_sandbox/annotations/`. 
- **Incident Labels**: At least 5 high-impact events (stalls, congestion) have been manually indexed in `incidents.csv`.
- **Validation Windows**: `event_windows.csv` provides temporal segments (Normal, Peak, Recovery) to allow automated benchmarking of AI models in Phase 2.

## 2. Integrated Detector Mapping
Detector IDs in `detector_counts.csv` have been synchronized with the `lane_map.json`. Generic `DET-xx` names were replaced with lane-specific IDs (e.g., `L1-T1`). This allows the Data Acquisition Layer to map traffic volume to specific lanes organically without a translation layer.

## 3. Video Indexing Architecture
Due to environment constraints without `ffmpeg`, we utilize a **Logical Clip Manifest** (`video/clips/clip_manifest.json`). This indexes:
- Source files (Wadi Saqra samples).
- Millisecond/Second offsets for specific traffic conditions.
This system enables the `video_sim.py` and future computer vision pipelines to target specific historical scenarios programmatically.
