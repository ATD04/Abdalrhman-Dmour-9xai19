# Wadi Saqra Live Digital Twin

Follow these steps to run the interactive, real-time traffic simulation dashboard and the video analytics platform.

## Prerequisites
- **Python 3.9+** and macOS / Linux / Windows.
- Make sure you install the required packages:
  ```bash
  pip3 install -r requirements-live.txt
  pip3 install opencv-python ultralytics
  ```
- Make sure SUMO is installed and accessible via command line (`sumo` and `sumo-gui`).

## Step-by-Step Execution

### 1. Build the Video Analytics Dataset
This script processes the raw traffic videos and generates the detection overlays, frame rates, and events for the Video Analytics tab.
```bash
python3 scripts/build_video_analytics_dataset.py --force
```
*(Note: It uses YOLO11s. If your Mac supports MPS, hardware acceleration is enabled to process the videos quickly.)*

### 2. Start the Live Simulation Server
Run the main server to serve the digital twin dashboard, simulation engine, and SUMO integration:
```bash
python3 scripts/start_live_simulation.py --open
```
*By default, the server runs on `http://127.0.0.1:3101` and will automatically open in your web browser.*

### 3. Access the Dashboard
If the browser doesn't open automatically, navigate to:
[http://127.0.0.1:3101](http://127.0.0.1:3101)

You will see two Unified Tabs:
- **Live Digital Twin**: Displays SUMO vehicles mapped with live Google Maps API traffic.
- **Video Analytics**: Displays the recorded footage with precise, synchronized YOLO capabilities and live event alerts (UI pops-up over the dashboard).

---

## Alternative Start Method
You can quickly run the project using the helper scripts in the root directory:
**On Mac/Linux:**
```bash
./start_simulation.command
```
**On Windows:**
```cmd
start_simulation.bat
```
