"""Playwright smoke test for the video zone-calibration controls."""

from __future__ import annotations

import json
import re
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

playwright = pytest.importorskip("playwright.sync_api")

ROOT = Path(__file__).resolve().parents[2]


def test_video_zone_toolbar_exposes_hardened_controls():
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"

    manifest = {
        "summary": {
            "video_count": 1,
            "total_duration_s": 12.0,
            "tracked_objects": 2,
            "total_events": 0,
            "high_severity_events": 0,
        },
        "model_name": "test-yolo",
        "inference_fps": 10,
        "preview_fps": 30,
        "use_cases": [{"id": "object_detection_tracking", "label": "Tracking", "status": "proven"}],
        "videos": [{
            "id": "clip-1",
            "label": "Clip 1",
            "duration_s": 12.0,
            "preview_path": "/app/media/missing.mp4",
            "thumbnail_path": "/app/data/segmentation_test.jpg",
            "total_unique_tracks": 2,
            "source_resolution": {"width": 1280, "height": 720},
            "events": [],
        }],
    }
    zones = {
        "version": 1,
        "updated_at": "2026-05-06T08:00:00+00:00",
        "video_id": "clip-1",
        "zones": [{
            "zone_id": "zone-north",
            "label": "North default",
            "direction": "northbound",
            "points_norm": [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]],
            "enabled": True,
        }],
        "document": {"version": 1, "videos": {"clip-1": {"zones": []}}},
    }

    with playwright.sync_playwright() as p:
        try:
            browser = p.chromium.launch()
        except Exception as exc:  # noqa: BLE001
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)
            pytest.skip(f"Playwright browser is not installed: {exc}")
        page = browser.new_page(viewport={"width": 1280, "height": 900})

        def fulfill_json(route, payload, status=200):
            route.fulfill(status=status, content_type="application/json", body=json.dumps(payload))

        def api_route(route):
            url = route.request.url
            if url.endswith("/api/video-analytics-manifest"):
                fulfill_json(route, manifest)
            elif "/api/video-tracking/clip-1" in url:
                fulfill_json(route, {"fps": 30, "frames": {"0": []}})
            elif "/api/zones/reset" in url:
                fulfill_json(route, zones)
            elif "/api/zones" in url:
                fulfill_json(route, zones)
            else:
                fulfill_json(route, {})

        page.route("**/api/**", api_route)
        page.goto(base + "/app/index.html")
        page.get_by_role("button", name=re.compile("Video Analytics")).click()
        page.get_by_role("button", name=re.compile("Reset")).wait_for(timeout=5000)
        page.get_by_role("button", name=re.compile("Export")).wait_for(timeout=5000)
        page.get_by_role("button", name=re.compile("Draw")).click()
        page.get_by_text("انقر على الفيديو", exact=False).wait_for(timeout=5000)
        browser.close()

    server.shutdown()
    server.server_close()
    thread.join(timeout=2)
