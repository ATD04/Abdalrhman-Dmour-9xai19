# Traffic Project Simulation

This folder now contains two traffic-simulation modes for the Wadi Saqra use case:

- the original static sandbox dashboard
- a new live digital twin that combines live Google traffic signals with SUMO via TraCI

The live mode is the main implementation for real-time operations.

## What Changed

The project no longer treats Google Maps as a direct vehicle counter, because Google does not expose raw car counts per approach. Instead, the live pipeline uses a stronger production pattern:

- Google Routes API provides live travel time and segment speed states
- detector CSVs provide historical calibration by direction and time slot
- a demand translator converts live delay ratios into estimated veh/h demand
- SUMO injects vehicles in real time and publishes live queue, flow, speed, and signal state
- the dashboard renders a live digital twin map, route overlays, KPIs, alerts, and operator guidance

## Live Architecture

`Google Routes -> demand translation -> SUMO/TraCI -> SSE API -> live dashboard`

Key outputs:

- live estimated demand by `northbound`, `southbound`, `eastbound`, `westbound`
- live vehicle movement on the generated SUMO network
- signal phase state and remaining time
- queue length, flow, occupancy, and average speed per direction
- decision-support insights and adaptive-control recommendations

## Folder Structure

- `app/`: dashboard frontend, including `live.html`, `live.css`, and `live.js`
- `config/`: live config plus local, ignored overrides for credentials
- `documents/`: architecture and implementation notes
- `scripts/`: live network generation, Google fetch, SUMO engine, verification, and servers
- `sumo_scenarios/live/`: generated OSM/SUMO live scenario assets

## Live Setup

Python dependencies used in the working implementation are listed in [requirements-live.txt](/Users/ahmadhasasneh/Desktop/Intelligent-Traffic-Light/Traffic_Project_Simulation/requirements-live.txt).

Install them into the local virtual environment:

```bash
./.venv/bin/pip install -r Traffic_Project_Simulation/requirements-live.txt
```

SUMO must already be installed locally. This project is currently configured for:

```text
/Library/Frameworks/EclipseSUMO.framework/Versions/1.26.0/EclipseSUMO
```

If your SUMO path is different, update [live_config.json](/Users/ahmadhasasneh/Desktop/Intelligent-Traffic-Light/Traffic_Project_Simulation/config/live_config.json).

## Live Credentials

Keep Google credentials in a local override, not in the shared config:

- [live_config.local.json](/Users/ahmadhasasneh/Desktop/Intelligent-Traffic-Light/Traffic_Project_Simulation/config/live_config.local.json)
- `config/google_service_account.local.json`

`config/*.local.json` is ignored by git via [config/.gitignore](/Users/ahmadhasasneh/Desktop/Intelligent-Traffic-Light/Traffic_Project_Simulation/config/.gitignore).

## Live Runbook

Generate or refresh the live SUMO network:

```bash
./.venv/bin/python Traffic_Project_Simulation/scripts/generate_live_sumo_network.py
```

Verify the live pipeline end to end:

```bash
./.venv/bin/python Traffic_Project_Simulation/scripts/verify_live_simulation.py
```

Start the live dashboard:

```bash
./.venv/bin/python Traffic_Project_Simulation/scripts/start_live_simulation.py
```

If port `3100` is already in use, the server automatically tries the next free port such as `3101`.

Open:

```text
http://127.0.0.1:3100
```

If `3100` is occupied, use the port printed at startup.

## Live API Endpoints

- `GET /api/health`
- `GET /api/live-config`
- `GET /api/live-state`
- `GET /api/live-history`
- `GET /api/network-geometry`
- `GET /api/live-events`
- `POST /api/adaptive-toggle`

## Working Scripts

- [generate_live_sumo_network.py](/Users/ahmadhasasneh/Desktop/Intelligent-Traffic-Light/Traffic_Project_Simulation/scripts/generate_live_sumo_network.py): builds the OSM extract, SUMO network, routes manifest, and geometry
- [google_traffic_fetcher.py](/Users/ahmadhasasneh/Desktop/Intelligent-Traffic-Light/Traffic_Project_Simulation/scripts/google_traffic_fetcher.py): fetches live Google Routes traffic conditions
- [live_demand_generator.py](/Users/ahmadhasasneh/Desktop/Intelligent-Traffic-Light/Traffic_Project_Simulation/scripts/live_demand_generator.py): converts live traffic state into per-direction demand
- [sumo_traci_runner.py](/Users/ahmadhasasneh/Desktop/Intelligent-Traffic-Light/Traffic_Project_Simulation/scripts/sumo_traci_runner.py): runs the live SUMO engine
- [start_live_simulation.py](/Users/ahmadhasasneh/Desktop/Intelligent-Traffic-Light/Traffic_Project_Simulation/scripts/start_live_simulation.py): serves the live dashboard and SSE endpoints
- [verify_live_simulation.py](/Users/ahmadhasasneh/Desktop/Intelligent-Traffic-Light/Traffic_Project_Simulation/scripts/verify_live_simulation.py): runs live verification

## Static Sandbox Mode

The original static demo is still available:

```bash
python3 Traffic_Project_Simulation/scripts/build_simulation_data.py
python3 Traffic_Project_Simulation/scripts/serve_simulation.py
```

That path is useful for presentation playback, but it is not the real-time digital twin.

## Documents

- [11_live_simulation_plan.md](/Users/ahmadhasasneh/Desktop/Intelligent-Traffic-Light/Traffic_Project_Simulation/documents/11_live_simulation_plan.md): implemented live architecture and run plan
- [09_real_world_implementation.md](/Users/ahmadhasasneh/Desktop/Intelligent-Traffic-Light/Traffic_Project_Simulation/documents/09_real_world_implementation.md): deployment-oriented roadmap
- [10_simulation_change_log.md](/Users/ahmadhasasneh/Desktop/Intelligent-Traffic-Light/Traffic_Project_Simulation/documents/10_simulation_change_log.md): change history for the upgraded simulation
