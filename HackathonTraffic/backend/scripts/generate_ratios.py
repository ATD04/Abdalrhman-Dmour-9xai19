import csv
import os

OUTPUT_DIR = "../data_sandbox/detector/congestion_ratios"

# Typical urban weekday curve, normalized to 12:00 = 1.0
weekday_ratios = [
    (0, 0.1), (1, 0.05), (2, 0.05), (3, 0.05), (4, 0.1), (5, 0.2), 
    (6, 0.6), (7, 1.4), (8, 1.9), (9, 1.5), (10, 1.2), (11, 1.1),
    (12, 1.0), (13, 1.0), (14, 1.3), (15, 1.5), (16, 1.7), (17, 1.8),
    (18, 1.5), (19, 1.1), (20, 0.7), (21, 0.5), (22, 0.4), (23, 0.2)
]

# Saturday curve: later morning peak, high afternoon, evening activity
saturday_ratios = [
    (0, 0.3), (1, 0.2), (2, 0.1), (3, 0.1), (4, 0.1), (5, 0.1), 
    (6, 0.2), (7, 0.4), (8, 0.7), (9, 1.0), (10, 1.2), (11, 1.3),
    (12, 1.0), (13, 1.1), (14, 1.3), (15, 1.3), (16, 1.2), (17, 1.2),
    (18, 1.4), (19, 1.5), (20, 1.4), (21, 1.2), (22, 0.9), (23, 0.6)
]

# Sunday/Holiday curve (Jordan context where Friday is weekend, but we follow standard generic nomenclature as requested, assuming typical rest day curve)
sunday_ratios = [
    (0, 0.4), (1, 0.3), (2, 0.2), (3, 0.1), (4, 0.1), (5, 0.1), 
    (6, 0.1), (7, 0.2), (8, 0.3), (9, 0.5), (10, 0.7), (11, 0.9),
    (12, 1.0), (13, 1.1), (14, 1.2), (15, 1.2), (16, 1.1), (17, 1.1),
    (18, 1.2), (19, 1.1), (20, 1.0), (21, 0.8), (22, 0.6), (23, 0.4)
]

def write_ratios(filename, data):
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(["Hour", "Ratio"])
        for hour, ratio in data:
            # Ensure 12:00 is exactly 1.0
            if hour == 12 and ratio != 1.0:
                print(f"WARNING: Hour 12 ratio is not 1.0 in {filename}")
            writer.writerow([f"{hour:02d}:00", ratio])
    print(f"Generated {filepath}")

write_ratios("weekday_ratios.csv", weekday_ratios)
write_ratios("saturday_ratios.csv", saturday_ratios)
write_ratios("sunday_holiday_ratios.csv", sunday_ratios)

