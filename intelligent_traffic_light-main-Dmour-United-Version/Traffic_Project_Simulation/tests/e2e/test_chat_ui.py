"""Playwright smoke test for the grounded Chat tab."""

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


def test_chat_tab_renders_answer_and_reference():
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"

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
            if url.endswith("/api/chat/health"):
                fulfill_json(route, {
                    "ready": True,
                    "provider": "ollama",
                    "model": "gemma4:latest",
                    "mcp_tools": ["get_live_direction_metrics"],
                    "cloud_fallback_enabled": False,
                })
            elif url.endswith("/api/chat/query"):
                fulfill_json(route, {
                    "conversation_id": "conv-ui",
                    "answer": "northbound is heavy based on live readings.",
                    "language": "en",
                    "time_scope": "live",
                    "citations": [{
                        "ref_id": "ref_ui",
                        "title": "Current northbound live readings",
                        "source_type": "live_state",
                        "ui_target": "tab-dashboard:dash-kpi-row",
                        "locator": "live_state.direction.northbound",
                        "timestamp_or_range": "2026-05-03T12:24:11+03:00",
                    }],
                    "refusal_reason": None,
                    "debug": {"tools_used": ["get_live_direction_metrics"], "model": "gemma4:latest", "provider": "ollama"},
                })
            elif url.endswith("/api/chat/reference/ref_ui"):
                fulfill_json(route, {
                    "title": "Current northbound live readings",
                    "source_type": "live_state",
                    "ui_target": "tab-dashboard:dash-kpi-row",
                    "timestamp_or_range": "2026-05-03T12:24:11+03:00",
                    "locator": "live_state.direction.northbound",
                    "api_origin": "/api/live-state",
                    "file_origin": None,
                    "structured_payload": {"direction": "northbound", "metrics": {"queue_m": 84}},
                    "raw_excerpt": "{\"queue_m\":84}",
                    "render_type": "live_metric_card",
                    "render_hints": {"preferred_view": "rendered"},
                    "linked_entities": {"direction": "northbound"},
                    "raw_json_available": True,
                })
            else:
                fulfill_json(route, {})

        page.route("**/api/**", api_route)
        page.goto(base + "/app/index.html")
        page.get_by_role("button", name=re.compile("Chat")).click()
        page.locator("#chat-input").fill("Is there congestion on northbound right now?")
        page.locator("#chat-send-btn").click()
        page.get_by_text("northbound is heavy", exact=False).wait_for(timeout=5000)
        page.get_by_text("Current northbound live readings").click()
        page.get_by_text("live_state.direction.northbound").wait_for(timeout=5000)
        page.get_by_text("Raw JSON").wait_for(timeout=5000)
        browser.close()

    server.shutdown()
    server.server_close()
    thread.join(timeout=2)
