"""Playwright smoke test for the Replay and Reports tabs."""

from __future__ import annotations

import json
import re
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

playwright = pytest.importorskip("playwright.sync_api")

ROOT = Path(__file__).resolve().parents[2]


def _mock_replay_payload() -> dict:
    rows = [
        {"direction": "northbound", "queue_m": 42.0, "flow_veh_h": 620.0, "avg_speed_kmh": 18.0, "google_delay_s": 145.0, "delta": {"queue_m": 10.0}},
        {"direction": "southbound", "queue_m": 18.0, "flow_veh_h": 350.0, "avg_speed_kmh": 24.0, "google_delay_s": 42.0, "delta": {"queue_m": 4.0}},
        {"direction": "eastbound", "queue_m": 12.0, "flow_veh_h": 280.0, "avg_speed_kmh": 28.0, "google_delay_s": 28.0, "delta": {"queue_m": -1.0}},
        {"direction": "westbound", "queue_m": 20.0, "flow_veh_h": 420.0, "avg_speed_kmh": 20.0, "google_delay_s": 95.0, "delta": {"queue_m": 3.0}},
    ]
    return {
        "schema_version": 2,
        "count": 2,
        "available_marker_types": ["phase_change", "incident"],
        "summary": {"duration_s": 5.0, "marker_counts": {"phase_change": 1, "incident": 1}},
        "snapshots": [
            {
                "index": 0,
                "timeline_label": "10:00:00",
                "wall_time": "2026-05-06T10:00:00+03:00",
                "source": "mock",
                "vehicle_count": 21,
                "queue_total_m": 72.0,
                "network_avg_speed_kmh": 24.0,
                "phase_label": "North + South",
                "adaptive_active": True,
                "delta": {"queue_total_m": 0.0, "network_avg_speed_kmh": 0.0, "vehicle_count": 0},
                "direction_rows": rows,
                "markers": [],
                "marker_types": [],
            },
            {
                "index": 1,
                "timeline_label": "10:00:05",
                "wall_time": "2026-05-06T10:00:05+03:00",
                "source": "mock",
                "vehicle_count": 24,
                "queue_total_m": 92.0,
                "network_avg_speed_kmh": 22.0,
                "phase_label": "East",
                "adaptive_active": True,
                "delta": {"queue_total_m": 20.0, "network_avg_speed_kmh": -2.0, "vehicle_count": 3},
                "direction_rows": rows,
                "markers": [
                    {"type": "phase_change", "label": "phase -> East", "detail": {"message": "Signal plan changed."}},
                    {"type": "incident", "label": "collision", "detail": {"message": "Vision detector confirmed a collision."}},
                ],
                "marker_types": ["phase_change", "incident"],
            },
        ],
    }


def _mock_report_payload() -> dict:
    approaches = [
        {"direction": "northbound", "queue_m": 82.0, "queue_delta_m": 32.0, "flow_veh_h": 620.0, "avg_speed_kmh": 18.0, "google_delay_s": 168.0, "pressure_index": 0.86},
        {"direction": "southbound", "queue_m": 36.0, "queue_delta_m": 8.0, "flow_veh_h": 380.0, "avg_speed_kmh": 24.0, "google_delay_s": 45.0, "pressure_index": 0.48},
        {"direction": "eastbound", "queue_m": 22.0, "queue_delta_m": 4.0, "flow_veh_h": 300.0, "avg_speed_kmh": 28.0, "google_delay_s": 26.0, "pressure_index": 0.30},
        {"direction": "westbound", "queue_m": 54.0, "queue_delta_m": 14.0, "flow_veh_h": 470.0, "avg_speed_kmh": 19.0, "google_delay_s": 132.0, "pressure_index": 0.74},
    ]
    forecast_rows = {
        direction: [
            {"horizon_minutes": 15, "veh_per_hour": 410.0, "spillback_risk": "MEDIUM"},
            {"horizon_minutes": 60, "veh_per_hour": 590.0, "spillback_risk": "HIGH"},
        ]
        for direction in ("northbound", "southbound", "eastbound", "westbound")
    }
    return {
        "schema_version": 1,
        "report_type": "operational_situation",
        "generated_at": "2026-05-06T10:12:00+03:00",
        "metadata": {
            "report_id": "sitrep-ui",
            "generation_mode": "deterministic_rule_based",
            "time_window": {"history_points": 10, "duration_s": 300.0},
            "llm": {"requested": True, "used": False, "reason": "Fallback"},
        },
        "sections": {
            "status": {
                "summary": "Northbound pressure is elevated and a collision requires immediate inspection.",
                "phase_label": "East",
                "source": "mock",
                "network_queue_m": 194.0,
                "network_avg_speed_kmh": 22.3,
                "adaptive_active": True,
            },
            "approaches": approaches,
            "incidents": {
                "active_count": 2,
                "recent": [{
                    "incident_type": "collision",
                    "severity": "CRITICAL",
                    "direction": "northbound",
                    "message": "Vision detector confirmed a collision.",
                    "wall_time": "2026-05-06T10:10:00+03:00",
                }],
            },
            "forecasts": {
                "available": True,
                "mode": "seasonal_naive",
                "directions": forecast_rows,
            },
            "actions": [{
                "priority": 1,
                "category": "incident_response",
                "direction": "northbound",
                "title": "Inspect Northbound approach immediately",
                "reason": "Vision detector confirmed a collision.",
            }],
            "health": {
                "engine_status": "running",
                "data_source": "mock",
                "data_freshness_s": 2.0,
                "forecasting": {"available": True, "mode": "seasonal_naive"},
                "video": {"running": False},
            },
        },
    }


