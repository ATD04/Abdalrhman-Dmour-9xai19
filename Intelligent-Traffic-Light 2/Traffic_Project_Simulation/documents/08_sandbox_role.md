# 08 Sandbox Role

## Why The Sandbox Matters
The sandbox is the controlled environment that lets the team build the first version of the product before live infrastructure is available.

It gives us:
1. detector data
2. signal timing context
3. metadata about the site
4. incident and congestion examples
5. at least one local video source

## How The Sandbox Supports Each Model
### Model 1 / Detection
The current sandbox does not yet contain real frame-by-frame annotations for training.
However, it provides:
- camera context
- video placeholders
- incident scenarios to design around

That means Model 1 can be simulated now and replaced by real inference later.

### Model 2 / Insights
This is where the sandbox is already very useful.
Detector counts, signal timing logs, and annotation examples allow us to:
- define congestion logic
- detect queue spillback conditions
- simulate stalled-vehicle response behavior
- explain what each operational metric means

### Model 3 / Forecasting
The sandbox is immediately useful here because it already contains:
- aligned 15-minute detector time-series
- day-to-day variation
- peak and off-peak behavior
- incident windows that can affect forecast features

## Why The Sandbox Was Expanded Into A Simulation
Raw CSV files are useful for data work, but not enough for a convincing Phase 1 demo.
The simulation adds:
1. visual storytelling
2. operator-facing interpretation
3. model-to-dashboard logic
4. explainability for the team and judges

## Sandbox Limitations
1. The video layer is still limited.
2. There is no fully labeled visual training corpus yet.
3. Signal logs are synthetic demand-aware logs, not controller exports.
4. Some scenarios are simulated rather than fully recorded.

## What To Do Next With The Sandbox
1. Add more scenario-specific videos.
2. Label video clips for detection and event training.
3. Align exact event timestamps across video and detectors.
4. Generate camera-specific training sets per scenario.

## Key Message
The sandbox is not the final product.
It is the safe and structured foundation that allows the real product to be designed, explained, tested, and improved before deployment.
