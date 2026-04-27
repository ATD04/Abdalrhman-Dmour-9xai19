# 11 — Live Simulation Plan: Implemented SUMO × Google Traffic Digital Twin

## Goal

Upgrade the traffic simulation from a pre-generated demo into a live operational digital twin that:

- senses real traffic conditions from Google in near real time
- converts those conditions into estimated directional demand
- runs the intersection inside SUMO with live vehicle injection
- exposes decision-ready KPIs and alerts in a live dashboard

## Important Reality Check

Google Maps does not provide direct raw vehicle counts per lane or per approach.

Because of that, the implemented solution uses a better and more realistic method:

- Google Routes API gives live `duration`, `staticDuration`, and `speedReadingIntervals`
- those values are converted into live congestion ratios by direction
- detector data from the sandbox calibrates what those ratios mean in estimated `veh/h`
- SUMO simulates the resulting demand and computes queue, speed, and flow on the network

This means the dashboard shows live, data-informed demand estimates and simulation outputs, not fake hard-coded car counts.

## Implemented Architecture

```text
Google Routes API
    ->
google_traffic_fetcher.py
    ->
live_demand_generator.py
    ->
sumo_traci_runner.py
    ->
start_live_simulation.py
    ->
app/live.html + live.js + live.css
```

Supporting pieces:

- `generate_live_sumo_network.py` creates the live OSM/SUMO network around Wadi Saqra
- `coord_converter.py` converts between SUMO XY and WGS84 lat/lon
- `verify_live_simulation.py` validates the full path end to end
- `live_support.py` centralizes config, calibration, Google access, geometry, and network generation

## Data Pipeline

### 1. Live Google Traffic Fetch

Script: `scripts/google_traffic_fetcher.py`

The system probes four approach directions:

- `northbound`
- `southbound`
- `eastbound`
- `westbound`

For each direction it requests a live route toward the simulation center and extracts:

- live travel duration
- free-flow duration
- delay in seconds
- speed-state intervals across the route polyline

The output is written to:

- `app/data/live_traffic_snapshot.json`

### 2. Demand Translation

Script: `scripts/live_demand_generator.py`

Each direction receives a live target demand derived from:

- detector-calibrated historical base flow for the current time slot
- Google travel-time ratio
- a sensitivity factor from config
- a max-flow cap for simulation stability

Output:

- `app/data/live_demand_state.json`
- `sumo_scenarios/live/live_demand_preview.rou.xml`

### 3. SUMO Live Execution

Script: `scripts/sumo_traci_runner.py`

The engine:

- launches `sumo` or `sumo-gui`
- connects through TraCI
- injects vehicles continuously based on live demand
- collects signal states and vehicle positions
- computes directional queue, flow, occupancy, density, and speed
- generates alerts and a recommendation string for operators
- optionally extends green time for the dominant queued direction

### 4. Dashboard Streaming

Script: `scripts/start_live_simulation.py`

The live server exposes:

- `GET /api/health`
- `GET /api/live-config`
- `GET /api/live-state`
- `GET /api/live-history`
- `GET /api/network-geometry`
- `GET /api/live-events`
- `POST /api/adaptive-toggle`

The dashboard uses `Server-Sent Events` rather than WebSocket and renders:

- the local SUMO/OSM network geometry
- Google live route overlays
- moving SUMO vehicles
- signal cards
- directional comparison table
- rolling history chart
- alerts and recommendations

## Implemented Files

| File | Role |
|------|------|
| `scripts/live_support.py` | shared live utilities, Google access, calibration, geometry, network generation |
| `scripts/generate_live_sumo_network.py` | builds the live OSM extract and SUMO network |
| `scripts/google_traffic_fetcher.py` | fetches live Google Routes traffic |
| `scripts/live_demand_generator.py` | builds directional demand from live traffic |
| `scripts/coord_converter.py` | SUMO XY ↔ lat/lon conversion |
| `scripts/sumo_traci_runner.py` | live SUMO engine with TraCI |
| `scripts/start_live_simulation.py` | HTTP + SSE server for the dashboard |
| `scripts/verify_live_simulation.py` | end-to-end verification script |
| `app/live.html` | live operations dashboard |
| `app/live.css` | live dashboard styling |
| `app/live.js` | live rendering, SSE consumption, adaptive toggle |
| `config/live_config.json` | shared live config |
| `config/live_config.local.json` | ignored local override for secrets |

## Configuration Notes

Main config:

- `config/live_config.json`

Local override:

- `config/live_config.local.json`

Key runtime settings:

- Google polling interval: `300s`
- SUMO step length: `1.0s`
- live history buffer: `600s`
- adaptive queue threshold: `9 vehicles`
- max signal extension: `10s`

## Network Generation Notes

The live network is generated from OSM near the Wadi Saqra reference point.

Outputs:

- `sumo_scenarios/live/wadi_saqra_live.osm.xml`
- `sumo_scenarios/live/wadi_saqra_live.net.xml`
- `sumo_scenarios/live/wadi_saqra_live.sumocfg`
- `sumo_scenarios/live/network_manifest.json`
- `app/data/live_network_geometry.json`

The simulation center is selected from the generated SUMO traffic-light network, which may be close to but not exactly identical to the original camera reference. In the current verified build, the selected SUMO control point is about `490m` from the original reference because it was the nearest viable generated TLS cluster.

## Fallback Strategy

If Google live fetching fails or credentials are absent:

- the system falls back to detector-calibrated traffic estimates
- the engine still runs
- the dashboard marks fallback mode through `google_error`

This keeps the simulation operational even when the external source is unavailable.

## Run Commands

Generate the live network:

```bash
./.venv/bin/python Traffic_Project_Simulation/scripts/generate_live_sumo_network.py
```

Verify the full live pipeline:

```bash
./.venv/bin/python Traffic_Project_Simulation/scripts/verify_live_simulation.py
```

Start the live server:

```bash
./.venv/bin/python Traffic_Project_Simulation/scripts/start_live_simulation.py
```

If port `3100` is busy, the server automatically tries the next ports.

## Verified Test Path

The following checks were executed successfully in this environment:

1. Python syntax validation for all new live scripts
2. JavaScript syntax validation for `app/live.js`
3. live SUMO network generation
4. live Google Routes fetch with the provided service account
5. demand-state generation
6. coordinate round-trip verification
7. blocking TraCI engine run
8. end-to-end verification via `verify_live_simulation.py`
9. live server health, state, history, geometry, and SSE endpoint checks

## Decision-Support Outputs

The live dashboard now provides:

- dominant queued direction
- average network speed
- total queued meters across the network
- Google delay hotspot direction
- directional live vs simulated comparison
- adaptive-control on/off state
- queue and congestion alerts
- an operator recommendation string derived from current conditions

## Practical Limits

- Google still does not expose literal car-count truth
- the live demand is an informed estimate, not a camera-count ground truth
- directional calibration quality depends on the detector dataset
- the chosen SUMO TLS is generated from available OSM topology near the site

These limits are normal for a first production-style live twin and are already handled transparently in the implementation.