def _mock_simulation_job_result() -> dict:
    directions = ("northbound", "southbound", "eastbound", "westbound")

    def direction_breakdown(avg_queue, avg_delay, source_name="Google Maps API (Live)"):
        return {
            direction: {
                "avg_queue_m": avg_queue[idx],
                "max_queue_m": avg_queue[idx] + 18.0,
                "throughput_veh": 32.0 + idx,
                "avg_delay_s": avg_delay[idx],
                "v_over_c": 0.48 + idx * 0.07,
                "los": "B" if idx < 2 else "C",
                "source_name": source_name,
            }
            for idx, direction in enumerate(directions)
        }

    def snapshots(ns, east, west):
        return [
            {
                "t": 0,
                "phase": "ns_green",
                "directions": {
                    "northbound": {"queue_m": ns, "queue_vehicles": round(ns / 6, 1), "active": True},
                    "southbound": {"queue_m": max(0, ns - 6), "queue_vehicles": round(max(0, ns - 6) / 6, 1), "active": True},
                    "eastbound": {"queue_m": east, "queue_vehicles": round(east / 6, 1), "active": False},
                    "westbound": {"queue_m": west, "queue_vehicles": round(west / 6, 1), "active": False},
                },
                "vehicles": [],
            },
            {
                "t": 5,
                "phase": "e_green",
                "directions": {
                    "northbound": {"queue_m": max(0, ns - 8), "queue_vehicles": round(max(0, ns - 8) / 6, 1), "active": False},
                    "southbound": {"queue_m": max(0, ns - 10), "queue_vehicles": round(max(0, ns - 10) / 6, 1), "active": False},
                    "eastbound": {"queue_m": max(0, east - 6), "queue_vehicles": round(max(0, east - 6) / 6, 1), "active": True},
                    "westbound": {"queue_m": west + 3, "queue_vehicles": round((west + 3) / 6, 1), "active": False},
                },
                "vehicles": [],
            },
        ]

    return {
        "request": {
            "engine": "sumo",
            "baseline_greens": {"ns_green": 35.0, "e_green": 25.0, "w_green": 25.0},
            "candidate_greens": {"ns_green": 40.0, "e_green": 20.0, "w_green": 18.0},
        },
        "baseline": {
            "cycle_s": 100.0,
            "avg_queue_m": 82.0,
            "max_queue_m": 140.0,
            "throughput_veh": 120.0,
            "avg_delay_s": 42.0,
            "intersection_los": "D",
            "time_to_clear_s": 74,
            "spillback_events": [{"second": 12, "direction": "northbound"}],
            "direction_breakdown": direction_breakdown([28.0, 24.0, 16.0, 14.0], [42.0, 38.0, 24.0, 19.0]),
            "vehicle_snapshots": snapshots(42.0, 18.0, 14.0),
            "safety_warnings": [],
            "engine_requested": "sumo",
            "engine_used": "math",
            "engine_fallback_reason": "sumo bootstrap failed",
        },
        "candidate": {
            "cycle_s": 93.0,
            "avg_queue_m": 68.0,
            "max_queue_m": 118.0,
            "throughput_veh": 126.0,
            "avg_delay_s": 31.0,
            "intersection_los": "C",
            "time_to_clear_s": 61,
            "spillback_events": [],
            "direction_breakdown": direction_breakdown([19.0, 16.0, 14.0, 19.0], [29.0, 27.0, 23.0, 34.0]),
            "vehicle_snapshots": snapshots(34.0, 14.0, 19.0),
            "safety_warnings": [],
            "engine_requested": "sumo",
            "engine_used": "math",
            "engine_label": "Quick Estimate (HCM)",
            "engine_fallback_reason": "sumo bootstrap failed",
        },
        "comparison": {
            "avg_queue_delta_m": -14.0,
            "max_queue_delta_m": -22.0,
            "throughput_delta_veh": 6.0,
            "avg_delay_delta_s": -11.0,
            "spillback_delta": -1,
            "los_baseline": "D",
            "los_candidate": "C",
            "direction_comparison": {
                "northbound": {"delay_delta_s": -13.0, "queue_delta_m": -9.0},
                "southbound": {"delay_delta_s": -11.0, "queue_delta_m": -8.0},
                "eastbound": {"delay_delta_s": -1.0, "queue_delta_m": -2.0},
                "westbound": {"delay_delta_s": 15.0, "queue_delta_m": 5.0},
            },
        },
    }


