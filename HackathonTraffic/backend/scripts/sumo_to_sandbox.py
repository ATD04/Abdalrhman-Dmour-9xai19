import xml.etree.ElementTree as ET
import pandas as pd
import json
import os
from datetime import datetime, timedelta

def parse_sumo_to_sandbox(sumo_path, sandbox_path):
    # 1. Update detector_counts.csv
    detector_xml = os.path.join(sumo_path, "detector_output_xml.xml")
    if os.path.exists(detector_xml):
        tree = ET.parse(detector_xml)
        root = tree.getroot()
        
        data = []
        start_time = datetime.strptime("2024-05-20 00:00:00", "%Y-%m-%d %H:%M:%S")
        
        for interval in root.findall("interval"):
            begin = float(interval.get("begin"))
            detector_id = interval.get("id")
            count = int(interval.get("nVehContrib", 0))
            
            # Format timestamp for 15-min intervals
            ts = start_time + timedelta(seconds=begin)
            data.append({
                "timestamp": ts.strftime("%Y-%m-%d %H:%M:%S"),
                "detector_id": detector_id,
                "vehicle_count": count
            })
            
        df = pd.DataFrame(data)
        df.sort_values(["timestamp", "detector_id"], inplace=True)
        df.to_csv(os.path.join(sandbox_path, "detector/detector_counts.csv"), index=False)
        print("Updated detector_counts.csv")

    # 2. Update spatial_annotations.json (Mocking bounding boxes from FCD)
    fcd_xml = os.path.join(sumo_path, "fcd_output.xml")
    if os.path.exists(fcd_xml):
        # We only take a snapshot for the demo to avoid huge file sizes
        tree = ET.parse(fcd_xml)
        root = tree.getroot()
        
        annotations = []
        # Capture first 10 steps of vehicles near the intersection
        for timestep in root.findall("timestep")[:10]:
            time = float(timestep.get("time"))
            for veh in timestep.findall("vehicle"):
                annotations.append({
                    "timestamp": time,
                    "vehicle_id": veh.get("id"),
                    "x_coord": float(veh.get("x")),
                    "y_coord": float(veh.get("y")),
                    "speed": float(veh.get("speed")),
                    "type": veh.get("type"),
                    "bbox": [float(veh.get("x")) - 2, float(veh.get("y")) - 2, 4, 4] # Mock bbox
                })
        
        with open(os.path.join(sandbox_path, "annotations/spatial_annotations.json"), "w") as f:
            json.dump(annotations, f, indent=2)
        print("Updated spatial_annotations.json")

if __name__ == "__main__":
    SUMO_DIR = "/Users/atd04/Documents/GitHub/Abdalrhman-Dmour-9xai19/HackathonTraffic/data_sandbox/simulation/sumo"
    SANDBOX_DIR = "/Users/atd04/Documents/GitHub/Abdalrhman-Dmour-9xai19/HackathonTraffic/data_sandbox"
    parse_sumo_to_sandbox(SUMO_DIR, SANDBOX_DIR)
