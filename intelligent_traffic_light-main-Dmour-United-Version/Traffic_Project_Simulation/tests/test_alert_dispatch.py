"""Tests for external alert dispatch."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))


def _base_config() -> dict:
    return {
        "alert_dispatch": {
            "enabled": True,
            "min_severity": "HIGH",
            "channels": ["noop"],
            "dedup_window_seconds": 900,
            "request_timeout_seconds": 2,
            "email": {"enabled": False, "to": []},
        }
    }


def test_noop_dispatch_records_high_alert():
    from messaging.alert_dispatch import AlertDispatcher

    dispatcher = AlertDispatcher(_base_config())
    results = dispatcher.dispatch(
        [{"incident_type": "queue_spillback", "direction": "northbound", "severity": "HIGH", "message": "Queue spillback"}],
        {"wall_time": "2026-05-03T12:34:00+03:00", "controller_tls_id": "tls_1"},
    )
    assert len(results) == 1
    assert results[0]["results"][0]["success"] is True
    assert dispatcher.describe()["recent_dispatches"]


def test_dispatch_deduplicates_same_incident_key():
    from messaging.alert_dispatch import AlertDispatcher

    dispatcher = AlertDispatcher(_base_config())
    alert = {"incident_type": "queue_spillback", "direction": "northbound", "severity": "CRITICAL", "message": "Queue spillback"}
    first = dispatcher.dispatch([alert], {"wall_time": "2026-05-03T12:34:10+03:00"})
    second = dispatcher.dispatch([alert], {"wall_time": "2026-05-03T12:34:40+03:00"})
    assert len(first) == 1
    assert second == []


def test_dispatch_respects_min_severity():
    from messaging.alert_dispatch import AlertDispatcher

    dispatcher = AlertDispatcher(_base_config())
    low_alert = {"incident_type": "rear_end_risk", "direction": "eastbound", "severity": "MEDIUM", "message": "Risk"}
    results = dispatcher.dispatch([low_alert], {"wall_time": "2026-05-03T12:35:00+03:00"})
    assert results == []


def test_webhook_dispatch_posts_json(monkeypatch):
    from messaging.alert_dispatch import AlertDispatcher

    captured: dict[str, object] = {}

    class DummyResponse:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    def fake_urlopen(req, timeout=0):  # noqa: ANN001
        captured["url"] = req.full_url
        captured["body"] = json.loads(req.data.decode("utf-8"))
        captured["timeout"] = timeout
        return DummyResponse()

    monkeypatch.setattr("alert_dispatch.request.urlopen", fake_urlopen)
    config = _base_config()
    config["alert_dispatch"]["channels"] = ["webhook"]
    config["alert_dispatch"]["webhook_url"] = "http://127.0.0.1:9999/alerts"

    dispatcher = AlertDispatcher(config)
    results = dispatcher.dispatch(
        [{"incident_type": "severe_congestion", "direction": "westbound", "severity": "HIGH", "message": "Congestion"}],
        {"wall_time": "2026-05-03T12:36:00+03:00"},
    )
    assert len(results) == 1
    assert captured["url"] == "http://127.0.0.1:9999/alerts"
    assert captured["body"]["incident_type"] == "severe_congestion"
