# Sample Annotation Guidelines

This folder includes starter annotation files for incident and congestion labeling.

## Files
- `incident_annotations.csv`: point-in-time and interval incident tags.
- `congestion_events.json`: machine-generated congestion windows based on detector load.

## Future Video Labeling Convention
- Video clips should be named: `WadiSaqra_<camera_id>_<YYYYMMDD>_<HHMMSS>.mp4`
- Frame-level annotation exports should be named: `WadiSaqra_<camera_id>_<YYYYMMDD>_<HHMMSS>_frames.json`
- Zone overlays should reference `metadata/metadata.json -> monitoring_zones`.

## Recommended Label Taxonomy
- `stalled_vehicle`
- `abnormal_stopping`
- `queue_spillback`
- `near_miss`
- `illegal_turn`

## QA Process
1. Run automated pre-labeling from detector and trajectory hints.
2. Analyst performs manual review in 2x speed mode.
3. Supervisor validates high-severity cases.
4. Export final labels in CSV/JSON and archive in this folder.
