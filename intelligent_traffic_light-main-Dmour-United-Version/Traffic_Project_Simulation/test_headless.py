#!/usr/bin/env python3

import sys
from pathlib import Path
import random
import time

SIM_ROOT = Path("/Users/ahmadhasasneh/Desktop/Intelligent-Traffic-Light/Traffic_Project_Simulation")
sys.path.append(str(SIM_ROOT))
from scripts.core.live_support import sumolib

import traci

def run_test():
    sumo_binary = sumolib.checkBinary('sumo')
    cmd = [
        sumo_binary,
        "-c", str(SIM_ROOT / "sumo_scenarios" / "live" / "wadi_saqra_live.sumocfg"),
        "--no-step-log", "true",
        "--remote-port", "0"  # This makes traci pick a free port automatically? Wait, no. traci.start() picks port if not given.
    ]
    
    label = f"what_if_{random.randint(1000, 9999)}"
    print(f"Starting sumo with label {label}")
    
    # traci.start automatically finds a free port and launches the process.
    # To get the connection object, we just call traci.getConnection(label) after.
    # Wait, traci.start() needs just the cmd.
    traci.start([sumo_binary, "-c", str(SIM_ROOT / "sumo_scenarios" / "live" / "wadi_saqra_live.sumocfg")], label=label)
    conn = traci.getConnection(label)
    
    print("Connected to SUMO!")
    for step in range(10):
        conn.simulationStep()
    
    print("Simulated 10 steps.")
    conn.close()

if __name__ == "__main__":
    run_test()
