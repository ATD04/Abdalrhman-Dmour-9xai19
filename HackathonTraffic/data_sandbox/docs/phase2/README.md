# Phase 2 Build Overview — Traffic Intelligence Hackathon

This directory contains the professional implementation blueprints for Phase 2: **Technical Feasibility and De-risking**.

## 1. Purpose of Phase 2
Phase 2 shifts the project from a "Static Sandbox" (Phase 1) to a "Functional Prototype." The goal is not to build a finished product, but to prove that the core technical risks—real-time detection, signal-aware forecasting, and non-intrusive data ingestion—are solvable using the foundations laid in Phase 1.

Phase 2 acts as the critical bridge:
- **Phase 1 (Sandbox)**: Defined the data, schemas, and site environment.
- **Phase 2 (Feasibility)**: Builds the processing modules and proves they work against the sandbox.
- **Phase 3 (Integration)**: Deploys the modules into a production-ready system with real-world persistence.

## 2. Phase 1 to Phase 2 Handoff
The following Phase 1 artifacts are used directly as the "source of truth" for Phase 2 development:

| Artifact Type | Phase 1 Source | Phase 2 Application |
|---|---|---|
| **Stream Source** | `video/raw/video1.mp4` | Serves as the "Live" CCTV feed for the acquisition layer. |
| **Clip Manifest** | `video/manifests/clip_manifest.json` | Used for scenario-based validation of incident detection. |
| **Forecasting Set** | `detector/forecasting_ready/...` | Primary training/testing data for the demand model. |
| **Signal Logs** | `signals/logs/signal_timing_log.csv` | Input for signal-aware forecasting and optimization support. |
| **Metadata Pack** | `metadata/*.json` | Used to normalize pixel coordinates to cardinal approaches. |
| **Schemas** | `schemas/*.json` | Enforces the data contracts between new modules. |
| **Time Contract** | `docs/time_sync_contract.md` | Ensures all modules use the April 21, 2026 canonical date. |
| **Fault Samples** | `fault_samples/...` | Used to test the resilience of the ingestion pipeline. |

## 3. Core Objectives
- **Verify CV Performance**: Prove YOLOv8-based tracking meets benchmark precision on the Wadi Saqra site.
- **Validate Ingestion Stability**: Prove the Data Acquisition Layer can handle stream drops and corrupt logs.
- **Demonstrate Forecasting Accuracy**: Achieve <20% MAPE on 15-minute demand forecasts.
- **Ensure Isolation**: Maintain 100% read-only behavior relative to signal controllers.

---

### Phase 2 Documentation Map
- [**Build Plan**](phase2_build_plan.md): Execution strategy and build order.
- [**Architecture**](architecture_plan.md): System design and data flow.
- [**Data Acquisition**](data_acquisition_plan.md): Ingestion and normalization.
- [**Incident Detection**](incident_detection_plan.md): Vision pipeline and event logic.
- [**Forecasting**](forecasting_plan.md): Demand modeling.
- [**Optimization**](optimization_plan.md): Recommendation engine.
- [**Dashboard**](dashboard_plan.md): Operator interface.
- [**Security & Isolation**](security_isolation_plan.md): Safety protocols.
- [**Benchmarks**](benchmark_validation_plan.md): Measurement and testing.
- [**Risk Register**](risk_register.md): Mitigations.
- [**Deliverables**](deliverables_checklist.md): Acceptance checklist.
