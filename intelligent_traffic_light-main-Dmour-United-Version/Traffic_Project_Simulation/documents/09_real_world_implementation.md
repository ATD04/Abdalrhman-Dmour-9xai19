# 09 Real-World Implementation

## What Is Needed To Build The Real Project
This section describes what would be required to move from the simulation into a real deployed intersection intelligence system.

## 1) Camera And Field Hardware
### Camera Placement
You need at least one well-positioned camera that:
- clearly sees all major approaches
- covers the stop lines
- preserves enough detail for vehicle detection and tracking

Recommended camera characteristics:
- fixed mount
- 1080p or higher
- stable power and network
- low-light support
- predictable angle for calibration

### Supporting Field Elements
- stable pole or gantry mounting
- power backup if possible
- network connectivity
- secure cabinet or edge device housing

## 2) Video And Edge Processing
### Minimum Practical Stack
1. RTSP camera feed
2. Video ingest service
3. Inference service
4. Tracking service
5. Event and feature aggregation
6. Storage and replay layer

### Edge Device Options
- NVIDIA Jetson class hardware
- GPU workstation in a control room
- cloud GPU if bandwidth and privacy rules allow it

## 3) Model 1 / Detection And Tracking
### What To Build
1. vehicle detector
2. tracker
3. stopped-object logic
4. lane occupancy features

### Training Data Needed
1. local clips from Wadi Saqra
2. frame-level bounding boxes
3. class labels
4. incident examples under different lighting and congestion conditions

### Practical Advice
Start with a strong pretrained detector and fine-tune on local footage.
Do not try to build detection from scratch.

## 4) Model 2 / Insights And Event Detection
### Inputs
- object counts
- tracked trajectories
- stopped-object duration
- detector counts
- signal phase state

### Outputs
- congestion state
- queue spillback risk
- abnormal stopping detection
- stalled-vehicle alerts
- bottleneck reasoning

### Recommended Design
Use a hybrid approach:
1. rules for traffic engineering logic
2. anomaly model for edge cases
3. human-readable explanations for operator trust

## 5) Model 3 / Forecasting
### Inputs
- historical detector volumes
- recent visual counts
- signal timing context
- day-of-week and hour-of-day
- incident state flags

### Candidate Models
- XGBoost
- LSTM
- Temporal Fusion Transformer

### Practical Recommendation
Start with XGBoost or a strong tabular baseline first.
Only move to heavier sequence models if the baseline becomes a bottleneck.

## 6) Data Platform
### What Must Be Stored
- raw detector logs
- signal logs
- frame or clip references
- event alerts
- model outputs
- forecasts
- operator actions

### Suggested Services
- message queue or stream bus
- operational database
- time-series store
- object storage for clips
- API service for dashboard delivery

## 7) Dashboard Requirements
The dashboard should show:
1. live video
2. current detections
3. current signal phase
4. current traffic state
5. queue risk
6. alert list
7. short-horizon forecast
8. recommended operator action

## 8) Human Workflow
The system should not only predict.
It should support action.

Suggested workflow:
1. system flags abnormal traffic
2. operator validates the scene
3. operator records action
4. feedback is logged for model improvement

## 9) Team Needed
### Core Roles
- computer vision engineer
- data engineer
- traffic analytics engineer
- backend/platform engineer
- frontend/dashboard engineer
- project lead or product owner

### Helpful Additional Roles
- traffic domain expert
- MLOps engineer
- annotation/QA support

## 10) Delivery Phases
### Phase A / Sandbox and Concept
- build sandbox
- build simulation
- define architecture

### Phase B / Pilot Models
- collect labeled local video
- train first object detection pipeline
- align detectors, phases, and video

### Phase C / Operational Pilot
- run live inference
- validate alerts
- measure latency and accuracy
- improve forecast quality

### Phase D / Scale
- replicate to more intersections
- standardize metadata
- automate deployment

## 11) Risks
1. bad camera angle
2. poor nighttime visibility
3. weak field connectivity
4. inaccurate event labels
5. drift between video reality and detector signals
6. low operator trust if explanations are weak

## 12) My Strong Recommendation
Build this project as a layered system:
1. visual perception
2. traffic reasoning
3. forecasting
4. operator support

That gives the team the best balance between realism, explainability, and maintainability.