def test_replay_and_reports_tabs_render_live_payloads():
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"

    geometry = json.loads((ROOT / "app/data/live_network_geometry.json").read_text(encoding="utf-8"))
    live_state = json.loads((ROOT / "app/data/last_live_state.json").read_text(encoding="utf-8"))
    live_history = json.loads((ROOT / "app/data/live_history.json").read_text(encoding="utf-8"))
    replay_payload = _mock_replay_payload()
    report_payload = _mock_report_payload()

    with playwright.sync_playwright() as p:
        try:
            browser = p.chromium.launch()
        except Exception as exc:  # noqa: BLE001
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)
            pytest.skip(f"Playwright browser is not installed: {exc}")
        page = browser.new_page(viewport={"width": 1400, "height": 960})

        def fulfill_json(route, payload, status=200):
            route.fulfill(status=status, content_type="application/json", body=json.dumps(payload))

        def api_route(route):
            url = route.request.url
            if url.endswith("/api/live-config"):
                fulfill_json(route, {"server": {"host": "127.0.0.1", "port": 3100}})
            elif url.endswith("/api/network-geometry"):
                fulfill_json(route, geometry)
            elif url.endswith("/api/live-state"):
                fulfill_json(route, live_state)
            elif url.endswith("/api/live-history"):
                fulfill_json(route, live_history)
            elif url.endswith("/api/flow-forecast"):
                fulfill_json(route, {"directions": {}, "mode": "seasonal_naive", "horizons": [15]})
            elif url.endswith("/api/model-evaluation"):
                fulfill_json(route, {"summary": []})
            elif url.endswith("/api/analytics/peak-hours"):
                fulfill_json(route, {"weekdays": [], "directions": {}, "approaches": {}})
            elif url.endswith("/api/analytics/volume-heatmap"):
                fulfill_json(route, {"directions": {}, "approaches": {}, "weekdays": [], "hours": []})
            elif url.endswith("/api/analytics/traffic-counts"):
                fulfill_json(route, {"directions": {}, "approaches": {}})
            elif url.endswith("/api/chat/health"):
                fulfill_json(route, {"ready": False, "provider": "ollama", "model": "gemma4:latest", "reason": "disabled"})
            elif url.endswith("/api/alert-dispatch"):
                fulfill_json(route, {"enabled": False, "channels": [], "recent": []})
            elif url.endswith("/api/replay"):
                fulfill_json(route, replay_payload)
            elif url.endswith("/api/report/latest"):
                fulfill_json(route, report_payload)
            elif url.endswith("/api/report/generate"):
                fulfill_json(route, report_payload, status=201)
            else:
                fulfill_json(route, {})

        page.route("**/api/**", api_route)
        page.goto(base + "/app/index.html")

        page.get_by_role("button", name=re.compile("Replay")).click()
        page.get_by_text("Snapshots: 2", exact=False).wait_for(timeout=5000)
        page.locator("#replay-position-badge").get_by_text("10:00:00", exact=False).wait_for(timeout=5000)
        page.locator("#replay-slider").fill("1")
        page.locator("#replay-markers").get_by_text("collision", exact=True).wait_for(timeout=5000)
        page.get_by_role("button", name=re.compile("Play")).wait_for(timeout=5000)

        page.get_by_role("button", name=re.compile("Reports")).click()
        page.locator("#report-status").get_by_text("Northbound pressure is elevated", exact=False).wait_for(timeout=5000)
        page.get_by_role("button", name=re.compile("Generate Report")).click()
        page.locator("#report-actions").get_by_text("Inspect Northbound approach immediately", exact=False).wait_for(timeout=5000)
        page.get_by_text("Report JSON").wait_for(timeout=5000)
        with page.expect_download() as json_download:
            page.get_by_role("button", name=re.compile("Export JSON")).click()
        assert json_download.value.suggested_filename.endswith(".json")
        with page.expect_download() as pdf_download:
            page.get_by_role("button", name=re.compile("Export PDF")).click()
        assert pdf_download.value.suggested_filename.endswith(".pdf")

        browser.close()

    server.shutdown()
    server.server_close()
    thread.join(timeout=2)


