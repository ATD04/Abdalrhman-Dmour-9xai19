# 07 Solution Blueprint

## Objective
Build a realistic traffic intelligence stack for Wadi Saqra where:
1. CCTV video is processed by a vehicle detection model.
2. The extracted object-level signals are converted into traffic insights.
3. The resulting time-series is used for short-horizon forecasting and operator support.

## Recommended Product Shape
### Model 1 / Object Detection and Tracking
Purpose:
- detect vehicles in each camera frame
- classify them
- track them across time
- identify stopped-vehicle candidates

Recommended production choice:
- YOLOv8 or YOLO11
- ByteTrack or BoT-SORT for tracking

Outputs:
- bounding boxes
- class labels
- track IDs
- frame-level counts
- occupancy proxy
- stopped-object candidates

### Model 2 / Insights and Event Detection
Purpose:
- read Model 1 outputs together with detector data and signal state
- detect congestion, abnormal stopping, queue spillback, and blockage patterns
- produce human-readable explanations and recommended actions

Outputs:
- anomaly score
- dominant direction
- bottleneck reason
- event labels
- recommended actions

### Model 3 / Time-Series Forecasting
Purpose:
- forecast near-future traffic demand
- help operators act before a queue becomes critical

Outputs:
- next 15-minute traffic volume
- next 30-minute traffic volume
- next 45-minute traffic volume
- trend label
- confidence score

## Data Flow
1. CCTV stream enters Model 1.
2. Model 1 produces object-level detections and tracks.
3. Detector counts and signal logs are aligned to the same timeline.
4. Model 2 transforms the fused data into insights and event signals.
5. Model 3 uses the recent traffic state plus historical traffic history to forecast future demand.
6. Dashboard displays the current state, alerts, and predicted next state.

## System Modules
1. Video ingestion
2. Detection and tracking
3. Signal and detector alignment
4. Insight generation
5. Forecasting
6. Dashboard and alerting
7. Storage and replay

## Why This Architecture Is Good
1. It separates visual perception from traffic reasoning.
2. It allows the forecasting model to work on structured signals rather than raw pixels.
3. It is easier to debug than a single monolithic model.
4. It can scale across multiple intersections.

## What The Current Simulation Already Demonstrates
1. Model 1 outputs displayed as YOLO-style boxes on video.
2. Model 2 outputs displayed as anomaly score, bottleneck explanation, and operator recommendations.
3. Model 3 outputs displayed as next 15/30/45 minute forecasts.

## Team Discussion Structure
Use this sequence in the team meeting:
1. What is each model responsible for?
2. What data does each model need?
3. What outputs does each model create?
4. Which outputs become dashboard metrics?
5. Which outputs become alerts?
6. Which outputs become forecasting features?

## Suggested Deliverables By Workstream
### Computer Vision
- camera calibration
- vehicle detection
- vehicle tracking
- event candidates

### Traffic Analytics
- detector cleaning
- queue logic
- anomaly features
- forecasting features

### Platform
- stream ingestion
- storage
- APIs
- dashboard

### Operations
- alert rules
- event validation workflow
- response playbooks
- KPI acceptance criteria
