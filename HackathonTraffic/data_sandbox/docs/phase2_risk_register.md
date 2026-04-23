# Phase 2: Risk Register & Mitigation Strategy

This register identifies technical risks associated with the Phase 2 Traffic Intelligence pipeline and the corresponding mitigation measures implemented.

| Risk ID | Risk Description | Impact | Probability | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **R-CV-01** | Tracking ID switching or loss due to occlusion. | Incorrect vehicle counts and false stall incidents. | Medium | **Implemented:** Calibrated trip-line logic requires entry crossing; Stall logic uses spatial ROI masking and 5s dwell-time buffer to filter transients. |
| **R-DATA-01** | Corruption or timestamp jitter in external signal logs. | Misalignment between visual behavior and signal state analysis. | Medium | **Implemented:** Strict timestamp normalization in Acquisition Layer with invalid-record isolation log. |
| **R-FOR-01** | Model drift or poor forecasting performance during non-typical events. | Unreliable green-time recommendations. | Low | **Implemented:** Benchmarking against Naive and Moving Average baselines to detect degradation; Confidence score reporting in HUD. |
| **R-SEC-01** | Accidental injection of operational control logic. | Safety risk; Unauthorized signal timing changes. | Low | **Implemented:** Strict read-only architecture; Recommendations output as isolated JSON artifacts for human review only. |
| **R-SYS-01** | High browser CPU/Memory usage due to real-time overlays. | Dashboard lag or crash during demo. | Low | **Implemented:** Canvas-based rendering (vs SVG DOM); 30FPS throttling; `useRef` based memory management. |

## Risk Monitoring
The "System Health" HUD on the dashboard provides real-time visibility into **R-DATA-01** (Invalid Record Count) and **R-SYS-01** (Dropped Frames). Significant spikes in these metrics trigger visual alerts for the operator.