def test_replay_and_reports_tabs_fallback_when_endpoints_return_404():
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"

    geometry = json.loads((ROOT / "app/data/live_network_geometry.json").read_text(encoding="utf-8"))
    live_state = json.loads((ROOT / "app/data/last_live_state.json").read_text(encoding="utf-8"))
    live_history = json.loads((ROOT / "app/data/live_history.json").read_text(encoding="utf-8"))

    with playwright.sync_playwright() as p:
        try:
            browser = p.chromium.launch()
        except Exception as exc:  # noqa: BLE001
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)
            pytest.skip(f"Playwright browser is not installed: {exc}")
        page = browser.new_page(viewport={"width": 1400, "height": 960})

        def api_route(route):
            url = route.request.url
            if url.endswith("/api/live-config"):
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"server": {"host": "127.0.0.1", "port": 3100}}))
            elif url.endswith("/api/network-geometry"):
                route.fulfill(status=200, content_type="application/json", body=json.dumps(geometry))
            elif url.endswith("/api/live-state"):
                route.fulfill(status=200, content_type="application/json", body=json.dumps(live_state))
            elif url.endswith("/api/live-history"):
                route.fulfill(status=200, content_type="application/json", body=json.dumps(live_history))
            elif "/api/flow-forecast" in url:
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"mode": "seasonal_naive", "horizons": [15, 60], "directions": {}}))
            elif url.endswith("/api/model-evaluation"):
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"summary": []}))
            elif url.endswith("/api/analytics/peak-hours"):
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"weekdays": [], "directions": {}, "approaches": {}}))
            elif url.endswith("/api/analytics/volume-heatmap"):
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"directions": {}, "approaches": {}, "weekdays": [], "hours": []}))
            elif url.endswith("/api/analytics/traffic-counts"):
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"directions": {}, "approaches": {}}))
            elif url.endswith("/api/chat/health"):
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"ready": False, "provider": "ollama", "model": "gemma4:latest", "reason": "disabled"}))
            elif url.endswith("/api/alert-dispatch"):
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"enabled": False, "channels": [], "recent": []}))
            elif url.endswith("/api/replay") or url.endswith("/api/report/latest") or url.endswith("/api/report/generate"):
                route.fulfill(status=404, content_type="application/json", body=json.dumps({"error": "missing"}))
            elif url.endswith("/api/live-video-stats"):
                route.fulfill(status=404, content_type="application/json", body=json.dumps({"error": "not enabled"}))
            else:
                route.fulfill(status=200, content_type="application/json", body=json.dumps({}))

        page.route("**/api/**", api_route)
        page.goto(base + "/app/index.html")

        page.get_by_role("button", name=re.compile("Replay")).click()
        page.locator("#replay-count-badge").get_by_text("compat", exact=False).wait_for(timeout=5000)
        page.locator("#replay-position-badge").wait_for(timeout=5000)
        assert "unavailable" not in page.locator("#replay-empty").inner_text(timeout=1000).lower()

        page.get_by_role("button", name=re.compile("Reports")).click()
        page.locator("#report-mode-badge").get_by_text("compatibility_local_builder", exact=False).wait_for(timeout=5000)
        page.locator("#report-status").get_by_text("Compatibility report:", exact=False).wait_for(timeout=5000)
        page.get_by_role("button", name=re.compile("Generate Report")).click()
        page.wait_for_function(
            "() => document.getElementById('report-raw-json-code')?.textContent?.includes('compatibility_local_builder')"
        )

        browser.close()

    server.shutdown()
    server.server_close()
    thread.join(timeout=2)


