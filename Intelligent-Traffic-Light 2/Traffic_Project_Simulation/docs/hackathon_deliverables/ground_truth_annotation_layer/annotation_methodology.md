# Annotation Methodology — Wadi Saqra Intelligent Traffic Light

## 1. Annotation Production Process

Annotations for the Wadi Saqra Intelligent Traffic Light project were produced using a hybrid approach that combines automated model outputs with manual review and simulation-based ground truth. The primary tool for vehicle and event detection was the YOLOv26x object detection model, which was run on all video frames to generate initial bounding boxes, class labels, and confidence scores. These outputs were then cross-validated by human annotators using a custom annotation interface, ensuring that ambiguous or low-confidence detections were either corrected or discarded. For incident and congestion events, SUMO microsimulation was used to generate synthetic ground truth, especially for rare or safety-critical scenarios (e.g., wrong-way driving, queue spillback) that are difficult to capture in real-world footage. All annotations were timestamped in UTC ISO8601 format and mapped to the intersection’s defined approach and zone geometry.

## 2. Annotation Categories and Rationale

- **Vehicle Detection**: Captures all moving objects of interest (car, truck, bus, motorcycle, van) to enable accurate traffic flow measurement and tracking. This is foundational for all downstream analytics.
- **Incident Events**: Includes stalled vehicles, abnormal stops, wrong-way driving, unexpected trajectories, queue spillback, and sudden congestion. These events are critical for operational safety and for evaluating the system’s ability to detect and respond to real-world hazards.
- **Congestion Events**: Encodes the level of congestion (free flow, mild, moderate, severe) on each approach, with associated queue lengths and average speeds. This supports both real-time monitoring and ML model training.
- **Queue Spillback**: Specifically tracks when queues exceed the monitoring zone, a key metric for intersection performance and signal timing optimization.

Each category was chosen to reflect the operational realities of the Wadi Saqra intersection and to align with the hackathon’s evaluation criteria for safety, efficiency, and explainability.

## 3. Quality Control Process

All automated detections were subject to a two-stage quality control process:
- **Confidence Thresholding**: Only detections with a model confidence above 0.72 were accepted for further review. Detections between 0.72 and 0.80 were flagged for manual inspection.
- **Manual Review**: Human annotators reviewed all flagged and a random sample of high-confidence detections, correcting class labels, bounding boxes, and event types as needed. Ambiguous cases were discussed among annotators and, if consensus could not be reached, were excluded from the validation set.
- **Cross-Validation with SUMO**: For synthetic events, SUMO simulation logs were used as the ground truth reference. Annotators verified that the simulated event matched the annotation in both timing and location.

## 4. Limitations

While the annotation process aimed for high accuracy, several limitations remain:
- **Synthetic Data**: Many rare or hazardous events were generated using SUMO simulation rather than real-world footage. While this ensures coverage, it may not capture all the visual variability of real incidents.
- **Manual Review Scope**: Due to time and resource constraints, not every detection was manually reviewed. Some low-confidence or edge-case events may be underrepresented.
- **Single Camera View**: All annotations are based on a single camera perspective, which may miss occluded or out-of-frame events.
- **Class Imbalance**: Some event types (e.g., wrong-way driving) are rare, leading to limited real examples and reliance on simulation.

A full-scale annotation campaign with multi-camera coverage and more extensive manual review would further improve dataset quality and generalizability.

## 5. Validation Approach

The annotated validation set was used to evaluate the performance of the YOLO26x detection model, the incident detection pipeline, and the congestion classification logic. Model precision, recall, and F1 scores were computed for each event type using the validation set as ground truth. For synthetic events, SUMO logs provided the reference, while for real detections, manual review served as the gold standard. The validation set also informed the tuning of confidence thresholds and the calibration of the anomaly detection module. Results were used to benchmark the system against hackathon targets and to identify areas for further improvement.