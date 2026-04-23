import urllib.request
import json
import datetime
import os

API_KEY = "AIzaSyAmqo01Auetbfq0G-aX6q2hkKTOADTKo-4"
URL = "https://routes.googleapis.com/directions/v2:computeRoutes"
OUTPUT_FILE = "../data_sandbox/detector/daily_traffic_profile.json"

def fetch_routes_for_day():
    print("Fetching Google Routes API Traffic Context (8 AM - 8 PM)...")
    
    # Use tomorrow's date to ensure we have valid future departure times
    now = datetime.datetime.now(datetime.timezone.utc)
    tomorrow = now + datetime.timedelta(days=1)
    
    profile = []
    
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "routes.duration,routes.staticDuration,routes.distanceMeters"
    }

    # Main corridor probe (North-West to South-East through Wadi Saqra)
    origin = {"location": {"latLng": {"latitude": 31.963158, "longitude": 35.901509}}}
    dest = {"location": {"latLng": {"latitude": 31.952541, "longitude": 35.918967}}}

    # 8 AM to 8 PM Amman time (UTC+3)
    # 08:00 AM Amman = 05:00 UTC
    for amman_hour in range(8, 21):
        utc_hour = amman_hour - 3
        departure_time = tomorrow.replace(hour=utc_hour, minute=0, second=0, microsecond=0)
        
        data = {
            "origin": origin,
            "destination": dest,
            "travelMode": "DRIVE",
            "routingPreference": "TRAFFIC_AWARE",
            "departureTime": departure_time.isoformat()
        }

        try:
            req = urllib.request.Request(URL, data=json.dumps(data).encode(), headers=headers)
            with urllib.request.urlopen(req) as response:
                resp_data = json.loads(response.read().decode())
                
                if "routes" in resp_data and len(resp_data["routes"]) > 0:
                    route = resp_data["routes"][0]
                    # Format: "404s" -> 404
                    duration_s = int(route.get("duration", "0s").replace("s", ""))
                    static_duration_s = int(route.get("staticDuration", "0s").replace("s", ""))
                    
                    duration_min = round(duration_s / 60.0, 1)
                    static_duration_min = round(static_duration_s / 60.0, 1)
                    
                    ratio = round(duration_min / static_duration_min, 2) if static_duration_min > 0 else 1.0
                    
                    # Label based on ratio
                    if ratio < 1.1: label = "Smooth"
                    elif ratio < 1.4: label = "Moderate"
                    else: label = "Heavy"
                    
                    profile.append({
                        "timestamp": f"{amman_hour:02d}:00",
                        "probe_id": "PRB_MAIN_CORRIDOR",
                        "duration_minutes": duration_min,
                        "static_duration_minutes": static_duration_min,
                        "congestion_ratio": ratio,
                        "traffic_status_label": label,
                        "source": "google_maps_routes_api"
                    })
                    print(f"[{amman_hour:02d}:00] Ratio: {ratio} ({label})")
                else:
                    print(f"[{amman_hour:02d}:00] No routes returned.")
        except Exception as e:
            print(f"[{amman_hour:02d}:00] Error: {e}")

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(profile, f, indent=2)
    print(f"Successfully saved traffic context to {OUTPUT_FILE}")

if __name__ == "__main__":
    fetch_routes_for_day()
