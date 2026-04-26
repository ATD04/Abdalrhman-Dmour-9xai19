# 01 Project Scope

## Goal
This simulation package demonstrates how the Wadi Saqra sandbox can be presented as a working Phase 1 traffic intelligence product rather than a static collection of CSV files.

## What The Simulation Covers
1. A local operator dashboard.
2. CCTV-style visual feed using the available source video.
3. YOLO-style object detection overlay.
4. Traffic playback based on real sandbox detector data.
5. Signal-phase-aware operational context.
6. Incident and congestion alert simulation.
7. Short-horizon forecast simulation.
8. Scenario switching for demo storytelling.

## Why This Exists
The sandbox already contains data, metadata, signal logs, and annotations.
What was missing was a realistic simulation layer that shows:
- how the project looks in operation
- how the data becomes an operator-facing system
- how the three-model concept fits together
- how the Phase 1 deliverables connect to later phases

## Inputs Used
1. `Traffic_Data_Sandbox/detector_data/`
2. `Traffic_Data_Sandbox/signal_logs/`
3. `Traffic_Data_Sandbox/metadata/`
4. `Traffic_Data_Sandbox/annotations/`
5. `Traffic_Data_Sandbox/live_stream/`

## Deliverable Outcome
This folder turns the sandbox into a demo-ready package with:
- a running dashboard
- a local API
- scenario presets
- model-stack representation
- explainability documents

## Practical Demo Value
This is not just a visualization.
It is a Phase 1 simulation of the full intended solution:
- sensing
- object detection
- insights generation
- forecasting
- context fusion
- dashboarding
- alerting
- operator guidance
