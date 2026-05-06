# Wadi Saqra Intelligent Traffic Light — Digital Twin Evolution

## Overview
This document tracks the technical evolution of the Wadi Saqra Intelligent Traffic Light project, specifically the transition from a schematic simulation to a high-fidelity Digital Twin.

## Phase 2 Update: Realistic Digital Twin
The latest update (May 2026) focused on transforming the schematic 2D rendering into a high-fidelity representation of real-world traffic conditions.

### 1. Realistic Vehicle Rendering
- **Top-Down Models**: Replaced simplistic triangles with detailed car, bus, and truck models.
- **Dynamic Lighting**: Added headlights (active) and brake lights (active when speed < 3 km/h or at red lights).
- **ID-Based Coloring**: Vehicles are assigned persistent colors from a premium palette based on their unique ID.
- **Inverse Scaling**: Implemented a dynamic scaling engine that ensures vehicles remain visible and recognizable even at high zoom-out levels.

### 2. Road Network Aesthetics
- **Asphalt Texturing**: Replaced plain lines with multi-pass asphalt-textured road beds.
- **Lane Markings**: Added realistic dashed center lines and solid edge markings.
- **Spatial Reference**: Introduced a subtle grid and pulsing intersection markers for better orientation.

### 3. Operational UI (HUD)
- **Signal Phase HUD**: Real-time signal state, countdown timer, and progress bar overlaid on the map.
- **Directional Badges**: Frosted-glass badges summarizing approach-specific KPIs (Queue, Flow, Speed, Delay).
- **Map HUD**: Added a professional scale bar and a data source indicator (Google Live vs. Detector Fallback).

### 4. Simulation Lab Overhaul
- **3D-Style Signal Heads**: Rebuilt signal rendering with housing depth and radial glow effects.
- **Realistic Queue Visualization**: Queued vehicles in the "What-if" lab are now rendered with full detail, including brake lights.

### 5. Analytics UX Improvements
- **Scrollable Heat Maps**: Redesigned the "Volume Heat Map" section to display one approach at a time with a vertical scrollbar, significantly improving the vertical layout of the Analytics tab.

## Technical Stack
- **Microsimulation**: SUMO (Simulation of Urban MObility)
- **Rendering**: HTML5 Canvas API (optimized multi-layer rendering)
- **Data Pipeline**: Google Routes API (Primary) / loop-detector sensors (Fallback)
- **Analysis**: HCM 2010 Traffic Engineering methodology
