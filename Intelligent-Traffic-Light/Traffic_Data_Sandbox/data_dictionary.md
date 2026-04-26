# Data Dictionary

## detector_data/detector_XX.csv
- `timestamp`: Interval start timestamp in local time (`Asia/Amman`) at 15-minute granularity.
- `detector_id`: Unique detector identifier (`1` to `22`).
- `approach_id`: Logical approach mapped to movement group at Wadi Saqra.
- `vehicle_count`: Aggregated vehicle count observed during the 15-minute interval.

## signal_logs/signal_timing_logs.csv
- `timestamp`: Signal event timestamp (second-level precision).
- `intersection_id`: Fixed value `Wadi_Saqra`.
- `phase_number`: Signal phase identifier (`1` to `4`).
- `signal_state`: Phase event state (`GREEN ON`, `YELLOW ON`, `RED ON`).

## metadata/metadata.json and metadata/metadata.yaml
- `intersection_id`: Canonical intersection key.
- `site_name`: Human-readable site name.
- `camera_location.latitude`: Camera latitude in decimal degrees.
- `camera_location.longitude`: Camera longitude in decimal degrees.
- `camera_location.altitude_m`: Camera pole elevation above sea level.
- `camera_location.reference`: Field installation reference.
- `field_of_view.camera_id`: Camera ID used in future video and annotation files.
- `field_of_view.azimuth_deg`: Horizontal viewing direction in degrees.
- `field_of_view.tilt_deg`: Camera tilt angle in degrees.
- `field_of_view.horizontal_fov_deg`: Horizontal field-of-view angle.
- `field_of_view.vertical_fov_deg`: Vertical field-of-view angle.
- `field_of_view.resolution`: Video resolution target.
- `field_of_view.frame_rate_fps`: Frame rate target.
- `field_of_view.coverage_distance_m.near`: Approximate near coverage distance.
- `field_of_view.coverage_distance_m.far`: Approximate far coverage distance.
- `lane_configurations.approach_X.movement`: Movement description for each approach.
- `lane_configurations.approach_X.lane_count`: Number of lanes represented by approach.
- `approach_labels`: Stable text labels for approaches `1` to `14`.
- `stop_line_positions`: Pixel-space stop-line references for calibration.
- `monitoring_zones`: Queue spillback polygon zones used for annotations.
- `site_description`: Short operational description.
- `temporal_coverage.start`: Start of detector dataset.
- `temporal_coverage.end`: End of detector dataset.
- `temporal_coverage.timezone`: Timezone of all timestamps.
- `temporal_coverage.interval`: Detector sampling interval.
- `data_sources.base_sensor_file`: Original field-export source file name.
- `data_sources.processing_method`: Summary of transformation and expansion logic.

## annotations/incident_annotations.csv
- `incident_id`: Unique incident identifier.
- `start_timestamp`: Incident start timestamp.
- `end_timestamp`: Incident end timestamp.
- `incident_type`: Incident class label.
- `approach_id`: Primary impacted approach.
- `detector_ids`: Semicolon-separated detector IDs linked to the event.
- `severity`: Operational severity (`low`, `medium`, `high`).
- `validation_status`: Review status (`analyst_reviewed`, `pending_video_verification`).
- `description`: Free-text analyst note.

## annotations/congestion_events.json
- `intersection_id`: Canonical intersection key.
- `events`: List of congestion windows.
- `events[].event_id`: Unique congestion event ID.
- `events[].start_timestamp`: Congestion window start.
- `events[].end_timestamp`: Congestion window end.
- `events[].duration_minutes`: Event duration in minutes.
- `events[].severity`: Event severity class.
- `events[].peak_network_volume`: Maximum total detector volume during event.
- `events[].dominant_approaches`: Top loaded approaches in event window.
- `events[].related_phases`: Signal phases most affected.
- `events[].notes`: Event generation note.
