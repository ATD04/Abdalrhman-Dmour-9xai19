# System Technical Brief — Wadi Saqra Live Traffic Digital Twin

> **Purpose of this document:** Complete technical reference for a second AI model (or engineer) to understand the system in full — architecture, data flow, calculation formulas, API contracts, and current configuration. Nothing is omitted intentionally.

---

## 1. What the System Does

This is a **live traffic digital twin** for the **Wadi Saqra intersection** in Amman, Jordan.

It does three things simultaneously:
1. **Pulls live traffic data from Google Maps** (Google Routes API v2) every 30 seconds
2. **Runs a real-time SUMO microscopic traffic simulation** with vehicles injected based on that live data
3. **Serves a web dashboard** showing vehicles, signal states, congestion, and metrics — updated every second via Server-Sent Events

The system is **not a real-time camera system**. It does not use CCTV or YOLO yet. All vehicle counts and speeds come from the SUMO simulation, calibrated by Google Maps congestion data.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Python Backend                           │
│                                                                 │
│  ┌──────────────────┐    every 30s    ┌─────────────────────┐  │
│  │ GoogleTrafficFetcher│─────────────▶│  live_traffic_       │  │
│  │ (live_support.py)  │              │  snapshot.json       │  │
│  └──────────────────┘               └──────────┬──────────┘  │
│                                                │               │
│  ┌──────────────────────────────────────────── ▼ ────────────┐ │
│  │              LiveSimulationEngine (sumo_traci_runner.py)   │ │
│  │                                                            │ │
│  │  refresh_inputs() ──▶ build_live_demand() ──▶ inject       │ │
│  │  _inject_vehicles()  every SUMO step (1.0s)               │ │
│  │  _metrics()          reads lane data via TraCI             │ │
│  │  _signals()          reads TLS state via TraCI             │ │
│  │  _apply_adaptive()   extends green if queue > threshold    │ │
│  │  _publish_state()    writes state + broadcasts SSE         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────┐                                          │
│  │  HTTP Server      │  ThreadingHTTPServer on port 3100       │
│  │  (start_live_     │  Serves /app/* static files             │
│  │   simulation.py)  │  + /api/* JSON endpoints                │
│  │                   │  + /api/live-events (SSE stream)        │
│  └──────────────────┘                                          │
└─────────────────────────────────────────────────────────────────┘
                              │  SSE (1 Hz)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Browser Dashboard (app/)                     │
│  live.html  +  live.js  +  live.css                            │
│                                                                 │
│  • Canvas map: roads, Google traffic polylines, vehicles        │
│  • Direction badges: North/South/East/West with congestion      │
│  • Traffic-light icon on map per junction                       │
│  • Signal cards panel: phase state, lane counts                 │
│  • Approach table: Google vs SUMO comparison                    │
│  • History chart: queue + speed over 10 minutes                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. File Structure

```
Traffic_Project_Simulation/
│
├── config/
│   ├── live_config.json          ← Main configuration (see Section 5)
│   └── live_config.local.json    ← Local overrides (Google API key)
│
├── scripts/
│   ├── start_live_simulation.py  ← Entry point: HTTP server + engine launcher
│   ├── sumo_traci_runner.py      ← Core engine: SUMO control + state publishing
│   ├── live_support.py           ← Utilities: Google API, demand calc, network build
│   └── google_traffic_fetcher.py ← Standalone fetcher script (not used at runtime)
│
├── app/
│   ├── live.html                 ← Dashboard HTML
│   ├── live.js                   ← All rendering + SSE client logic
│   ├── live.css                  ← Styles
│   └── data/
│       ├── live_traffic_snapshot.json  ← Written by refresh_inputs() every 30s
│       ├── live_demand_state.json      ← Written by build_live_demand()
│       ├── live_state.json             ← Written every SUMO step (1 Hz)
│       └── live_history.json           ← Rolling 600-point history
│
└── sumo_scenarios/live/
    ├── wadi_saqra.net.xml        ← SUMO road network (generated from OSM)
    ├── wadi_saqra.rou.xml        ← Route definitions
    └── wadi_saqra.sumocfg        ← SUMO configuration file
```

---

## 4. How to Start

```bash
cd Traffic_Project_Simulation
source /path/to/.venv/bin/activate
python3 scripts/start_live_simulation.py
```

The server starts on `http://127.0.0.1:3100` (auto-increments up to 3119 if port is busy).

Optional flags:
- `--gui` → Launch SUMO with visual GUI (sumo-gui)
- `--open` → Auto-open browser
- `--port 3200` → Override HTTP port

---

## 5. Configuration (`config/live_config.json`)

```json
{
  "site_reference": {
    "lat": 31.96387, "lon": 35.88957
  },
  "google": {
    "service_account_file": null,
    "poll_interval_seconds": 30,
    "probe_distance_meters": {
      "northbound": 1400,
      "southbound": 1400,
      "eastbound":  1600,
      "westbound":  1600
    }
  },
  "sumo": {
    "binary": "...sumo",
    "remote_port": 8813,
    "step_length_seconds": 1.0
  },
  "simulation": {
    "google_base_capacity_veh_h": 450,
    "base_flow_floor_veh_h": 60,
    "demand_sensitivity": 2.35,
    "max_flow_veh_h": 1800,
    "history_seconds": 600,
    "flow_rate_window_seconds": 300,
    "vehicle_length_meters": 7.5,
    "real_time_step_seconds": 0.1
  },
  "adaptive_signal": {
    "enabled_on_start": true,
    "queue_threshold_vehicles": 9,
    "max_extension_seconds": 10
  },
  "server": {
    "host": "127.0.0.1",
    "port": 3100
  }
}
```

| Parameter | Meaning |
|---|---|
| `poll_interval_seconds: 30` | Google API is called every 30 SUMO-seconds |
| `google_base_capacity_veh_h: 450` | Reference capacity (vehicles/hour) per approach — replaces old detector baseline |
| `base_flow_floor_veh_h: 60` | Minimum vehicles/hour injected regardless of Google data |
| `demand_sensitivity: 2.35` | How aggressively congestion amplifies demand (multiplier coefficient) |
| `max_flow_veh_h: 1800` | Hard cap on injected vehicles/hour per direction |
| `vehicle_length_meters: 7.5` | Used for queue length = halting_vehicles × 7.5m |
| `real_time_step_seconds: 0.1` | Wall-clock delay between SUMO steps → 10x faster than real-time |
| `queue_threshold_vehicles: 9` | Adaptive signal extends green when queue exceeds this |
| `max_extension_seconds: 10` | Maximum green extension per adaptive control cycle |

---

## 6. Data Source: Google Routes API v2

### What it does

Every 30 SUMO-seconds, the system fires **4 HTTP requests** to Google Routes API v2 — one per direction (north, south, east, west).

Each request asks: *"What is the current driving time from a point X meters outside the intersection in direction D, arriving at the intersection center?"*

### Probe point calculation

The origin for each probe route is computed by moving `probe_distance_meters[direction]` from the intersection center in the **opposite** bearing of that direction's incoming traffic:

```python
DIRECTION_BEARINGS = {
    "northbound": 180.0,  # probe origin is SOUTH of center (traffic comes from south going north)
    "southbound": 0.0,
    "eastbound":  270.0,
    "westbound":  90.0,
}
```

### API call structure

```http
POST https://routes.googleapis.com/directions/v2:computeRoutes
X-Goog-FieldMask: routes.duration,routes.staticDuration,routes.distanceMeters,
                  routes.polyline.encodedPolyline,routes.travelAdvisory.speedReadingIntervals

{
  "origin": { "location": { "latLng": { "latitude": ..., "longitude": ... } } },
  "destination": { "location": { "latLng": { "latitude": 31.964932, "longitude": 35.884545 } } },
  "travelMode": "DRIVE",
  "routingPreference": "TRAFFIC_AWARE",
  "departureTime": "<now + 2 min>",
  "extraComputations": ["TRAFFIC_ON_POLYLINE"]
}
```

### What is extracted

From the API response:

| Field | How it's used |
|---|---|
| `duration` | Actual travel time under current traffic (seconds) |
| `staticDuration` | Free-flow travel time with no traffic (seconds) |
| `distanceMeters` | Route distance |
| `polyline.encodedPolyline` | Decoded and shown as colored line on map |
| `travelAdvisory.speedReadingIntervals` | Breakdown of road segments by speed category |

### Derived values

```python
speed_ratio = static_duration / actual_duration   # clamped to [0.15, 1.0]
delay_s     = actual_duration - static_duration   # extra seconds due to traffic

# Congestion level from speed_ratio:
# >= 0.88 → "free"
# >= 0.72 → "light"
# >= 0.56 → "moderate"
# >= 0.40 → "heavy"
# < 0.40  → "severe"

# Speed breakdown from speedReadingIntervals:
# Counts polyline segment spans by category NORMAL / SLOW / TRAFFIC_JAM
normal_share = (NORMAL segments) / total_segments
slow_share   = (SLOW segments)   / total_segments
jam_share    = (TRAFFIC_JAM segments) / total_segments
```

### Fallback when Google is unavailable

1. **Google temporarily fails** → Reuse last successful snapshot, mark `source = "google_routes_stale"`
2. **No Google data at all** (e.g. first startup, no API key) → `_build_neutral_snapshot()` returns free-flow defaults (`speed_ratio=0.85`, `delay_s=0`, `congestion_level="light"`)
3. **No API key configured** → `_latest_google_error` is set, error shown in dashboard banner

**No detector data (Al-Manhal or any other region) is ever used.** The detector calibration code (`DetectorCalibrator`) still exists in `live_support.py` but is not instantiated or called anywhere in the live system.

---

## 7. Demand Calculation (Google-only Formula)

`build_live_demand()` in `live_support.py` converts Google traffic data into vehicles/hour for each direction.

### Formula

```
target_veh_h = clamp(
    capacity × (1 + pressure × sensitivity) × jam_multiplier,
    floor,
    max_flow
)

where:
    capacity       = 450  (google_base_capacity_veh_h from config)
    pressure       = 1.0 - speed_ratio          (0 = free flow, 1 = standstill)
    sensitivity    = 2.35 (from config)
    jam_multiplier = 1 + jam_share × 1.2 + slow_share × 0.5
    floor          = 60   (minimum vehicles/hour)
    max_flow       = 1800 (maximum vehicles/hour)
```

### Example

```
Google says: speed_ratio=0.6, jam_share=0.2, slow_share=0.3

pressure       = 1.0 - 0.6 = 0.40
jam_multiplier = 1 + 0.2×1.2 + 0.3×0.5 = 1 + 0.24 + 0.15 = 1.39
target = 450 × (1 + 0.40 × 2.35) × 1.39
       = 450 × 1.94 × 1.39
       = 1,213 vehicles/hour
```

### Output per direction

```json
{
  "northbound": {
    "google_capacity_veh_h": 450.0,
    "target_veh_h": 1213.0,
    "pressure_index": 0.40,
    "speed_ratio": 0.6,
    "jam_share": 0.2,
    "slow_share": 0.3,
    "congestion_level": "moderate",
    "source": "google_routes"
  }
}
```

---

## 8. SUMO Simulation Engine

### Startup sequence

```
start()
  └─▶ prepare()
        ├─▶ refresh_inputs()         → fetch Google data, compute demand
        ├─▶ _launch_sumo()           → spawn sumo process, connect via TraCI port 8813
        ├─▶ traci.route.add(...)     → register 4 routes (one per direction)
        └─▶ _map_signal_indices()    → map TLS links to directions
  └─▶ _run_loop() in daemon thread
```

### Main loop (`_run_loop`)

Runs in a background thread at 10 iterations/second (real time):

```
every SUMO step (1.0s simulated):
  1. if sim_time >= next_refresh (every 30s):
       refresh_inputs()  ← call Google API, recompute demand
  2. _inject_vehicles()  ← add vehicles based on target_veh_h
  3. traci.simulationStep()  ← advance SUMO by 1 second
  4. _publish_state()    ← collect metrics, write JSON, broadcast SSE
  5. sleep(0.1)          ← 0.1s wall-clock per step = 10x faster than real time
```

### Vehicle injection (`_inject_vehicles`)

Converts vehicles/hour to a per-step fractional count using a residual accumulator:

```python
rate = target_veh_h  # e.g. 1200 veh/h
residual[direction] += rate × step_length / 3600.0
# e.g. residual += 1200 × 1.0 / 3600 = 0.333 per step

while residual >= 1.0:
    add_vehicle_to_sumo()
    residual -= 1.0
```

Each vehicle is assigned:
- A random type: `passenger (82%), truck (8%), bus (5%), motorcycle (5%)`
- ID format: `"{direction_prefix}_{sim_time:06d}_{counter:05d}"`
- Departs immediately, best lane, max speed

### Metrics collection (`_metrics`)

Every step, for each direction, queries TraCI on all lanes of `monitor_edges`:

| Metric | How calculated |
|---|---|
| `vehicles_on_approach` | Sum of vehicles on all monitored lanes |
| `queue_vehicles` | Sum of halting vehicles (speed < 0.1 m/s) |
| `queue_m` | `queue_vehicles × 7.5` meters |
| `avg_speed_kmh` | Weighted mean speed × 3.6, weight = vehicle count per lane |
| `flow_veh_h` | Rolling count of vehicles that completed route in last 300s, scaled to vehicles/hour |
| `occupancy_pct` | Mean lane occupancy across monitored lanes |

### Signal data (`_signals`)

For every TLS (traffic light system) ID in SUMO:

```json
{
  "6456640687": {
    "phase": 2,
    "state": "GGGrrrGGGrrr",
    "remaining_s": 31.0,
    "lat": 31.96493,
    "lon": 35.88455
  }
}
```

- `state` string: one char per lane — `G/g` = green, `y/Y` = yellow, `r/R` = red
- `lat/lon` from `traci.junction.getPosition()` — used to pin icon on map

### Adaptive signal control (`_apply_adaptive_control`)

Runs every step when `adaptive_active = true`:

```
1. Find direction with highest queue (dominant_direction)
2. Get current phase of controller_tls_id
3. Check if dominant_direction is currently in a green phase
4. If queue > 9 vehicles:
     extension = min(10, queue - 9 + 2)  seconds
     traci.trafficlight.setPhaseDuration(tls_id, remaining + extension)
```

---

## 9. HTTP API Endpoints

Server: `http://127.0.0.1:3100`

| Method | Path | Description |
|---|---|---|
| GET | `/` | Redirects to `/app/live.html` |
| GET | `/app/*` | Static file serving (HTML, JS, CSS) |
| GET | `/api/health` | Engine status, source, simulation center |
| GET | `/api/live-config` | Public config summary (no secrets) |
| GET | `/api/live-state` | Current full state snapshot (see Section 10) |
| GET | `/api/live-history` | Last 600 history points (1 per SUMO second) |
| GET | `/api/network-geometry` | Road network bbox + road polylines for map rendering |
| GET | `/api/live-events` | **SSE stream** — pushes state every ~1s when version changes |
| POST | `/api/adaptive-toggle` | `{"enabled": true/false}` — toggle adaptive control |

---

## 10. Live State JSON Contract

`/api/live-state` returns:

```json
{
  "status": "running",
  "state_version": 4512,
  "wall_time": "2026-04-22T10:30:00+03:00",
  "sim_time_s": 4512.0,
  "source": "google_routes",
  "simulation_center": { "lat": 31.964932, "lon": 35.884545 },
  "site_reference": { "label": "...", "lat": 31.96387, "lon": 35.88957 },
  "controller_tls_id": "cluster_10989299571_...",
  "adaptive_active": true,
  "google_error": null,

  "vehicles": [
    {
      "id": "no_062345_00123",
      "lat": 31.9651,
      "lon": 35.8841,
      "speed_ms": 8.3,
      "speed_kmh": 29.9,
      "heading_deg": 180.0,
      "type": "passenger"
    }
  ],

  "signals": {
    "6456640687": {
      "phase": 2,
      "state": "GGGrrrGGGrrr",
      "remaining_s": 31.0,
      "lat": 31.96493,
      "lon": 35.88455
    }
  },

  "metrics": {
    "northbound": {
      "vehicles_on_approach": 12,
      "queue_vehicles": 3,
      "queue_m": 22.5,
      "avg_speed_ms": 6.2,
      "avg_speed_kmh": 22.3,
      "occupancy_pct": 14.2,
      "density": 0.142,
      "flow_veh_h": 480.0,
      "target_veh_h": 612.0
    }
  },

  "demand": {
    "northbound": {
      "google_capacity_veh_h": 450.0,
      "target_veh_h": 612.0,
      "pressure_index": 0.31,
      "speed_ratio": 0.69,
      "jam_share": 0.05,
      "slow_share": 0.12,
      "congestion_level": "light",
      "source": "google_routes"
    }
  },

  "google_snapshot": {
    "northbound": {
      "speed_ratio": 0.69,
      "congestion_level": "light",
      "delay_s": 27.0,
      "normal_share": 0.83,
      "slow_share": 0.12,
      "jam_share": 0.05,
      "polyline": [
        { "lat": 31.972, "lon": 35.884 },
        { "lat": 31.965, "lon": 35.885 }
      ]
    }
  },

  "insights": {
    "dominant_queue_direction": "westbound",
    "google_delay_direction": "westbound",
    "total_queue_m": 82.5,
    "avg_network_speed_kmh": 23.1,
    "alerts": [
      {
        "severity": "high",
        "direction": "westbound",
        "message": "SUMO queue crossed the adaptive threshold on the westbound approach."
      }
    ],
    "recommendation": "Give extra green time to the westbound approach..."
  }
}
```

---

## 11. Dashboard Frontend

**Technology:** Vanilla JavaScript + HTML5 Canvas (no framework)

### Map rendering (`drawMap()` in `live.js`)

Layers drawn in order (all inside `ctx.save()` zoom/pan transform except badges):

1. **Road network** — gray polylines from `/api/network-geometry`
2. **Google traffic polylines** — colored lines per approach:
   - Green `#3ddc97` = free/light
   - Orange `#ffb347` = moderate (slow)
   - Red `#ff5a5f` = heavy/severe (jam)
3. **SUMO vehicles** — directional triangles:
   - Size: 4.5px (stopped) or 3.2px (moving)
   - Color: red (speed < 3 km/h), orange (< 20 km/h), white (fast)
   - Rotated by `heading_deg` (SUMO: 0° = North, 90° = East, clockwise)
4. **Junction markers** — green dot at simulation center, orange dot at reference site
5. **Traffic-light icon** — small pole (14×36px) drawn at each TLS junction position:
   - 3 dots (red/yellow/green) reflect the actual phase state
   - Row of small color squares to the right — one per signal group
6. **Fixed overlays** (outside zoom transform):
   - Scale bar (200m reference)
   - 4 direction badges at corners (North/South/East/West) with congestion color + delay

### Signal panel (`renderSignals()`)

Each signal group becomes one card:
- Numbered circle matching the map icon
- Phase label: "All lanes green" / "X lanes stopped, Y moving" / "Transitioning"
- Row of phase dots (one per lane)
- Time remaining in current phase

### History chart (`drawHistory()`)

Rolling 10-minute (600 seconds) chart:
- Orange line = total network queue in meters
- Green line = average network speed in km/h

### SSE connection

```javascript
const eventSource = new EventSource("/api/live-events");
eventSource.addEventListener("state", (event) => {
    state.liveState = JSON.parse(event.data);
    render();
});
```

---

## 12. Data Flow Summary (End to End)

```
Google Routes API
      │
      │  speed_ratio, delay_s, polyline, jam_share, slow_share
      ▼
  build_live_demand()
      │
      │  target_veh_h per direction
      ▼
  _inject_vehicles()  ─────────────────▶  SUMO simulation
                                               │
                                               │  TraCI queries every step
                                               ▼
                                          _metrics()
                                          _signals()
                                          _vehicles()
                                               │
                                               ▼
                                          _publish_state()
                                               │
                              ┌────────────────┼────────────────┐
                              ▼                ▼                ▼
                         live_state.json    SSE stream     history.json
                                               │
                                               ▼
                                        Browser (live.js)
                                        renders every 1s
```

---

## 13. Known Limitations

| Limitation | Detail |
|---|---|
| **Network accuracy** | Road network generated from OpenStreetMap, not from official Jordan MOW data. Lane counts and signal timing may differ from reality. |
| **Signal timing** | SUMO signal phases are auto-generated by `netconvert`. They are NOT calibrated to the real Wadi Saqra controller timing. |
| **No real vehicle counts** | All vehicle counts are synthetic — injected by the simulation based on Google demand, not observed from cameras. |
| **Google API quota** | 4 API calls every 30 seconds = 8 calls/minute. At standard quota limits this is sustainable but must be monitored. |
| **Simulation center** | The simulation center is `31.964932, 35.884545` — approximately correct for Wadi Saqra intersection. The reference site (`31.96387, 35.88957`) is where a future camera would be installed. |
| **Vehicle types** | Mix: 82% passenger, 8% truck, 5% bus, 5% motorcycle — based on Jordan urban traffic typical ratios, not measured. |

---

## 14. What the System Does NOT Use

- ❌ **Al-Manhal detector data** (22 CSV files in `Traffic_Data_Sandbox/detector_data/`) — NOT used. Only present as archived data.
- ❌ **YOLOv8** (`yolov8n.pt`) — NOT active. Present for future CCTV integration.
- ❌ **SUMO GUI** — runs headless by default. Add `--gui` flag to start_live_simulation.py to enable.
- ❌ **Any database** — all state is in-memory + JSON files.

---

## 15. Extension Points

| What to add | Where |
|---|---|
| Real Wadi Saqra detector data | `build_live_demand()` in `live_support.py` — add a calibration term to `capacity` |
| CCTV / YOLO vehicle counts | Replace or supplement Google `speed_ratio` with observed count |
| Signal timing optimization (Model 2) | Add a new POST endpoint + logic in `_apply_adaptive_control()` |
| Short-term forecasting (Model 3) | Read from `/api/live-history`, predict next 5–15 minutes |
| Multi-intersection support | Extend `DIRECTIONS` and `route_defs` in the network manifest |
