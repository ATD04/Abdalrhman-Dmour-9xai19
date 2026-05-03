# Implementation Plan
## AI-Based Traffic Monitoring and Traffic Flow Forecasting

---

## System Overview

5-module pipeline running end-to-end:

```
[Video/Detector/Signal Input]
         ↓
[Data Acquisition Layer]        ← ingest, normalize, buffer
         ↓
[Incident Detection Module]     ← YOLO + tracker → events
[Forecasting Module]            ← LSTM/XGBoost → traffic predictions
         ↓
[Storage + Logging Layer]       ← PostgreSQL + logs
         ↓
[React Dashboard]               ← live view, alerts, forecasts
```

---

## Phase 1 — Build the Fake Dataset

No live cameras — simulate everything.

### 1. Fake video stream (CCTV simulation)
- Download traffic intersection footage from YouTube or use datasets like [UA-DETRAC](https://detrac-db.rit.albany.edu/) or [CityFlow](https://www.aicitychallenge.org/).
- Serve it as an RTSP stream using FFmpeg:
  ```bash
  ffmpeg -re -i traffic.mp4 -f rtsp rtsp://localhost:8554/stream
  ```
- Use [MediaMTX](https://github.com/bluenviron/mediamtx) as the RTSP server.

### 2. Fake detector count data (CSV)
- Generate synthetic 15-min vehicle count CSVs in Python using `pandas` + `numpy` with realistic rush-hour patterns.

### 3. Fake signal timing logs (CSV)
- Generate rows like: `timestamp, intersection_id, phase, state` (GREEN/YELLOW/RED) simulating a realistic signal cycle.

### 4. Annotations
- Use [CVAT](https://github.com/cvat-ai/cvat) (free, self-hosted) to label vehicles and incidents in video clips.

---

## Phase 2 — Quick Builds (Prove Each Module Works in Isolation)

### Module A: Data Acquisition (Python)
```
video stream → OpenCV frame reader → frame queue
detector CSV → pandas reader → normalized dataframe
signal CSV  → pandas reader → normalized dataframe
```
Key code: `cv2.VideoCapture("rtsp://...")` loop that reads frames and puts them on a `queue.Queue`.

### Module B: Incident Detection
- Use [YOLOv8](https://github.com/ultralytics/ultralytics):
  ```bash
  pip install ultralytics
  ```
  ```python
  from ultralytics import YOLO
  model = YOLO("yolov8n.pt")  # pretrained, no training needed initially
  results = model(frame)
  ```
- Add [ByteTrack](https://github.com/ifzhang/ByteTrack) or use YOLOv8's built-in tracker for multi-object tracking.
- Detect incidents with rules: vehicle stopped > 10s in a zone = stalled vehicle event.

### Module C: Traffic Forecasting
- Use detector CSV as input. Train with `XGBoost` or `LightGBM` (simpler than LSTM, often better on tabular traffic data).
- Input features: `[vehicle_count_t-4, t-3, t-2, t-1, hour_of_day, day_of_week, signal_phase]`
- Output: `vehicle_count_t+1` (15 min ahead), repeat for 30 min and 1 hr.

### Module D: Storage
PostgreSQL with 3 tables to start:
- `events(id, timestamp, event_type, location, confidence, clip_path)`
- `detector_readings(id, timestamp, detector_id, approach, count)`
- `forecasts(id, created_at, horizon_minutes, predicted_count, approach_id)`

### Module E: Dashboard
- React + [Recharts](https://recharts.org/) for charts.
- [Socket.IO](https://socket.io/) for real-time updates.
- FastAPI (Python) backend exposing REST endpoints.

---

## Phase 3 — Full Integration

### Folder Structure
```
project/
├── acquisition/       # stream reader, CSV ingestion
├── detection/         # YOLO + tracker + event rules
├── forecasting/       # model training + inference
├── storage/           # DB models, write helpers
├── api/               # FastAPI routes
├── dashboard/         # React frontend
├── data/              # sandbox data (video, CSVs)
└── docker-compose.yml # spin everything up
```

Pass frames from acquisition → detection via Kafka (or `queue.Queue` for simplicity).  
Run forecasting every 15 minutes via `APScheduler` or cron.

---

## Suggested Build Order

| Step | What to do | Tools |
|------|-----------|-------|
| 1 | Generate fake detector + signal CSVs | Python, pandas |
| 2 | Set up RTSP stream from video file | FFmpeg + MediaMTX |
| 3 | Read frames with OpenCV, run YOLOv8 | Python, ultralytics |
| 4 | Add ByteTrack, write stall-detection rule | ByteTrack |
| 5 | Train XGBoost forecaster on detector CSV | XGBoost |
| 6 | Set up PostgreSQL + write events/forecasts | psycopg2 / SQLAlchemy |
| 7 | Build FastAPI backend with 3-4 endpoints | FastAPI |
| 8 | Build React dashboard consuming the API | React, Recharts |
| 9 | Wrap everything in docker-compose | Docker |

---

## Stack — Install First

```bash
pip install ultralytics opencv-python fastapi uvicorn sqlalchemy psycopg2-binary xgboost pandas numpy
```
