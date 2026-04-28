# Demo Walkthrough: Wadi Saqra Traffic Digital Twin

## 1. Start the Backend
- Open a terminal in the project root.
- Run: `./start_simulation.command` (macOS/Linux) or `start_simulation.bat` (Windows).
- Wait for the message: `Live dashboard available at http://127.0.0.1:3102`.

## 2. Open the Dashboard
- Open your browser and go to: http://127.0.0.1:3102

## 3. Key Features to Demonstrate

### A. Live Digital Twin Tab
- Real-time map with Google/SUMO overlay.
- Lane-level traffic, queue, and speed visualization.
- Signal timing and Webster optimizer panel.
- Multi-horizon (15/30/60 min) forecasts.
- System health indicators (FPS, dropped frames, uptime).

### B. Video Analytics Tab
- Video gallery of field recordings.
- Select a video to show AI overlays, object detection, and tracking.
- Scrub timeline to see event markers and incident detection.
- Show event log: highlight abnormal_stopping, queue_spillback, stalled_vehicle, wrong_way, crash.
- Show incident banner for high-severity events.

### C. Forecasting
- Show forecast KPIs and how they update with live data.
- Explain explicit holiday/peak-period indicators in forecast output.

### D. Signal Recommendations
- Show the "Decision Support" section and advisory-only recommendations.
- Emphasize "Advisory - Human Decision Support Only" label.

### E. System Health
- Point out health KPIs: FPS, dropped frames, uptime, error count.

### F. Read-Only/Advisory Behavior
- Explain that the system does not send commands to real controllers.
- All outputs are advisory for human decision support only.

## 4. End the Demo
- Stop the backend with Ctrl+C in the terminal.
- Optionally, show logs or database outputs for validation.
