# Isolation Note — AMM-WS-01 Traffic Data Sandbox

This document confirms the operational isolation design of the sandbox environment.

---

## 1. System Boundary

The sandbox operates entirely within a self-contained local or containerized environment. It has **no connection** to:
- The Amman traffic signal control network
- Any municipality ITS (Intelligent Transport Systems) infrastructure
- Live CCTV streams from the Wadi Saqra site or any other operational site
- Any upstream operational database or data warehouse

## 2. Read-Only Behavior

| Layer | Behavior |
|---|---|
| Video Source | File replay only. No write-back. |
| Detector Logs | Pre-generated CSV files. No live ingestion. |
| Signal Timing | Pre-generated event logs. No controller commands. |
| Metadata | Static JSON files. Read-only reference. |
| AI Outputs | Written to local sandbox only. Not forwarded to any operational system. |

## 3. Decision Support Only

All outputs produced by Phase 2 modules (detections, alerts, recommendations) connected to this sandbox are strictly for:
- Research and development
- Hackathon demonstration
- Human review and evaluation

**No automated control signals, commands, or instructions are generated or sent to any physical infrastructure.**

## 4. Security Model (Aligned with Requirement 7.7)

- Access is restricted to authorized team members
- No credentials to operational systems are stored in this repository
- The sandbox viewer API (FastAPI) is localhost-only by default
- Sandbox data does not contain personally identifiable information

---

> Figure B alignment: This sandbox sits strictly in the "Intelligence Build" zone. It receives no write access and has no feedback loops into the "Operational Traffic Control" zone.
