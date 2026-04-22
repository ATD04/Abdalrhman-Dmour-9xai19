# Dashboard Quick Build Plan — Phase 2

The Phase 2 dashboard is the central visualization hub for the Technical Feasibility build. It upgrades the Phase 1 viewer into a functional operator interface.

---

## 1. Reuse from Phase 1
The Phase 2 dashboard will leverage the following existing frontend assets:
- **UI Framework**: React + Vite + Tailwind CSS.
- **Components**: `TrafficChart`, `DigitalTwinSignalHUD`, and `SVGOverlay`.
- **Styling**: The existing "Glassmorphism" dark theme and professional color palette.

---

## 2. Core Build Tasks

### **Task A: Live Intelligence Integration**
- **Action**: Replace the static Phase 1 data fetches with a WebSocket or high-frequency polling connection to the DAL, IDM, and FM.
- **Overlays**: Enhance the `SVGOverlay` to show:
    - Bounding boxes with **Speed Labels**.
    - Color-coded boxes based on **Vehicle Class**.
    - **Incident Highlights** (e.g., a flashing red box around a stalled vehicle).

### **Task B: Predictive Visualization**
- **Action**: Add a "Forecasting" pane that shows the TFF model's prediction vs. actual historical trends.
- **UI**: Use a dotted-line extension on the traffic flow charts to represent the next 60 minutes of predicted volume.

### **Task C: Recommendation Console**
- **Action**: Create a new panel to display active signal recommendations from the SOS module.
- **Interactivity**: Allow the user to "Dismiss" or "Acknowledge" recommendations (simulating operator action).

### **Task D: System Health Monitor**
- **Action**: Add a telemetry dashboard showing:
    - CPU/Memory usage of the IDM (Edge compute simulation).
    - Stream FPS and Dropped Frame count.
    - Data ingestion latency.

---

## 3. Screen Layout Strategy
- **Primary View (Center)**: Real-time video with AI intelligence overlays.
- **Secondary View (Left)**: Incident Feed and Signal Recommendation List.
- **Analytics View (Bottom)**: Multi-horizon traffic flow charts (Historical vs. Forecast).
- **Control View (Right)**: System health and site parameters (GPS, Camera orientation).

---

## 4. Expected User Experience
The dashboard should feel like a "Control Center." Every piece of data (video, signals, forecasts) must be perfectly synchronized according to the **Time Sync Contract**.
