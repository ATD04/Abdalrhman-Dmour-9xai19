# AMM-WS-01 Traffic Data Sandbox — Phase 1 Package

**Site**: Wadi Saqra Signals, Amman, Jordan  
**Phase**: 1 — Traffic Data Sandbox Build  
**Status**: Complete — Phase-2-Ready and Phase-3-Ready Foundation  
**Data Nature**: Synthetic but structured. Representative simulation only. Not connected to operational infrastructure.

---

## What This Sandbox Is

This package is the **primary deliverable of Phase 1**. It provides a clean, structured, and reusable traffic data environment for developing, testing, and validating AI-based traffic monitoring and forecasting modules.

It is **not** a finished product. It is the data foundation that Phase 2 (feasibility builds) and Phase 3 (full integration) will build on top of.

---

## Package Contents

| Directory | Contents |
|---|---|
| `video/` | Representative video source, clip manifest, stream manifest |
| `detector/` | Raw SUMO output + 24h/15min forecasting-ready dataset |
| `signals/logs/` | Signal phase event log |
| `metadata/` | Full integration map (cameras, lanes, approaches, ROIs, phases) |
| `annotations/` | Vehicle labels + event validation + benchmark seed |
| `schemas/` | Input/output contracts for all major modules |
| `fault_samples/` | Bad-data cases for ingestion validation |
| `simulation/sumo/` | Source SUMO network, routes, config, and raw outputs |
| `docs/` | Methodology, dictionary, naming conventions, policies |

---

## Key Reference Documents

| Document | Purpose |
|---|---|
| `docs/methodology_note.md` | How the sandbox was built |
| `docs/data_dictionary.md` | Field-level reference for all datasets |
| `docs/naming_conventions.md` | ID schema for cameras, detectors, lanes, events |
| `docs/setup_usage.md` | How to run and use the sandbox |
| `docs/source_assumptions.md` | What is real vs. simulated |
| `docs/limitations_note.md` | Known gaps for honest evaluation |
| `docs/isolation_note.md` | Proof of read-only, non-intrusive design |
| `docs/read_only_policy.md` | Security and operational isolation policy |

---

## Supporting Tools (Secondary)

The following tools are included as **internal preview and testing utilities only**. They are not the Phase 1 deliverable.

| Tool | Role |
|---|---|
| `backend/` (FastAPI) | Sandbox Viewer API — serves files for local preview |
| `frontend/` (React) | Sandbox Monitor UI — visualizes data during development |

See `docs/setup_usage.md` for how to start these tools.

---

## Phase Readiness

| Phase 2 Module | Ready? |
|---|---|
| Data Acquisition | ✅ Stream manifest + detector schemas |
| Incident Detection | ✅ Ground-truth annotations + benchmark seed |
| Forecasting | ✅ 24h/15min dataset + feature definitions |
| Signal Optimization | ✅ Phase-movement map + cycle definitions |
| Dashboard | ✅ Sandbox viewer tools available |
| Fault Handling | ✅ Fault samples for ingestion testing |

| Phase 3 Need | Ready? |
|---|---|
| Storage Layer | ✅ Output schemas are database-ready |
| Event Logging | ✅ Event notification schema defined |
| Reproducibility | ✅ SUMO config + normalization scripts |
| Handover | ✅ Data dictionary + naming conventions |
| Security Proof | ✅ Isolation note + read-only policy |
