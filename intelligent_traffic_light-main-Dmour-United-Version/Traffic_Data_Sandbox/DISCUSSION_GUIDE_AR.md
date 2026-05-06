# Discussion Guide (Arabic) - Traffic Data Sandbox

## 1) Quick Story You Can Say in 60-90 Seconds
We built a **Phase 1 Traffic Data Sandbox** for **Wadi Saqra intersection** using a real detector export (`Traffic Volume_almanhal.txt`) as the base.
The original source had 14 approaches with 15-minute counts over 8 days, but the hackathon requires a 22-detector site model.
So we did three things:
1. Parsed and normalized the real file into clean time-series format.
2. Reconstructed missing/unavailable detector values using realistic donor profiles and time-of-day behavior.
3. Expanded the site from 14 to 22 detectors and generated demand-aware signal timing logs (cycle length 125-180 sec).

Result: a complete, structured sandbox package ready for forecasting, incident analytics, and later video integration.

---

## 2) What Exactly Was Delivered
Folder: `Traffic_Data_Sandbox/`

1. `detector_data/`:
22 CSV files, one per detector (`detector_01.csv` ... `detector_22.csv`)
Columns: `timestamp, detector_id, approach_id, vehicle_count`

2. `signal_logs/`:
`signal_timing_logs.csv`
Columns: `timestamp, intersection_id, phase_number, signal_state`

3. `metadata/`:
`metadata.json` + `metadata.yaml`
Includes camera location/FOV, lane configuration, approach labels, stop lines, monitoring zones.

4. `annotations/`:
`incident_annotations.csv`, `congestion_events.json`, `sample_annotations_README.md`

5. Documentation:
`README.md`, `methodology.md`, `data_dictionary.md`

6. `live_stream/README.md`:
placeholder only (no videos, as required for Phase 1).

---

## 3) Source Data Facts (Important for Credibility)
From `Traffic Volume_almanhal.txt`:

1. Date coverage: `2023-12-30` to `2024-01-06` (8 days).
2. Granularity: 15-minute bins.
3. Approaches in source: 14.
4. Total source cells: `10,752` (8 days x 14 approaches x 96 intervals/day).
5. Missing/unavailable entries (`DA`): `1,201` cells (`11.17%`).
6. Critical reliability issue in source:
- Approach 2: `480/768` missing (`62.5%`).
- Approach 14: `721/768` missing (`93.88%`).

This is why reconstruction/imputation was necessary and justified.

---

## 4) Why These Data Design Choices Were Made
### A) Why 15-minute aggregation?
Because the handbook explicitly expects detector-count exports at 15-minute resolution, and this also matches common traffic operations reporting.

### B) Why reconstruct missing data instead of leaving zeros?
Leaving zeros would create false low-demand behavior and break model realism.
We used profile-based reconstruction to preserve peak shapes and weekday/weekend patterns.

### C) Why expand from 14 to 22 detectors?
The requirement is a 22-detector site assumption.
So we produced 8 extra detector streams as lane-level derivatives of real streams.

### D) Why signal logs are synthetic?
We do not have controller raw logs in the provided source.
So we generated **demand-aware** signal events that remain operationally realistic (adaptive cycle + phase splits).

---

## 5) How The Data Was Built (Step-by-Step)
### Step 1: Parse and Normalize
Converted the text report structure (`:15/:30/:45/:60` rows with hourly columns) into standard timestamp rows at:
`HH:00`, `HH:15`, `HH:30`, `HH:45`.

### Step 2: Handle Missing/DA
1. Built time-slot medians (weekday + hour + quarter) where data existed.
2. Used donor logic for sparse approaches:
- Approach 2 reconstructed from Approach 1 profile.
- Approach 14 reconstructed from Approach 13 with low-volume auxiliary scaling.
3. Added bounded stochastic variation (deterministic seed) to avoid flat synthetic curves.

### Step 3: Expand to 22 Detectors
Created detectors 15-22 by calibrated scaling from real detector behavior:
1. Det 15 from App1 (scale ~0.62)
2. Det 16 from App5 (scale ~0.57)
3. Det 17 from App7 (scale ~0.55)
4. Det 18 from App12 (scale ~0.50)
5. Det 19 from App4 (scale ~0.38)
6. Det 20 from App6 (scale ~0.42)
7. Det 21 from App9 (scale ~0.52)
8. Det 22 from App11 (scale ~0.50)

Morning/evening boosts were applied to reflect lane movement behavior in peak periods.

### Step 4: Generate Signal Timing Logs
1. Grouped detectors into 4 signal phases.
2. Calculated phase demand per 15-minute slot.
3. Adaptive cycle length: `125-180 sec`.
4. Green time allocated proportional to phase demand, with minimum green + fixed yellow.
5. Logged events as:
`GREEN ON -> YELLOW ON -> RED ON`.

