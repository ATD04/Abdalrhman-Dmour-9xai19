#!/usr/bin/env python3
"""
Comprehensive Smoke Tests for Testing-with-Bisharah Project
===========================================================
Tests all modules and functions to verify basic functionality.
"""

import sys
import os
import sqlite3
import requests
from datetime import datetime
from dotenv import load_dotenv

# Add project root to path
_ROOT = os.path.dirname(os.path.abspath(__file__))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

# Load environment
load_dotenv()

# Color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

test_results = {"passed": 0, "failed": 0, "skipped": 0}

def test_header(name):
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST: {name}{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")

def test_success(msg):
    print(f"{GREEN}✓ PASS{RESET}: {msg}")
    test_results["passed"] += 1

def test_failure(msg, error=None):
    print(f"{RED}✗ FAIL{RESET}: {msg}")
    if error:
        print(f"  Error: {error}")
    test_results["failed"] += 1

def test_skip(msg):
    print(f"{YELLOW}⊘ SKIP{RESET}: {msg}")
    test_results["skipped"] += 1


# ─────────────────────────────────────────────────────────────────────────────
# TEST 1: Database Setup Module
# ─────────────────────────────────────────────────────────────────────────────

def test_database_setup():
    test_header("1. Database Setup Module (setup_db.py)")

    try:
        from src.storage.setup_db import setup

        # Run setup
        setup()
        test_success("Database setup executed without errors")

        # Verify database file exists
        db_path = "Data/traffic.db"
        if os.path.exists(db_path):
            test_success(f"Database file created at {db_path}")
        else:
            test_failure(f"Database file not found at {db_path}")
            return

        # Verify all tables exist
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        tables = [
            "detector_readings",
            "signal_logs",
            "traffic_conditions",
            "forecasts",
            "events"
        ]

        for table in tables:
            c.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            if c.fetchone():
                test_success(f"Table '{table}' created")
            else:
                test_failure(f"Table '{table}' not found")

        conn.close()

    except Exception as e:
        test_failure("Database setup failed", str(e))


# ─────────────────────────────────────────────────────────────────────────────
# TEST 2: Google Maps API
# ─────────────────────────────────────────────────────────────────────────────

def test_google_maps_api():
    test_header("2. Google Maps API (google_traffic.py)")

    try:
        from src.acquisition.google_traffic import fetch_congestion, API_KEY

        # Check if API key is configured
        if not API_KEY:
            test_skip("Google Maps API key not found in .env file")
            print(f"  Set GOOGLE_MAPS_API_KEY in .env to enable this test")
            return

        test_success("Google Maps API key is configured")

        # Test fetch_congestion function
        print(f"\n  Attempting to fetch congestion data...")
        data = fetch_congestion()

        if data is None:
            test_failure("fetch_congestion() returned None (API call failed)")
            print(f"  This could be due to:")
            print(f"    - Invalid API key")
            print(f"    - API not enabled in GCP console")
            print(f"    - Invalid coordinates in .env")
            print(f"    - Network connectivity issue")
            return

        test_success("fetch_congestion() successfully returned data")

        # Verify response structure
        required_fields = ["congestion_ratio", "travel_time_normal", "travel_time_traffic"]
        for field in required_fields:
            if field in data:
                test_success(f"Response contains '{field}': {data[field]}")
            else:
                test_failure(f"Response missing required field: '{field}'")

        # Validate data values
        if data["congestion_ratio"] > 0:
            test_success(f"Congestion ratio is valid: {data['congestion_ratio']}x")
        else:
            test_failure("Congestion ratio is invalid (<=0)")

        # Display traffic level
        ratio = data["congestion_ratio"]
        if ratio < 1.3:
            level = "🟢 Free flow"
        elif ratio < 1.8:
            level = "🟡 Moderate"
        else:
            level = "🔴 Heavy"
        print(f"  Traffic Level: {level}")
        print(f"  Normal travel time: {data['travel_time_normal']}s")
        print(f"  Traffic travel time: {data['travel_time_traffic']}s")

    except ImportError as e:
        test_failure("Could not import google_traffic module", str(e))
    except Exception as e:
        test_failure("Google Maps API test failed", str(e))


# ─────────────────────────────────────────────────────────────────────────────
# TEST 3: Data Import Module
# ─────────────────────────────────────────────────────────────────────────────

def test_data_import():
    test_header("3. Data Import Module (import_to_db.py)")

    try:
        from src.acquisition.import_to_db import import_counts, generate_signals

        csv_path = "Data/output/line_counts.csv"

        if not os.path.exists(csv_path):
            test_skip(f"Line counts CSV not found at {csv_path}")
            print(f"  Run step3_line_count.py first to generate vehicle detection data")
            return

        test_success(f"Line counts CSV found at {csv_path}")

        # Try to read the CSV
        try:
            import pandas as pd
            df = pd.read_csv(csv_path)
            test_success(f"Successfully read CSV with {len(df)} rows")

            # Check expected columns
            expected_cols = ["timestamp", "frame", "direction", "vehicle_id", "vehicle_type", "confidence"]
            for col in expected_cols:
                if col in df.columns:
                    test_success(f"CSV contains column: '{col}'")
                else:
                    test_failure(f"CSV missing column: '{col}'")
        except Exception as e:
            test_failure("Could not read CSV", str(e))

    except ImportError as e:
        test_failure("Could not import import_to_db module", str(e))
    except Exception as e:
        test_failure("Data import test failed", str(e))


# ─────────────────────────────────────────────────────────────────────────────
# TEST 4: Forecasting Module
# ─────────────────────────────────────────────────────────────────────────────

def test_forecasting_module():
    test_header("4. Forecasting Module (train_forecast.py)")

    try:
        from src.forecasting.train_forecast import load_data, build_features, DIRECTIONS

        db_path = "Data/traffic.db"

        # Check if database has data
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM detector_readings")
        count = c.fetchone()[0]
        conn.close()

        if count == 0:
            test_skip("No detector readings in database (required for forecasting)")
            print(f"  Run import_to_db.py after step3_line_count.py")
            return

        test_success(f"Database has {count} detector readings")

        # Test load_data function
        try:
            df = load_data()
            test_success(f"load_data() returned {len(df)} rows")
        except Exception as e:
            test_failure("load_data() failed", str(e))
            return

        # Test build_features for each direction
        for direction in DIRECTIONS:
            try:
                features = build_features(df, direction)
                if features is not None:
                    test_success(f"build_features() worked for {direction} ({len(features)} rows)")
                else:
                    test_skip(f"build_features() returned None for {direction} (insufficient data)")
            except Exception as e:
                test_failure(f"build_features() failed for {direction}", str(e))

    except ImportError as e:
        test_failure("Could not import forecasting module", str(e))
    except Exception as e:
        test_failure("Forecasting module test failed", str(e))


# ─────────────────────────────────────────────────────────────────────────────
# TEST 5: API Endpoints
# ─────────────────────────────────────────────────────────────────────────────

def test_api_endpoints():
    test_header("5. API Endpoints (main.py)")

    base_url = "http://127.0.0.1:8000"

    # Check if server is running
    try:
        response = requests.get(f"{base_url}/health", timeout=2)
        test_success("API server is running and responding")
    except requests.ConnectionError:
        test_skip("API server not running at http://127.0.0.1:8000")
        print(f"  Start the server with: python3 src/detection/step3_line_count.py")
        return
    except Exception as e:
        test_skip(f"Could not connect to API server: {e}")
        return

    # Test endpoints
    endpoints = [
        ("/health", "Health check"),
        ("/counts", "Vehicle counts"),
        ("/forecasts", "Forecasts"),
        ("/conditions/latest", "Traffic conditions"),
        ("/events", "Incidents"),
        ("/summary", "Summary data"),
        ("/live_counts", "Live counts"),
        ("/live_stats", "Live stats"),
    ]

    for endpoint, description in endpoints:
        try:
            response = requests.get(f"{base_url}{endpoint}", timeout=5)
            if response.status_code == 200:
                data = response.json()
                test_success(f"{description} endpoint working (status: {response.status_code})")
            else:
                test_failure(f"{description} endpoint returned status {response.status_code}")
        except Exception as e:
            test_failure(f"{description} endpoint failed", str(e))

    # Test video feed endpoint (streaming)
    try:
        response = requests.get(f"{base_url}/video_feed", timeout=2, stream=True)
        if response.status_code == 200:
            test_success("Video feed endpoint available (MJPEG stream)")
        else:
            test_failure(f"Video feed endpoint returned status {response.status_code}")
    except Exception as e:
        test_skip(f"Video feed endpoint not available: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# TEST 6: Detection Module (state management)
# ─────────────────────────────────────────────────────────────────────────────

def test_detection_state():
    test_header("6. Detection State Module (state.py)")

    try:
        import src.api.state as state

        # Check all required state variables exist
        state_vars = [
            "latest_frame",
            "live_counts",
            "live_stats",
            "detection_running",
            "frame_time",
            "lock",
        ]

        for var in state_vars:
            if hasattr(state, var):
                test_success(f"State variable '{var}' exists")
            else:
                test_failure(f"State variable '{var}' missing")

        # Verify thread lock works
        try:
            with state.lock:
                state.live_counts["North"] = 42
            test_success("Thread lock works correctly")
        except Exception as e:
            test_failure("Thread lock failed", str(e))

    except ImportError as e:
        test_failure("Could not import state module", str(e))
    except Exception as e:
        test_failure("Detection state test failed", str(e))


# ─────────────────────────────────────────────────────────────────────────────
# TEST 7: Environment Configuration
# ─────────────────────────────────────────────────────────────────────────────

def test_environment():
    test_header("7. Environment Configuration (.env)")

    required_vars = {
        "GOOGLE_MAPS_API_KEY": "Google Maps API key",
        "DB_PATH": "Database path",
        "INTERSECTION_ID": "Intersection ID",
        "ORIGIN_LAT": "Origin latitude",
        "ORIGIN_LNG": "Origin longitude",
        "DEST_LAT": "Destination latitude",
        "DEST_LNG": "Destination longitude",
    }

    for var, description in required_vars.items():
        value = os.getenv(var)
        if value:
            # Mask sensitive values
            if "KEY" in var:
                display = value[:10] + "..." if len(value) > 10 else value
            else:
                display = value
            test_success(f"{description} ({var}): {display}")
        else:
            test_failure(f"{description} ({var}) not configured in .env")


# ─────────────────────────────────────────────────────────────────────────────
# Main Test Runner
# ─────────────────────────────────────────────────────────────────────────────

def run_all_tests():
    print(f"\n{BLUE}╔{'═'*58}╗{RESET}")
    print(f"{BLUE}║  TRAFFIC INTELLIGENCE PROJECT - COMPREHENSIVE SMOKE TESTS  ║{RESET}")
    print(f"{BLUE}╚{'═'*58}╝{RESET}")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Run all tests
    test_environment()
    test_database_setup()
    test_google_maps_api()
    test_data_import()
    test_forecasting_module()
    test_detection_state()
    test_api_endpoints()

    # Summary
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST SUMMARY{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")
    print(f"{GREEN}Passed:  {test_results['passed']}{RESET}")
    print(f"{RED}Failed:  {test_results['failed']}{RESET}")
    print(f"{YELLOW}Skipped: {test_results['skipped']}{RESET}")
    total = sum(test_results.values())
    print(f"Total:   {total}")

    if test_results["failed"] == 0:
        print(f"\n{GREEN}✓ All tests passed!{RESET}")
    else:
        print(f"\n{RED}✗ {test_results['failed']} test(s) failed{RESET}")

    print(f"Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")


if __name__ == "__main__":
    run_all_tests()
