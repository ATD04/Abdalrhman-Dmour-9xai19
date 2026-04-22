# Signal Optimization Support (SOS) Plan — Phase 2

The SOS module is the decision-support engine. It does **not** control signals directly but provides actionable recommendations to operators to improve flow and mitigate incidents.

---

## 1. Input Requirements (Phase 1 Artifacts)
- **Geometry**: `phase_movement_map.json` and `lane_map.json`.
- **Timing**: `cycle_definitions.json` (defines min/max green bounds).
- **Intelligence**: Real-time events from IDM and demand forecasts from TFF.

---

## 2. Core Build Tasks

### **Task A: Rule-Based Recommendation Engine**
- **Action**: Implement a logic layer that suggests timing changes based on current and future demand.
- **Examples**:
    - **Extend Green**: If IDM detects a "High Discharge Rate" and TFF predicts a 15-min volume surge, recommend +10s to the current green phase (staying within `max_green` limits).
    - **Phase Skipping (Future Ready)**: If a specific movement (e.g., Left Turn North) has 0 detected occupancy for 2 cycles, recommend skipping or shortening the phase.
    - **Pre-emptive Congestion Mitigation**: If TFF predicts a "Peak Transition" in 15 minutes, recommend increasing the `cycle_length` to 140s.

### **Task B: Constraint Enforcement**
- **Action**: Ensure all recommendations stay within the safe bounds defined in `cycle_definitions.json`.
- **Safety**: A recommendation must never violate `min_green` (pedestrian safety) or `amber_clearance` (collision avoidance).

### **Task C: Optimization API**
- **Action**: Expose an endpoint that returns a list of active recommendations for the site.
- **Format**: Include `recommendation_id`, `phase_affected`, `action` (INCREASE/DECREASE), `value`, and `justification` (e.g., "Anticipated PM Peak surge").

---

## 3. Recommendation Logic Summary
| Trigger | Logic | Recommendation |
|---|---|---|
| **Incident (Stalled)** | Detection in through lane | **Reduce Green** (divert flow) |
| **Forecast (Surge)** | Demand > 120% of current | **Increase Cycle Length** |
| **Empty Approach** | 0 vehicles detected | **Shorten Phase** (early cutoff) |

---

## 4. Phase 2 Scope Restriction
**IMPORTANT**: In Phase 2, this module is **Recommendation-Only**. No physical integration with a signal controller (TSC) should be attempted. The success of this module is measured by the *logical validity* of its suggestions compared to the site metadata.
