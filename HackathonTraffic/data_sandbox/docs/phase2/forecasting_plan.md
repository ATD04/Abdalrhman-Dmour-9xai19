# Traffic Flow Forecasting (TFF) Plan — Phase 2

This module provides predictive insights by analyzing historical demand and current signal patterns to anticipate congestion before it occurs.

---

## 1. Input Requirements (Phase 1 Artifacts)
- **Primary Data**: `detector/forecasting_ready/demand_forecast_source.csv`.
- **Features**: `feature_definitions.json` (defines weekday, holiday, and peak flags).
- **Live Context**: Normalized 1-minute counts from the DAL.

---

## 2. Core Build Tasks

### **Task A: Model Training (Quick Build)**
- **Approach**: Train a **Gradient Boosted Tree (XGBoost)** or **Prophet** model on the 24-hour sandbox dataset.
- **Features**:
    - `time_of_day` (sin/cos encoding).
    - `is_weekday` (Boolean).
    - `is_peak` (Boolean).
    - `lagged_volume` (t-15, t-30, t-60 minutes).
- **Target**: `vehicle_count` for the next 15, 30, and 60 minutes.

### **Task B: Signal-Aware Refinement**
- **Action**: Incorporate the current signal phase and cycle length into the short-term (15-min) forecast.
- **Logic**: If the current cycle is shorter than usual (indicating high clearance priority), adjust the predicted discharge rate.

### **Task C: Inference Service**
- **Action**: Build an API endpoint that takes the last 60 minutes of "Live" data from the DAL and returns a forecasted trend for the next hour.
- **Output**: Conform to `forecast_output_schema.json`.

---

## 3. Forecasting Horizons
| Horizon | Primary Driver | Phase 2 Goal |
|---|---|---|
| **15 Minutes** | Current Lane Occupancy | High Precision (Tactical) |
| **30 Minutes** | Inbound Approach Trends | Medium Precision (Operational) |
| **60 Minutes** | Time-of-Day Seasonality | General Trend (Strategic) |

---

## 4. Evaluation Metrics
- **MAPE (Mean Absolute Percentage Error)**: Target < 15% for normal conditions.
- **RMSE (Root Mean Square Error)**: Focus on penalizing large misses during peak hour transitions.
- **Inference Speed**: <500ms per prediction request.
