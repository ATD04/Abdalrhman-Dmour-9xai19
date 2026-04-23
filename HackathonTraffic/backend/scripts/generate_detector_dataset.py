import csv
import os
import random
from datetime import datetime, timedelta

# Configuration
BASELINE_CSV = "../data_sandbox/detector/baseline_video_count.csv"
RATIOS_DIR = "../data_sandbox/detector/congestion_ratios"
OUTPUT_DIR = "../data_sandbox/detector/generated"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "traffic_detector_dataset.csv")

START_DATE = datetime(2024, 1, 1, 0, 0) # A Monday
DAYS_TO_GENERATE = 14
NOISE_STD_PCT = 0.08 # 8% standard deviation for realism
SEED = 42

def load_baseline():
    rates = {}
    with open(BASELINE_CSV, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rates[row["Approach"]] = float(row["Rate_Veh_Per_Min"])
    return rates

def load_ratios():
    ratios = {}
    for day_type in ["weekday", "saturday", "sunday_holiday"]:
        filename = os.path.join(RATIOS_DIR, f"{day_type}_ratios.csv")
        day_data = {}
        with open(filename, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                hour = int(row["Hour"].split(':')[0])
                day_data[hour] = float(row["Ratio"])
        ratios[day_type] = day_data
    return ratios

def get_day_type(dt):
    # In Jordan context, weekend is Friday/Saturday. 
    # For generic compliance with the instruction (Weekday, Saturday, Sunday), we use:
    # 0-4 (Mon-Fri) = Weekday, 5 (Sat) = Saturday, 6 (Sun) = Sunday_Holiday
    # Wait, standard Python weekday(): Monday is 0 and Sunday is 6.
    wd = dt.weekday()
    if wd <= 4:
        return "weekday"
    elif wd == 5:
        return "saturday"
    else:
        return "sunday_holiday"

def add_noise(base_count, std_pct):
    if base_count <= 0:
        return 0
    noise = random.gauss(0, base_count * std_pct)
    return max(0, round(base_count + noise))

def generate_dataset():
    random.seed(SEED)
    rates = load_baseline()
    ratios = load_ratios()
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    records = []
    current_time = START_DATE
    end_time = START_DATE + timedelta(days=DAYS_TO_GENERATE)
    
    detector_map = {
        "North": "DET_N_01",
        "South": "DET_S_01",
        "East": "DET_E_01",
        "West": "DET_W_01"
    }

    while current_time < end_time:
        hour = current_time.hour
        day_type = get_day_type(current_time)
        ratio = ratios[day_type][hour]
        
        timestamp_str = current_time.strftime("%Y-%m-%d %H:%M")
        
        for approach, rate_per_min in rates.items():
            # Flow(approach, hour, day) = BaselineRate(approach) * Ratio(hour, day) * 15
            base_count = rate_per_min * ratio * 15
            final_count = add_noise(base_count, NOISE_STD_PCT)
            
            records.append({
                "timestamp": timestamp_str,
                "intersection_id": "INT_001",
                "approach": approach,
                "detector_id": detector_map[approach],
                "vehicle_count": final_count,
                "day_type": day_type.capitalize()
            })
            
        current_time += timedelta(minutes=15)
        
    with open(OUTPUT_FILE, 'w', newline='') as f:
        fieldnames = ["timestamp", "intersection_id", "approach", "detector_id", "vehicle_count", "day_type"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in records:
            writer.writerow(row)
            
    print(f"Successfully generated {OUTPUT_FILE} with {len(records)} records (15-min resolution over {DAYS_TO_GENERATE} days).")

if __name__ == "__main__":
    generate_dataset()
