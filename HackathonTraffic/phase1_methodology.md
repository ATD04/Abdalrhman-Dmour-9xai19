# Phase 1 Technical Methodology
### Traffic Data Sandbox — Video Counting + Congestion API Scaling

---

## Overview

This document describes a practical method for bootstrapping the **Phase 1 Traffic Data Sandbox** without access to live detector hardware or historical sensor logs. The approach uses a short video sample of the target intersection combined with Google's congestion API to synthesize a realistic multi-day traffic dataset.

The output feeds directly into the **traffic detector dataset** and **historical calibration pack** required by Phase 1.

---

## Core Idea

A short video clip of the intersection gives you a real, ground-truth vehicle count at a known (or estimated) time of day. Google's congestion API gives you the *relative rhythm* of traffic across all hours and days. Combining both lets you extrapolate a single observation into a full weekly traffic matrix — per direction, per 15-minute interval.

```
Ground Truth Count (video)  ×  Congestion Ratio (API)  =  Estimated Count (any hour/day)
```

---

## Step 1 — Vehicle Counting from Video

Manually or programmatically count vehicles entering the intersection from each approach during the video clip.

**What to count:**
- Vehicles per approach direction (North, South, East, West)
- Count window: the full clip duration in minutes
- Derive a **vehicles-per-minute rate** per approach

**Example output:**

| Approach | Vehicles Counted | Clip Duration | Rate (veh/min) |
|----------|-----------------|---------------|----------------|
| North    | 18              | 2 min         | 9.0            |
| South    | 12              | 2 min         | 6.0            |
| East     | 22              | 2 min         | 11.0           |
| West     | 8               | 2 min         | 4.0            |

> **Tool options:** manual tally, or a lightweight YOLO-based counter on the clip as an early CV test.

---

## Step 2 — Anchor the Clip to a Time Window

Assign the video clip to its most likely time window. If the exact timestamp is unknown, estimate using:
- Lighting and shadow angles
- Pedestrian density
- General traffic volume appearance

In our case, the clip was estimated at **11:00 AM – 1:00 PM**. The midpoint (**12:00 PM**) becomes the **baseline reference slot** with a congestion ratio of `1.0`.

---

## Step 3 — Pull Congestion Ratios from Google API

Use the **Google Maps Roads API** or **Google Maps JavaScript API** (via the `directionsService` or traffic layer) to retrieve typical speed or congestion data for the roads feeding the intersection.

**What to extract:**
- Typical relative congestion by hour (0–23) for each day of the week (Mon–Sun)
- Normalize all values against your baseline slot (12:00 PM = 1.0)

**Example ratio table (single approach, Mon–Fri average):**

| Hour  | Ratio | Interpretation            |
|-------|-------|---------------------------|
| 06:00 | 0.6   | Light, pre-peak           |
| 07:00 | 1.4   | Building morning peak     |
| 08:00 | 1.9   | Peak hour                 |
| 09:00 | 1.5   | Tapering                  |
| 12:00 | **1.0**   | **Baseline (video anchor)**   |
| 17:00 | 1.8   | Afternoon peak            |
| 20:00 | 0.7   | Evening wind-down         |
| 23:00 | 0.2   | Near-empty                |

> Collect separate ratio tables per day type: **Weekday**, **Saturday**, **Sunday/Holiday**.

---

## Step 4 — Scale Counts Across the Full Week

Apply the scaling formula across every time slot:

```
Flow(approach, hour, day) = BaselineRate(approach) × Ratio(hour, day) × 15
```

The `× 15` converts vehicles/minute to vehicles per 15-minute interval, matching the **15-minute resolution** required by the Phase 1 detector dataset spec.

**Example — Northbound approach, Monday:**

| Slot  | Ratio | Calc           | Vehicles / 15 min |
|-------|-------|----------------|-------------------|
| 08:00 | 1.9   | 9.0 × 1.9 × 15 | 256               |
| 12:00 | 1.0   | 9.0 × 1.0 × 15 | 135               |
| 17:00 | 1.8   | 9.0 × 1.8 × 15 | 243               |
| 23:00 | 0.2   | 9.0 × 0.2 × 15 | 27                |

Repeat for all approaches × all hours × all 7 days → **full weekly detector matrix**.

---

## Step 5 — Structure the Output Dataset

Format the generated data to match the Phase 1 **traffic detector dataset spec**: 15-minute resolution, approach-based, 24-hour coverage.

**Recommended schema:**

```
timestamp          | intersection_id | approach  | detector_id | vehicle_count | day_type
-------------------|-----------------|-----------|-------------|---------------|----------
2024-01-15 08:00   | INT_001         | North     | DET_N_01    | 256           | Weekday
2024-01-15 08:00   | INT_001         | South     | DET_S_01    | 171           | Weekday
2024-01-15 08:00   | INT_001         | East      | DET_E_01    | 314           | Weekday
2024-01-15 08:00   | INT_001         | West      | DET_W_01    | 114           | Weekday
```

Generate **at minimum 2 weeks** of synthetic records to satisfy the historical calibration pack requirement.

---

## Step 6 — Add Gaussian Noise for Realism

Real detector logs are never perfectly smooth. Add a small noise term to each generated count to prevent the synthetic data from looking artificially uniform — which would cause models to learn unrealistic patterns.

```python
import numpy as np

def add_noise(base_count, std_pct=0.08):
    noise = np.random.normal(0, base_count * std_pct)
    return max(0, round(base_count + noise))
```

An `std_pct` of **0.05–0.10** (5–10%) is a reasonable starting point.

---

## What This Produces for Phase 1

| Phase 1 Deliverable | Covered by This Method |
|---|---|
| Traffic detector dataset | ✅ Full 15-min resolution, approach-based, 2-week synthetic log |
| Historical calibration pack | ✅ Usable as training/validation baseline for forecasting models |
| Data dictionary | ✅ Schema above serves as the dictionary foundation |
| Methodology note | ✅ This document |
| Annotation layer | ⚠️ Partial — congestion events can be labeled from ratio peaks; incident labels require separate video annotation |
| Signal timing log | ❌ Requires separate synthetic generation based on assumed cycle plans |

---

## Key Assumptions to Document

Always include these in your methodology note submission:

- **Clip time window** — state your estimate and confidence level
- **Baseline slot** — which hour/day was used as the `1.0` anchor
- **Google API coverage** — which road segments were queried as proxies
- **Noise parameters** — the std % applied per approach
- **Day type segmentation** — how weekday / weekend splits were defined
- **No incident events in baseline clip** — the count assumes normal flow; anomalies in the clip will inflate the baseline

---

## Limitations

- Google congestion ratios reflect **area-level road patterns**, not this specific intersection. Local geometry (turning volumes, pedestrian crossings, nearby schools) is not captured.
- The method produces **volume estimates only** — it does not generate turning movement counts, lane-level splits, or speed data without additional assumptions.
- Synthetic data cannot replicate **rare events** (accidents, road works, weather) unless deliberately injected.

---

*Phase 1 Technical Methodology — 9XAI Hackathon, AI-Based Traffic Monitoring and Forecasting*
