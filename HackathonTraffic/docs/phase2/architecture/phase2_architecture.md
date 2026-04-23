# Phase 2 Architecture: Crack-the-Code Feasibility Build

This document outlines the architecture for Phase 2 of the Traffic Intelligence project. The goal of this phase is to prove the technical feasibility of the core intelligence modules using a modular, non-intrusive approach.

## 1. Core Objectives
- **Modularity:** Each intelligence component (Acquisition, Detection, Forecasting, Optimization) operates as an independent module.
- **Feasibility Proof:** Provide working "quick builds" that generate reviewable JSON artifacts matching predefined schemas.
- **Decision Support:** All outputs are strictly for human-in-the-loop decision support, ensuring zero operational risk.

## 2. Component Breakdown
| Module | Responsibility | Key Output |
| :--- | :--- | :--- |
| **Data Acquisition** | Normalization of stream and log data. | `normalized_demand.json` |
| **Incident Detection** | Real-time CV-based behavior analysis. | `event_notifications.json` |
| **Forecasting** | 15/30/60m demand prediction. | `forecast_outputs.json` |
| **Signal Optimization** | Structured green-time recommendations. | `signal_recommendations.json` |
| **Phase 2 Dashboard** | Presentation of results and benchmarks. | React Results Hub |

## 3. Storage & Artifact Strategy
All intermediate results are stored in `data_sandbox/detector/generated/phase2/` to allow for offline audit and validation by judges without requiring a live database.

## 4. Fault Handling
The system uses an **Isolation Log** strategy. If a record is corrupted or missing mandatory fields, it is captured in `invalid_records_log.json` to preserve system stability while providing visibility into data quality issues.

## 5. Monitoring
Real-time monitoring is implemented via a **System Health HUD** on the Phase 2 Dashboard, tracking ingestion uptime, dropped frames, and data-loss events.
