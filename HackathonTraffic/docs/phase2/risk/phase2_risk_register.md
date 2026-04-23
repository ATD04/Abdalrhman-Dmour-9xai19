# Phase 2: Risk Register

This register identifies technical and operational risks associated with the Phase 2 build and the corresponding mitigation strategies.

| Risk ID | Description | Impact | Probability | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **R-CV-01** | False stall detection during heavy congestion. | Low (DSS only) | Medium | ROI masking filters out queue zones; 5s dwell-time buffer. |
| **R-FOR-01** | Model drift during non-typical events (holidays). | Medium | Low | Baseline benchmarking surfaces performance degradation in the HUD. |
| **R-SEC-01** | Unauthorized execution of signal recommendations. | High | Very Low | **Strict Isolation Proof:** No operational path to write timing changes to hardware. |
| **R-DAT-01** | Corruption of external signal timing logs. | Medium | Medium | Automated normalization contract and isolation logging (Invalid Record Log). |
| **R-SYS-01** | Browser memory leak during extended monitoring sessions. | Low | Low | `useRef` and `cancelAnimationFrame` based rendering optimization. |

## Risk Monitoring
The **Phase 2 Dashboard** surfaces real-time counts for `Faults` and `Dropped Frames`, serving as the primary early-warning system for the operator.
