# Methodology

## 1) Source Ingestion and Parsing
The primary source was `Traffic Volume_almanhal.txt`, a field-style detector export with 15-minute bins presented as four quarter rows (`:15`, `:30`, `:45`, `:60`) across hourly columns (`00` to `23`).

Processing steps:
1. Parsed day headers from `Saturday, 30 December 2023` through `Saturday, 06 January 2024`.
2. Parsed detector blocks for approaches `1` to `14`.
3. Converted each table cell into a normalized timestamp at 15-minute interval starts (`HH:00`, `HH:15`, `HH:30`, `HH:45`).
4. Interpreted `DA` entries as missing values.

Output coverage after parsing:
- Date range: `2023-12-30 00:00:00` to `2024-01-06 23:45:00`
- Resolution: 15 minutes
- Base approaches: 14
- Expanded detectors: 22

## 2) Missing Data and Reliability Treatment
The source contains detector outages and placeholders (notably in approaches 2 and 14).

Imputation logic:
1. Built per-approach slot medians by weekday/time-of-day where available.
2. Applied donor-based reconstruction where coverage was insufficient:
   - Approach 2 reconstructed from Approach 1 profile.
   - Approach 14 reconstructed from Approach 13 as low-volume auxiliary movement.
3. Applied bounded stochastic variation (deterministic seeded noise) to avoid flat synthetic traces.
4. Kept values non-negative and integer-valued.

Why this is realistic:
- Preserves original peak-hour shape from real detector profiles.
- Retains day-of-week and time-of-day traffic dynamics.
- Produces operationally plausible values for unavailable detectors.

## 3) Expansion to 22 Detectors
The handbook expectation is a 22-detector site model. The source provides 14 detector streams, so detectors `15` to `22` were generated as lane-level/auxiliary derivatives of real detector streams.

Expansion strategy:
1. Assigned each new detector to an existing approach movement.
2. Applied lane split factors (roughly 0.38 to 0.62) calibrated by movement type.
3. Added targeted morning/evening boost factors for movement realism.
4. Added low-amplitude random variation to prevent perfect proportionality.

Result:
- 22 CSV files (`detector_01.csv` ... `detector_22.csv`)
- Uniform schema and aligned timestamps for all detectors.

## 4) Signal Timing Log Generation
A synthetic event log was generated in `signal_timing_logs.csv` with second-level timestamps and four phases.

Generation logic:
1. Mapped detectors to four operational phase groups.
2. Computed 15-minute phase demand from detector volumes.
3. Set adaptive cycle length between 120 and 180 seconds based on current demand magnitude.
4. Allocated green split proportionally with minimum green constraints and fixed yellow interval.
5. Emitted event sequence for each phase: `GREEN ON` -> `YELLOW ON` -> `RED ON`.

Behavioral outcome:
- Longer effective green during demand peaks.
- Shorter effective green in off-peak windows.
- Full temporal coverage matching detector period.

## 5) Wadi Saqra Site Assumptions
To anchor the sandbox to Wadi Saqra operations, the following practical assumptions were used:
1. Urban, high-demand arterial intersection with strong PM pressure.
2. Multi-lane through movements and protected turning pockets.
3. Queue spillback monitoring zones on all major approaches.
4. Camera geometry and stop-line coordinates represented in pixel space for future video annotation alignment.

## 6) Annotation Layer Design
Two complementary annotation assets were created:
1. `incident_annotations.csv` for event-level incident examples.
2. `congestion_events.json` for threshold-based congestion windows.

These are starter ground-truth layers designed for later synchronization with CCTV clips and frame-level labels.

## 7) Limitations
1. No video streams are included in this Phase 1 package (intentionally out of scope).
2. Signal logs are synthetic but demand-aware, not direct controller exports.
3. Geometry is deployment-ready metadata but not survey-grade CAD.
4. Detector 15-22 are statistically realistic expansions, not physical loop exports.

## 8) Reusability for Other Intersections
This pipeline can be replicated for another site by replacing:
1. The source detector export file.
2. Site-specific lane and approach mapping in metadata.
3. Detector-to-phase mapping for signal log generation.
4. Zone polygons and stop-line references for annotations.

The same folder structure and schemas remain valid, enabling fast scaling across intersections.
