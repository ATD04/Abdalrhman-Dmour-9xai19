# Risk Register and Mitigation — Phase 2

This document identifies potential technical hurdles in Phase 2 and provides pre-emptive mitigation strategies.

---

## 1. Technical Risks

| Risk | Impact | Probability | Mitigation Strategy |
|---|---|---|---|
| **Timestamp Drift** | High | Medium | Enforce strict adherence to the **Time Sync Contract**. DAL must inject the canonical date into all frames. |
| **Low Detection Precision** | High | Low | Use `roi_masks.json` to reduce false positives. Focus on YOLOv8m (Medium) instead of Nano. |
| **Forecasting Overfitting** | Medium | Medium | Use k-fold cross-validation on the `demand_forecast_source.csv`. Avoid overly complex neural networks; prefer XGBoost for small data. |
| **Stream Latency** | Medium | Low | Use `multiprocessing` for the IDM module to keep the CV pipeline separate from the API server. |
| **Inconsistent BBox Mapping** | High | Medium | Verify coordinate normalization (0.0 to 1.0) against `spatial_annotations.json` before building the full IDM. |

---

## 2. Integration Risks
- **Data Format Changes**: A module developer might change the JSON output structure.
    - **Mitigation**: All modules must validate their output against the Phase 1 `schemas/` before sending.
- **Resource Exhaustion**: Real-time CV and forecasting running on the same machine might cause crashes.
    - **Mitigation**: Implement a "Lightweight Mode" for the IDM that skips every 2nd frame if CPU usage > 90%.

---

## 3. Scope Risks
- **Attempting Phase 3 Early**: Trying to build real signal controller integration too early.
    - **Mitigation**: Strictly follow the "Recommendation-Only" policy in `optimization_plan.md`.

---

## 4. Monitoring
The **Dashboard Quick Build** will include a "Risk Panel" that flags when system parameters (latency, CPU, memory) exceed the mitigation thresholds.
