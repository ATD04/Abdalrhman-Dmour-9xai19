# Baseline Video Count Note

This artifact serves as the observational ground truth for the Phase 1 Traffic Sandbox.

## Methodology
- **Source Material:** Primary drone video (`data_sandbox/video/raw/video1.mov`)
- **Extraction Engine:** YOLO26m (Medium) + ByteTrack
- **Duration Processed:** 1.85 minutes (4709 frames)
- **Total Unique Vehicles Tracked:** 1090

## Extracted Baseline Rates
| Approach | Vehicles Counted | Clip Duration (min) | Rate (veh/min) |
|----------|-----------------|---------------------|----------------|
| North | 53 | 1.85 | 28.64 |
| South | 364 | 1.85 | 196.66 |
| East | 248 | 1.85 | 133.99 |
| West | 425 | 1.85 | 229.62 |
