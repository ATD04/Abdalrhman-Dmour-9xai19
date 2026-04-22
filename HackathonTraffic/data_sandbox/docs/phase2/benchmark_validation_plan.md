# Benchmark, Validation, and Testing Plan — Phase 2

This plan defines how we measure the success of the Phase 2 build. Performance data collected here will be the core of the final Phase 2 Benchmark Report.

---

## 1. Primary Benchmarks

### **A. CV Detection Performance (Precision/Recall)**
- **Source**: Use the "Validation" clips in `clip_manifest.json`.
- **Target**: 
    - Vehicle Detection Precision: >85%
    - Incident Recall (stalled vehicles): >80%
    - Tracking ID Stability: <5 switches per 60s clip.

### **B. Forecasting Accuracy (MAPE)**
- **Source**: Compare TFF 15-min predictions against the "Actuals" in `demand_forecast_source.csv`.
- **Target**: MAPE < 15% (Normal) / < 25% (Peak).

### **C. System Latency**
- **Action**: Measure time from frame capture to Dashboard rendering.
- **Target**: End-to-End Latency < 250ms.

---

## 2. Validation Test Cases

| ID | Module | Test Scenario | Expected Result |
|---|---|---|---|
| **TC-01** | DAL | Ingest `sample_corrupted_log.csv` | System flags invalid rows but continues processing valid ones. |
| **TC-02** | IDM | Process `congestion_01` clip | Queue spillback alert triggered within 10s of threshold breach. |
| **TC-03** | TFF | Predict next 15-min volume | Forecast error is within +/- 15% of the Phase 1 historical average. |
| **TC-04** | SOS | Detect stalled vehicle in L1 | Recommendation "Shorten Phase 1" appears in the console. |
| **TC-05** | DASH | Simulate stream disconnect | Dashboard shows "CONNECTION LOST" and displays last-known-good signal state. |

---

## 3. Tools for Validation
- **Phase 1 Benchmark Seed**: Use the targets in `benchmark_seed.json` as the baseline.
- **Verification Scripts**: Use `backend/tests/verify_time_sync.py` and new `test_idm_precision.py` scripts.
- **Manual Audit**: Operator review of the "Aha!" moments captured during the demo.

---

## 4. Deliverable
The result of this plan is the **Phase 2 Benchmark Report**, which will be included in the final submission to the hackathon judges.