### Step 5: Add Metadata + Annotation Layer
Added site context and starter ground truth for incidents and congestion windows to support later AI training and validation.

---

## 6) Output Quality Snapshot (Numbers You Can Mention)
1. Detector files: `22`
2. Rows per detector file: `769` including header (`768` data points)
3. Detector temporal range: `2023-12-30 00:00:00` to `2024-01-06 23:45:00`
4. Signal events: `51,828`
5. Signal cycle stats:
- Min cycle: `125 sec`
- Max cycle: `180 sec`
- Average cycle: `160.03 sec`

6. Peak network 15-min volume in generated sandbox:
`2024-01-02 08:45:00` with total `1209` vehicles (sum across detectors).

7. Top detectors by total volume over the period:
- Detector 12: `44,877`
- Detector 7: `43,978`
- Detector 5: `40,639`
- Detector 13: `36,069`
- Detector 6: `36,064`

---

## 7) What You Can Say About Realism
Use these points in discussion:

1. The sandbox is **data-anchored**, not random.
It starts from real field-style exports and preserves demand signatures.

2. Missing data was treated as an engineering reliability issue.
We did controlled reconstruction, not blind interpolation.

3. Detector expansion is operationally plausible.
Extra detectors represent lane splits/auxiliary movements with directional peak behavior.

4. Signal logs are traffic-responsive.
Higher demand windows produce longer effective green and higher cycle lengths.

---

## 8) Limitations (Be Transparent)
1. No CCTV files are included yet (intentionally out of Phase 1 scope).
2. Signal logs are synthetic demand-aware logs, not direct controller exports.
3. Some geometry in metadata is deployment-ready but not survey-grade CAD.
4. Added detectors (15-22) are modeled streams, not physical loop downloads.

Being clear about limitations increases credibility.

---

## 9) Expected Questions and Strong Answers
### Q1: Why did you not keep DA as missing?
A1: Because forecasting and control logic need continuous time-series. We reconstructed using observed demand profiles and donor approaches so that peak/off-peak dynamics remain realistic.

### Q2: Why this specific expansion to detectors 15-22?
A2: The handbook requires 22 detector assumptions. We mapped extra detectors to lane-level behavior of high-confidence source detectors with calibrated split factors and peak-hour boosts.

### Q3: Is this ready for model training?
A3: Yes for Phase 1 baseline training/simulation. For production-grade training, the next step is to align with video-derived labels and controller exports.

### Q4: How do you prove the signal logs are realistic?
A4: Cycle lengths are constrained in a realistic operational band (125-180 sec) and green splits are demand-proportional by phase, so behavior follows traffic load changes.

### Q5: What is the practical value today?
A5: It enables forecasting experiments, congestion analysis, and architecture integration before live streams are connected.

---

## 10) What You Will Do Next (Roadmap You Can Present)
### Immediate next (Phase 2 prep)
1. Build baseline forecasting model per approach and per phase.
2. Validate detector trend consistency (weekday/weekend + AM/PM peaks).
3. Add feature engineering:
- lag features
- rolling averages
- phase-state alignment features

### Integration next
1. Connect sandbox output to dashboard APIs.
2. Add model monitoring metrics (MAE/RMSE, drift checks).
3. Prepare ingestion contracts for future live stream/video analytics.

### Phase 3 direction
1. Real-time incident detection with video + detector fusion.
2. Adaptive signal recommendation logic.
3. Operator-facing alerts and decision support.

---

## 11) 2-Minute Presentation Script (Arabic)
\"في Phase 1 ركزنا على بناء Traffic Data Sandbox كامل لتقاطع وادي صقرة، بدون فيديوهات حسب المطلوب.
اعتمدنا على ملف حقيقي من حساسات المنهل كقاعدة، وكان فيه تغطية 8 أيام بدقة 15 دقيقة و14 approach.
واجهتنا مشكلة مهمة: فيه DA بنسبة 11.17% من المصدر، خاصة Approach 2 و14.
عشان نحافظ على واقعية السلوك المروري، عملنا reconstruction مبني على أنماط فعلية من الداتا نفسها، مع ضبط ذكي لفروق الوقت واليوم.
بعدها وسعنا النموذج من 14 إلى 22 detector مثل متطلبات الـ handbook، باستخدام lane-split profiles واقعية.
كمان ولدنا signal timing event logs بشكل demand-aware مع cycle length بين 125 و180 ثانية.
النتيجة حزمة كاملة جاهزة للاستخدام في forecasting, congestion analysis, وتهيئة الدمج لاحقا مع الفيديو والأنظمة الحية.\"

---

## 12) Files to Open During Discussion
1. `README.md` for package overview.
2. `methodology.md` for technical process.
3. `data_dictionary.md` for schema details.
4. `signal_logs/signal_timing_logs.csv` for phase event behavior.
5. `metadata/metadata.yaml` for site assumptions and geometry.
6. This guide: `DISCUSSION_GUIDE_AR.md`.