def test_simulation_lab_shows_engine_preview_before_async_result():
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"

    geometry = json.loads((ROOT / "app/data/live_network_geometry.json").read_text(encoding="utf-8"))
    live_state = json.loads((ROOT / "app/data/last_live_state.json").read_text(encoding="utf-8"))
    simulation_result = _mock_simulation_job_result()
    poll_count = {"value": 0}

    with playwright.sync_playwright() as p:
        try:
            browser = p.chromium.launch()
        except Exception as exc:  # noqa: BLE001
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)
            pytest.skip(f"Playwright browser is not installed: {exc}")
        page = browser.new_page(viewport={"width": 1440, "height": 1080})

        def api_route(route):
            url = route.request.url
            if url.endswith("/api/live-config"):
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"server": {"host": "127.0.0.1", "port": 3100}}))
            elif url.endswith("/api/network-geometry"):
                route.fulfill(status=200, content_type="application/json", body=json.dumps(geometry))
            elif url.endswith("/api/live-state"):
                route.fulfill(status=200, content_type="application/json", body=json.dumps(live_state))
            elif url.endswith("/api/live-history"):
                route.fulfill(status=200, content_type="application/json", body=json.dumps([]))
            elif "/api/flow-forecast" in url:
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"directions": {}, "mode": "seasonal_naive", "horizons": [15]}))
            elif url.endswith("/api/model-evaluation"):
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"summary": []}))
            elif url.endswith("/api/analytics/peak-hours"):
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"weekdays": [], "directions": {}, "approaches": {}}))
            elif url.endswith("/api/analytics/volume-heatmap"):
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"directions": {}, "approaches": {}, "weekdays": [], "hours": []}))
            elif url.endswith("/api/analytics/traffic-counts"):
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"directions": {}, "approaches": {}}))
            elif url.endswith("/api/chat/health"):
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"ready": False, "provider": "ollama", "model": "gemma4:latest", "reason": "disabled"}))
            elif url.endswith("/api/alert-dispatch"):
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"enabled": False, "channels": [], "recent": []}))
            elif url.endswith("/api/simulation/what-if") and route.request.method == "POST":
                route.fulfill(status=202, content_type="application/json", body=json.dumps({"job_id": "whatif_demo", "status": "running"}))
            elif url.endswith("/api/simulation/what-if/whatif_demo"):
                poll_count["value"] += 1
                time.sleep(0.12)
                payload = {"job_id": "whatif_demo", "status": "running"} if poll_count["value"] == 1 else {
                    "job_id": "whatif_demo",
                    "status": "completed",
                    "result": simulation_result,
                }
                route.fulfill(status=200, content_type="application/json", body=json.dumps(payload))
            else:
                route.fulfill(status=200, content_type="application/json", body=json.dumps({}))

        page.route("**/api/**", api_route)
        page.goto(base + "/app/index.html")

        page.get_by_role("button", name=re.compile("Simulation Lab")).click()
        page.get_by_text("الخطة المقترحة للإشارة", exact=False).wait_for(timeout=5000)
        page.get_by_text("الخطة الحالية من اللايف", exact=False).wait_for(timeout=5000)
        assert page.locator('input[name="sim-engine-option"]').count() == 2
        page.get_by_text("Detailed Digital Twin", exact=True).click()
        page.locator("#sim-engine-help").get_by_text("SUMO", exact=False).wait_for(timeout=5000)

        page.get_by_role("button", name=re.compile("تشغيل المحاكاة")).click()
        page.locator("#simulation-summary").get_by_text("Preparing Detailed Digital Twin", exact=False).wait_for(timeout=5000)
        page.locator("#simulation-status").get_by_text("Running", exact=False).wait_for(timeout=5000)
        page.locator("#simulation-summary").get_by_text("Requested: Detailed Digital Twin", exact=False).wait_for(timeout=5000)
        page.locator("#simulation-summary").get_by_text("Used: Quick Estimate", exact=False).wait_for(timeout=5000)
        page.locator("#simulation-summary").get_by_text("fell back to the fast HCM model", exact=False).wait_for(timeout=5000)

        browser.close()

    server.shutdown()
    server.server_close()
    thread.join(timeout=2)
