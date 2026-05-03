"""
Google Maps Traffic Puller
---------------------------
Fetches real-time congestion data for Wadi Saqra every 15 minutes
and saves it to SQLite.

Run once manually to test, or run as a background scheduler.
"""

import sqlite3
import requests
import os
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.getenv("DB_PATH", "Data/traffic.db")
API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
ORIGIN  = f"{os.getenv('ORIGIN_LAT')},{os.getenv('ORIGIN_LNG')}"
DEST    = f"{os.getenv('DEST_LAT')},{os.getenv('DEST_LNG')}"

def fetch_congestion():
    """Call Google Distance Matrix API and return congestion ratio."""
    if not API_KEY:
        print("No API key found in .env")
        return None

    url = "https://maps.googleapis.com/maps/api/distancematrix/json"
    params = {
        "origins":        ORIGIN,
        "destinations":   DEST,
        "departure_time": "now",
        "traffic_model":  "best_guess",
        "key":            API_KEY,
    }

    try:
        res = requests.get(url, params=params, timeout=10)
        data = res.json()

        if data["status"] != "OK":
            print(f"API error: {data['status']}")
            return None

        element = data["rows"][0]["elements"][0]
        if element["status"] != "OK":
            print(f"Route error: {element['status']}")
            return None

        normal  = element["duration"]["value"]
        traffic = element["duration_in_traffic"]["value"]
        ratio   = round(traffic / normal, 2)

        return {
            "congestion_ratio":    ratio,
            "travel_time_normal":  normal,
            "travel_time_traffic": traffic,
        }

    except Exception as e:
        print(f"Request failed: {e}")
        return None

def save_to_db(data):
    """Save congestion reading to SQLite."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        INSERT INTO traffic_conditions
            (timestamp, congestion_ratio, travel_time_normal, travel_time_traffic)
        VALUES (?, ?, ?, ?)
    """, (
        datetime.now().isoformat(),
        data["congestion_ratio"],
        data["travel_time_normal"],
        data["travel_time_traffic"],
    ))
    conn.commit()
    conn.close()

def run_once():
    """Fetch and save one reading — call this manually or from a scheduler."""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Fetching Google Maps traffic...")
    data = fetch_congestion()
    if data:
        save_to_db(data)
        level = (
            "🟢 Free flow" if data["congestion_ratio"] < 1.3 else
            "🟡 Moderate"  if data["congestion_ratio"] < 1.8 else
            "🔴 Heavy"
        )
        print(f"  Congestion: {data['congestion_ratio']}x  →  {level}")
        print(f"  Normal: {data['travel_time_normal']}s  |  With traffic: {data['travel_time_traffic']}s")
    else:
        print("  Could not fetch data.")

def run_loop(interval_minutes=15):
    """Run continuously every N minutes."""
    print(f"Starting Google Maps poller — every {interval_minutes} minutes.")
    print("Press Ctrl+C to stop.\n")
    while True:
        run_once()
        time.sleep(interval_minutes * 60)

if __name__ == "__main__":
    # Single fetch for testing
    run_once()
