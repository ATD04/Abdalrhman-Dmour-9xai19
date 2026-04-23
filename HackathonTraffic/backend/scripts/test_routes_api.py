import urllib.request
import json
import datetime

API_KEY = "AIzaSyAmqo01Auetbfq0G-aX6q2hkKTOADTKo-4"
url = "https://routes.googleapis.com/directions/v2:computeRoutes"

# Future departure time: tomorrow at 10 AM Amman time
# We need an RFC3339 timestamp.
tomorrow = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)
# Set hour to 7 UTC (which is 10 AM Amman time +3)
departure_time = tomorrow.replace(hour=7, minute=0, second=0, microsecond=0).isoformat()

headers = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": API_KEY,
    "X-Goog-FieldMask": "routes.duration,routes.staticDuration,routes.distanceMeters"
}

# Wadi Saqra intersection: approx 31.960, 35.908 (I will just use two points near Amman)
# Let's say North to South through the intersection.
data = {
  "origin": {
    "location": {
      "latLng": {
        "latitude": 31.963158,
        "longitude": 35.901509
      }
    }
  },
  "destination": {
    "location": {
      "latLng": {
        "latitude": 31.952541,
        "longitude": 35.918967
      }
    }
  },
  "travelMode": "DRIVE",
  "routingPreference": "TRAFFIC_AWARE",
  "departureTime": departure_time
}

try:
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=headers)
    with urllib.request.urlopen(req) as response:
        resp_data = json.loads(response.read().decode())
        print(json.dumps(resp_data, indent=2))
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code}")
    print(e.read().decode())
except Exception as e:
    print(e)
