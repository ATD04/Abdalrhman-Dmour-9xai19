# Phase 2: Security & Operational Isolation Proof

This document provides technical proof that the "Crack-the-Code" Phase 2 build adheres to strict security and safety protocols.

## 1. Non-Intrusive, Read-Only Architecture
The system is designed as a **Decision Support System (DSS)**. It has no physical or logical path to modify the state of real-world traffic signal controllers.

- **Isolation Layer:** All signal intelligence is derived from local signal logs (`signal_timing_log.csv`).
- **One-Way Data Flow:** Data flows from raw logs -> normalization -> optimization script -> JSON artifact. No feedback loop exists to write back to the CSV or any simulated API controller.
- **Air-Gapped Recommendations:** The signal optimization output is a standalone file (`signal_recommendations.json`). It requires a human-in-the-loop to interpret and (in a future Phase 3) potentially authorize changes.

## 2. API Security Boundaries
The FastAPI backend (`main.py`) exposes only `GET` endpoints for Phase 2 data.
- **No Side Effects:** Every endpoint under `/api/v1/phase2/` is idempotent and restricted to read-only file access.
- **Data Encapsulation:** Intelligence scripts run as independent batch processes, preventing any live memory injection or cross-script interference.

## 3. Visual Separation of Truth
The dashboard enforces a strict visual distinction between:
- **Ground-Truth (CV):** Blue/Emerald boxes, direct from video frames.
- **External Context (Maps):** Purple charts, explicitly labeled as external trends.
- **Intelligence (Decision Support):** Labeled with "Decision Support Only" disclaimers.

## 4. Operational Safety Verification
Audit of `phase2_signal_optimization.py`:
- **Constraint Enforcement:** Recommendations are programmatically bound by `min_green_s` and `max_green_s` defined in `cycle_definitions.json`.
- **Fail-Safe:** If demand forecasts are missing or invalid, the script generates zero recommendations, preventing garbage-in-garbage-out (GIGO) suggestions.

---
**Verification Signature:**
- **Mode:** Decision Support
- **Control Status:** Read-Only
- **Safety Bounds:** Active (min/max green)
- **Protocol:** Phase 2 Compliance Confirmed.
