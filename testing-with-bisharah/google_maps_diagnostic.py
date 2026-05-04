#!/usr/bin/env python3
"""
Google Maps API Detailed Diagnostic Report
"""

import os
from dotenv import load_dotenv
from src.acquisition.google_traffic import fetch_congestion, ORIGIN, DEST, API_KEY

load_dotenv()

print("\n" + "="*70)
print("GOOGLE MAPS API - DETAILED DIAGNOSTIC REPORT")
print("="*70)

print("\n📍 CONFIGURATION:")
print(f"  API Key (masked):     {API_KEY[:10] + '...' if API_KEY else 'NOT SET'}")
print(f"  Origin (coordinates): {ORIGIN}")
print(f"  Destination:          {DEST}")
print(f"  API Endpoint:         https://maps.googleapis.com/maps/api/distancematrix/json")

print("\n🔍 API CALL TEST:")
print("  Testing fetch_congestion()...")

data = fetch_congestion()

if data:
    print(f"\n✅ SUCCESS! Google Maps API is WORKING\n")
    print("  📊 TRAFFIC DATA:")
    print(f"    • Congestion Ratio:       {data['congestion_ratio']}x")
    print(f"    • Normal Travel Time:     {data['travel_time_normal']} seconds ({data['travel_time_normal']/60:.1f} min)")
    print(f"    • With Traffic:           {data['travel_time_traffic']} seconds ({data['travel_time_traffic']/60:.1f} min)")

    # Traffic level
    ratio = data['congestion_ratio']
    if ratio < 1.3:
        level = "🟢 FREE FLOW"
    elif ratio < 1.8:
        level = "🟡 MODERATE"
    else:
        level = "🔴 HEAVY"

    print(f"    • Traffic Level:          {level}")
    print(f"    • Time Increase:          {(data['travel_time_traffic'] - data['travel_time_normal'])/60:.1f} min")

else:
    print(f"\n❌ FAILURE! Google Maps API is NOT WORKING\n")
    print("  Troubleshooting steps:")
    print("    1. Verify API key is valid in .env file")
    print("    2. Enable Distance Matrix API in Google Cloud Console")
    print("    3. Check API quota and billing")
    print("    4. Verify coordinates in .env are correct")
    print("    5. Test coordinates format: LATITUDE,LONGITUDE")

print("\n" + "="*70 + "\n")
