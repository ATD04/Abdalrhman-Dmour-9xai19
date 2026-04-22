# Methodology: AMM-WS-01 Traffic Intelligence Sandbox

> **Transparency notice**: All traffic data in this sandbox is synthetic and generated using simulation. The visual source is representative, not a live feed from the actual Wadi Saqra site. Labels such as "representative", "simulated", and "synthetic but structured" are used deliberately throughout. See `docs/limitations_note.md` and `docs/source_assumptions.md` for full detail.

---

### 1. Unified Sandbox Structure
The sandbox is organized as a dataset-first package. All subsequent Phase 2 (Feasibility) and Phase 3 (Integration) modules must ingest data from these structured files. The optional FastAPI viewer and React monitor are supporting tools only — not the core deliverable.

### 2. SUMO-Based Representative Traffic Simulation
We utilized **Eclipse SUMO v1.26.0** to generate an 8-hour representative microscopic simulation of the Wadi Saqra intersection. Demand patterns, routing, and signal plans are modeled assumptions — not measurements from the actual site.
- **Network**: Derived from OpenStreetMap (OSM) geometry of the Wadi Saqra area.
- **Routing**: Stochastic demand generated via `randomTrips.py` with realistic veh/hour rates for urban Amman.
- **Detectors**: Virtual induction loops placed 5m behind each stop line per lane.
- **Signals**: Pre-timed 4-phase plan aligned with the OSM road topology.

### 3. Normalization and Synchronization
A centralized normalization pipeline ensures all sandbox layers share a common reference:
- Map SUMO phase IDs (e.g., `gs1`) to standardized Phase Numbers (1–4).
- Standardize all timestamps to `2026-04-21 HH:MM:SS` (UTC) to ensure multi-modal alignment.
- Re-index detector naming to match the cardinal approach map (North, South, East, West) per `naming_conventions.md`.

### 4. Forecasting-Ready Dataset
A 24-hour cycle was extrapolated from the 8-hour simulation using demand factor profiles for AM peak, midday, PM peak, and overnight. The dataset maintains lane-based structure and adds forecasting-ready feature fields. See `detector/forecasting_ready/feature_definitions.json` for the full feature contract.

### 5. Validation-Ready Annotation Layer
Annotations in `/annotations` provide a structured basis for Phase 2 benchmarking. These are synthetic labels applied to the simulated dataset, not ground truth from real observed events. They are suitable for:
- Validating vehicle detection logic against labeled frame subsets.
- Benchmarking incident detection (spillback, stalled vehicle) against defined event windows.
- Confirming detection latency against `benchmark_seed.json` targets.

### 6. Output Contracts
Fixed schema contracts in `/schemas/` define the interface between Phase 1 sandbox data and future Phase 2 modules. All detection, forecasting, and event notification outputs must conform to these schemas to remain storage-compatible with the Phase 3 logging layer.

### 7. Fault Handling Support
A lightweight fault sample set in `/fault_samples/` provides corrupted detector logs and a video dropout manifest. These are used to validate that Phase 2 ingestion modules handle bad data gracefully without crashing.
