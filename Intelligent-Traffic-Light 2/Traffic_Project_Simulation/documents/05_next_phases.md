# 05 Next Phases

## Phase 2
The next technical step is to move from simulation-ready model layering to real model execution.

### Recommended Phase 2 Work
1. Replace simulated Model 1 detections with real YOLO plus tracking inference.
2. Build baseline forecasting models for 15-minute demand by approach and direction.
3. Add engineered features:
   - lag windows
   - rolling means
   - day-of-week and hour-of-day context
   - signal-cycle context
   - object-count features from video
4. Add KPI evaluation:
   - MAE
   - RMSE
   - peak-period error tracking

## Phase 3
Phase 3 should connect visual AI, event logic, and recommendation logic.

### Recommended Phase 3 Work
1. Real incident detection from CCTV video.
2. Cross-validation between video events and detector anomalies.
3. Adaptive signal recommendation support.
4. Operator workflow actions and escalation states.
5. Archived replay with event review tools.

## What This Simulation Already Makes Easier
1. showing the end-state vision
2. validating UI ideas early
3. presenting the project as a system, not only as datasets
4. preparing integration logic before real live streams arrive
