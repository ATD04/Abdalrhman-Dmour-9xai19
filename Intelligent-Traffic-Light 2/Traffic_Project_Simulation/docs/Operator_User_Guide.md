# Operator User Guide: Wadi Saqra Traffic Digital Twin

## Dashboard Sections
- **Live Digital Twin**: Map, traffic, queue, speed, signals, forecasts, health.
- **Video Analytics**: Video gallery, AI overlays, event log, incident alerts.

## Alert Types
- **Abnormal Stop**: Vehicle stopped unexpectedly.
- **Queue/Spillback**: Lane queue exceeds threshold.
- **Stalled Vehicle**: Vehicle stopped for extended period (possible breakdown).
- **Wrong Way**: Vehicle moving against allowed direction.
- **Crash/Incident**: Detected collision or major event.

## How to Interpret Forecasts
- 15/30/60 min demand forecasts shown in dashboard.
- Peak/holiday indicators shown in forecast output.
- Use for planning signal timing and operator response.

## Signal Recommendations
- "Decision Support" section shows green/cycle adjustments.
- All recommendations are labeled: "Advisory - Human Decision Support Only".
- Operators must verify before acting.

## System Health Indicators
- FPS: Video processing speed.
- Dropped Frames: Data loss or camera/network issue.
- Uptime: System running time.
- Error Count: Any detected errors.

## Read-Only/Advisory Behavior
- The system does NOT control real signals.
- All outputs are for operator decision support only.
- No commands are sent to field controllers.
