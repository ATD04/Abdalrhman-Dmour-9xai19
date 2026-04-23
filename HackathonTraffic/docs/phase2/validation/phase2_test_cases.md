# Phase 2: Technical Test Cases

The following test cases define the verification protocol for the Crack-the-Code build.

## TC-01: Modular Ingestion Integrity
- **Objective:** Verify that the Data Acquisition Layer correctly normalizes signal and demand logs.
- **Procedure:** Run `phase2_data_acquisition.py`. Check `normalized_demand.json`.
- **Expected:** ISO 8601 timestamps, consistent column names, zero parsing errors.
- **Status:** ✅ VERIFIED

## TC-02: Schema-Compliant Event Output
- **Objective:** Ensure incident detection outputs valid JSON matching the notification schema.
- **Procedure:** Inspect `event_notifications.json`.
- **Expected:** Contains `event_id`, `event_type`, `confidence_score`, and `severity`.
- **Status:** ✅ VERIFIED

## TC-03: Forecasting Baseline Improvement
- **Objective:** Prove that the chosen model outperforms the naive baseline.
- **Procedure:** Run `phase2_forecasting.py`. Review `forecasting_benchmarks.json`.
- **Expected:** Temporal Gradient MAE < Naive MAE.
- **Status:** ✅ VERIFIED

## TC-04: Recommendation Safety Constraints
- **Objective:** Confirm that signal recommendations respect min/max green times.
- **Procedure:** Inspect `signal_recommendations.json` against `cycle_definitions.json`.
- **Expected:** All suggested values are within defined bounds.
- **Status:** ✅ VERIFIED

## TC-05: Results Dashboard Synchronization
- **Objective:** Verify the Phase 2 Dashboard displays live benchmarks and health indicators.
- **Procedure:** Open Phase 2 Results Hub.
- **Expected:** Real-time visibility into faults, MAE charts, and incident alerts.
- **Status:** ✅ VERIFIED
