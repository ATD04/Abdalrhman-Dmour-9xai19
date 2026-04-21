# Source and Implementation Assumptions

This document explicitly lists the assumptions and limitations of the AMM-WS-01 Traffic Data Sandbox.

### 1. Visual Source Representativeness
The visual source (video/frames) provided in this sandbox is **representative**. It is used to simulate the perspective, focal length, and mounting height of a CCTV camera at the Wadi Saqra intersection. It is NOT a live stream of the site.

### 2. Microscopic Simulation (SUMO)
Traffic counts, signal phases, and vehicle trajectories are generated using **Eclipse SUMO**. 
- **Assumption**: The simulation reflects typical peak and off-peak patterns for the Amman metropolitan area.
- **Limitation**: Real-world factors such as weather, road incidents, or pedestrian interference are partially modeled as stochastic noise and may not reflect specific historical dates.

### 3. Timestamp Alignment
All datasets (detectors, signals, and video) have been normalized to a shared UTC timestamp to facilitate ingestion and multi-modal analysis.

### 4. Hardware Abstraction
The system assumes an **Edge-Compute (ARM64)** environment for AI inference, though the sandbox is compatible with standard x86 systems for testing.
