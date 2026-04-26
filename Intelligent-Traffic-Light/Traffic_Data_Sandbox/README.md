# Traffic Data Sandbox - Wadi Saqra (Phase 1)

## Table of Contents
1. Overview
2. Package Structure
3. Dataset Coverage
4. Quick Start
5. File Descriptions
6. Notes

## 1) Overview
This package delivers the full Phase 1 Traffic Data Sandbox (excluding video assets) for the 9XAI Hackathon first-site build.

Intersection: `Wadi_Saqra` (Amman, Jordan)

Core outputs included:
- 22 detector CSV files (15-minute counts)
- Signal timing event log CSV (phase state transitions)
- Metadata pack (JSON + YAML)
- Annotation starter layer (CSV + JSON + labeling README)
- Data dictionary and methodology documentation

## 2) Package Structure
```text
Traffic_Data_Sandbox/
├── detector_data/                  # 22 detector CSV files
├── signal_logs/                    # signal_timing_logs.csv
├── metadata/                       # metadata.json + metadata.yaml
├── annotations/                    # incident/congestion annotation samples
├── live_stream/                    # placeholder only (no video files)
├── data_dictionary.md
├── methodology.md
└── README.md
```

## 3) Dataset Coverage
- Detector date range: `2023-12-30 00:00:00` to `2024-01-06 23:45:00`
- Time resolution: `15 minutes`
- Detector files: `22`
- Signal events: `51828` rows
- Intersection ID: `Wadi_Saqra`

## 4) Quick Start
1. Open `detector_data/` and load detector CSVs in any analytics tool (Python, R, Excel, BI).
2. Join detector streams by `timestamp` for multi-approach demand modeling.
3. Use `signal_logs/signal_timing_logs.csv` for phase-aware forecasting or timing analysis.
4. Use `metadata/` to map approaches, lanes, zones, and stop lines.
5. Use `annotations/` as seed labels for incident and congestion model training.

## 5) File Descriptions
- `detector_data/detector_XX.csv`: Per-detector 15-minute traffic counts.
- `signal_logs/signal_timing_logs.csv`: Event-based phase state log (`GREEN ON`, `YELLOW ON`, `RED ON`).
- `metadata/metadata.json` and `metadata/metadata.yaml`: Site metadata and monitoring geometry.
- `annotations/incident_annotations.csv`: Sample incident intervals and labels.
- `annotations/congestion_events.json`: Auto-generated high-demand windows.
- `annotations/sample_annotations_README.md`: Annotation naming and QA guidance.
- `data_dictionary.md`: Column-level schema reference.
- `methodology.md`: Detailed build and transformation process.
- `DISCUSSION_GUIDE_AR.md`: Arabic discussion brief with talking points and Q&A.

## 6) Notes
- No video streams are included in this Phase 1 package by design.
- All timestamps use local site time (`Asia/Amman`).
- The detector expansion to 22 streams is calibrated from real source patterns in `Traffic Volume_almanhal.txt`.
