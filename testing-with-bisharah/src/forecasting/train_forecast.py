"""
XGBoost Traffic Forecaster
---------------------------
Trains one model per direction to predict vehicle count
15 / 30 / 60 minutes ahead.

Usage:
  python3 src/forecasting/train_forecast.py        # train and save models
  python3 src/forecasting/train_forecast.py --pred  # load models and predict
"""

import sqlite3
import pandas as pd
import numpy as np
import pickle
import os
import sys
from datetime import datetime
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error

DB_PATH    = "Data/traffic.db"
MODELS_DIR = "models"
DIRECTIONS = ["North", "South", "East", "West"]
HORIZONS   = [15, 30, 60]   # minutes ahead to predict

os.makedirs(MODELS_DIR, exist_ok=True)

# ── Load data from DB ─────────────────────────────────────────────────────────
def load_data():
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql("SELECT * FROM detector_readings ORDER BY timestamp", conn)
    conn.close()

    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp")
    return df

# ── Build features for one direction ─────────────────────────────────────────
def build_features(df, direction):
    """
    For each row, build lag features (past counts) + time features.
    Target: vehicle_count N minutes ahead.
    """
    d = df[df["direction"] == direction].copy()
    d = d.set_index("timestamp").resample("15min")["vehicle_count"].sum().reset_index()
    d.columns = ["timestamp", "count"]

    if len(d) < 5:
        return None

    # Lag features: counts from t-1, t-2, t-3, t-4 windows
    for lag in range(1, 5):
        d[f"lag_{lag}"] = d["count"].shift(lag)

    # Time features
    d["hour"]       = d["timestamp"].dt.hour
    d["day_of_week"]= d["timestamp"].dt.dayofweek
    d["is_weekend"] = (d["day_of_week"] >= 5).astype(int)

    d = d.dropna()
    return d

# ── Train models ──────────────────────────────────────────────────────────────
def train():
    df = load_data()

    if len(df) == 0:
        print("ERROR: No data in detector_readings table.")
        print("Run import_to_db.py first.")
        return

    print(f"Loaded {len(df)} rows from DB\n")
    results = {}

    for direction in DIRECTIONS:
        data = build_features(df, direction)

        if data is None:
            print(f"  [{direction}] Not enough data to train — skipping")
            continue

        feature_cols = [c for c in data.columns if c not in ["timestamp", "count"]]
        X = data[feature_cols]

        print(f"[{direction}] {len(data)} 15-min windows, {len(feature_cols)} features")
        results[direction] = {}

        for horizon in HORIZONS:
            # Target: count N steps ahead (each step = 15 min)
            steps = horizon // 15
            y = data["count"].shift(-steps)
            mask = y.notna()
            X_t, y_t = X[mask], y[mask]

            if len(X_t) < 4:
                print(f"  → {horizon}min: not enough rows")
                continue

            # Simple train/test split (last 20% = test)
            split = int(len(X_t) * 0.8)
            X_train, X_test = X_t.iloc[:split], X_t.iloc[split:]
            y_train, y_test = y_t.iloc[:split], y_t.iloc[split:]

            model = XGBRegressor(
                n_estimators=100,
                max_depth=4,
                learning_rate=0.1,
                random_state=42,
                verbosity=0,
            )
            model.fit(X_train, y_train)

            if len(X_test) > 0:
                preds = model.predict(X_test)
                mae = mean_absolute_error(y_test, preds)
                print(f"  → {horizon}min ahead:  MAE = {mae:.1f} vehicles")
            else:
                print(f"  → {horizon}min ahead:  trained (no test split)")

            # Save model
            path = os.path.join(MODELS_DIR, f"{direction}_{horizon}min.pkl")
            with open(path, "wb") as f:
                pickle.dump((model, feature_cols), f)
            results[direction][horizon] = model

    print(f"\n✓ Models saved to {MODELS_DIR}/")
    return results

# ── Predict next windows ──────────────────────────────────────────────────────
def predict_and_save():
    """Load latest counts from DB, run all models, save forecasts."""
    df = load_data()

    if len(df) == 0:
        print("No data available for prediction.")
        return

    conn = sqlite3.connect(DB_PATH)

    for direction in DIRECTIONS:
        data = build_features(df, direction)
        if data is None or len(data) == 0:
            continue

        # Use the most recent row as input
        latest = data.iloc[[-1]]
        feature_cols_base = [c for c in data.columns if c not in ["timestamp", "count"]]

        for horizon in HORIZONS:
            model_path = os.path.join(MODELS_DIR, f"{direction}_{horizon}min.pkl")
            if not os.path.exists(model_path):
                continue

            with open(model_path, "rb") as f:
                model, feature_cols = pickle.load(f)

            X_pred = latest[feature_cols]
            pred = int(max(0, round(model.predict(X_pred)[0])))

            conn.execute("""
                INSERT INTO forecasts (created_at, direction, horizon_minutes, predicted_count)
                VALUES (?, ?, ?, ?)
            """, (datetime.now().isoformat(), direction, horizon, pred))

            print(f"  [{direction}] +{horizon}min → {pred} vehicles")

    conn.commit()
    conn.close()
    print("✓ Forecasts saved to DB")

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if "--pred" in sys.argv:
        print("Running predictions...\n")
        predict_and_save()
    else:
        print("Training forecasting models...\n")
        train()
        print("\nNow running initial predictions...\n")
        predict_and_save()
