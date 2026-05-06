"""Tests for polygon monitoring zones and zone CRUD APIs."""

from __future__ import annotations

import json
import sys
import threading
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib import request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "tests"))

from test_chat_retrieval import FakeEngine  # noqa: E402


def test_point_in_polygon_handles_inside_outside_and_boundary():
    from cli.zone_support import point_in_polygon

    square = [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]]
    assert point_in_polygon(0.3, 0.3, square) is True
    assert point_in_polygon(0.7, 0.3, square) is False
    assert point_in_polygon(0.1, 0.3, square) is True


def test_zone_validation_rejects_unsafe_geometry():
    from cli.zone_support import ZoneValidationError, normalize_zone

    bowtie = [[0.1, 0.1], [0.8, 0.8], [0.1, 0.8], [0.8, 0.1]]
    try:
        normalize_zone({"zone_id": "bad", "points_norm": bowtie})
    except ZoneValidationError as exc:
        assert "self-intersect" in str(exc)
    else:
        raise AssertionError("Self-intersecting polygon was accepted.")

    try:
        normalize_zone({"zone_id": "tiny", "points_norm": [[0.1, 0.1], [0.101, 0.101]]})
    except ZoneValidationError as exc:
        assert "Line zones" in str(exc)
    else:
        raise AssertionError("Degenerate line zone was accepted.")


def test_zone_repository_normalizes_and_filters_by_video(tmp_path):
    from cli.zone_support import ZoneRepository

    path = tmp_path / "zones.json"
    path.write_text(json.dumps({
        "version": 1,
        "videos": {
            "*": {
                "zones": [{
                    "zone_id": "global_north",
                    "direction": "northbound",
                    "rect": [0.1, 0.1, 0.4, 0.4],
                }]
            },
            "clip_1": {
                "zones": [{
                    "zone_id": "clip_east",
                    "direction": "eastbound",
                    "points_norm": [[0.5, 0.5], [0.8, 0.5], [0.8, 0.8], [0.5, 0.8]],
                }]
            },
        },
    }), encoding="utf-8")

    zones = ZoneRepository(path=path).list_zones("clip_1")
    by_id = {zone["zone_id"]: zone for zone in zones}
    assert set(by_id) == {"global_north", "clip_east"}
    assert by_id["global_north"]["approach_ids"] == []
    assert by_id["global_north"]["points_norm"] == [[0.1, 0.1], [0.4, 0.1], [0.4, 0.4], [0.1, 0.4]]


def test_zone_repository_falls_back_to_metadata(tmp_path):
    from cli.zone_support import ZoneRepository

    metadata = tmp_path / "metadata.json"
    metadata.write_text(json.dumps({
        "monitoring_zones": [{
            "zone_id": "QSB_NB_TEST",
            "type": "queue_spillback",
            "approaches": [1, 2, 3],
            "polygon_px": [[0, 0], [640, 0], [640, 480], [0, 480]],
        }]
    }), encoding="utf-8")

    zones = ZoneRepository(path=tmp_path / "missing.json", metadata_path=metadata).list_zones()
    assert zones[0]["zone_id"] == "QSB_NB_TEST"
    assert zones[0]["direction"] == "northbound"
    assert zones[0]["points_norm"][2] == [0.5, 0.5]


def _json_request(url: str, method: str = "GET", payload: dict | None = None) -> dict:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method=method,
    )
    with request.urlopen(req, timeout=5) as response:  # noqa: S310 - local test server
        return json.loads(response.read().decode("utf-8"))


def test_zone_http_crud_round_trip(tmp_path):
    from core.start_live_simulation import LiveHandler
    from cli.zone_support import ZoneRepository

    repo = ZoneRepository(path=tmp_path / "zones.json")
    document = {
        "version": 1,
        "videos": {
            "*": {
                "zones": [{
                    "zone_id": "north_test",
                    "direction": "northbound",
                    "points_norm": [[0.1, 0.1], [0.4, 0.1], [0.4, 0.4], [0.1, 0.4]],
                }]
            }
        },
    }
    repo.save(document)

    handler = partial(LiveHandler, engine=FakeEngine(), chat_service=None, zone_repository=repo)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        zones = _json_request(base + "/api/zones?video_id=clip")
        assert zones["zones"][0]["zone_id"] == "north_test"

        zones["document"]["videos"]["clip"] = {
            "zones": [{
                "zone_id": "clip_zone",
                "direction": "eastbound",
                "points_norm": [[0.5, 0.5], [0.8, 0.5], [0.8, 0.8], [0.5, 0.8]],
            }]
        }
        saved = _json_request(base + "/api/zones", method="PUT", payload=zones["document"])
        assert any(zone["zone_id"] == "clip_zone" for zone in saved["document"]["videos"]["clip"]["zones"])

        after_delete = _json_request(base + "/api/zones/clip_zone", method="DELETE")
        assert all(zone["zone_id"] != "clip_zone" for zone in after_delete["document"]["videos"].get("clip", {}).get("zones", []))
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def test_zone_http_defaults_and_reset(tmp_path):
    from core.start_live_simulation import LiveHandler
    from cli.zone_support import ZoneRepository

    metadata = tmp_path / "metadata.json"
    metadata.write_text(json.dumps({
        "monitoring_zones": [{
            "zone_id": "DEFAULT_NB",
            "type": "queue_spillback",
            "approaches": [1, 2, 3],
            "polygon_px": [[0, 0], [640, 0], [640, 480], [0, 480]],
        }]
    }), encoding="utf-8")
    repo = ZoneRepository(path=tmp_path / "zones.json", metadata_path=metadata)
    repo.save({
        "version": 1,
        "videos": {
            "clip": {"zones": [{
                "zone_id": "clip_custom",
                "points_norm": [[0.2, 0.2], [0.4, 0.2], [0.4, 0.4], [0.2, 0.4]],
            }]}
        },
    })

    handler = partial(LiveHandler, engine=FakeEngine(), chat_service=None, zone_repository=repo)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        defaults = _json_request(base + "/api/zones/defaults")
        assert defaults["document"]["videos"]["*"]["zones"][0]["zone_id"] == "DEFAULT_NB"

        reset = _json_request(base + "/api/zones/reset", method="POST", payload={"video_id": "clip"})
        zone_ids = {zone["zone_id"] for zone in reset["zones"]}
        assert "DEFAULT_NB" in zone_ids
        assert "clip_custom" not in zone_ids
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
