import urllib.request
import json

api_key = "AIzaSyAmqo01Auetbfq0G-aX6q2hkKTOADTKo-4"
url = f"https://maps.googleapis.com/maps/api/geocode/json?address=Wadi+Saqra+Intersection,+Amman&key={api_key}"

try:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print(json.dumps(data, indent=2))
except Exception as e:
    print(e)
