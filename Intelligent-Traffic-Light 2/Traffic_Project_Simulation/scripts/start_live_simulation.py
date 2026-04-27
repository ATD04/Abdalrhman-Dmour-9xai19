#!/usr/bin/env python3

from __future__ import annotations

import argparse
import gzip
import io
import json
import logging
import mimetypes
import os
import time
import webbrowser
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from live_support import SIM_ROOT, load_live_config, setup_logging
from sumo_traci_runner import LiveSimulationEngine

logger = logging.getLogger("its.server")

# Endpoints whose responses are static enough to benefit from a long Cache-Control header.
_CACHEABLE_API_PREFIXES = ("/api/network-geometry", "/api/live-config")
_GZIP_MIN_BYTES = 1024  # Don't bother compressing tiny payloads

APP_ROOT = SIM_ROOT / "app"
DATA_ROOT = APP_ROOT / "data"
MEDIA_ROOT = APP_ROOT / "media"
VIDEO_MANIFEST_PATH = DATA_ROOT / "video_analytics_manifest.json"
VIDEO_TRACKING_ROOT = DATA_ROOT / "video_tracking"


class LiveHandler(SimpleHTTPRequestHandler):
    server_version = "WadiSaqraLive/1.0"

    def __init__(self, *args: Any, engine: LiveSimulationEngine, **kwargs: Any) -> None:
        self.engine = engine
        super().__init__(*args, directory=str(SIM_ROOT), **kwargs)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        route = parsed.path

        if route == "/api/health":
            state = self.engine.get_state()
            self.respond_json(
                {
                    "status": "ok",
                    "engine_status": state.get("status", "unknown"),
                    "source": state.get("source"),
                    "simulation_center": self.engine.manifest["simulation_center"],
                    "controller_tls_id": self.engine.controller_tls_id,
                }
            )
            return

        if route == "/api/live-config":
            self.respond_json(self.engine.public_config())
            return

        if route == "/api/live-state":
            cached = self.engine.get_state_json()
            if cached is not None:
                self.respond_json(None, raw_json=cached)
            else:
                self.respond_json(self.engine.get_state())
            return

        if route == "/api/live-history":
            self.respond_json(self.engine.get_history())
            return

        if route == "/api/network-geometry":
            self.respond_json(self.engine.get_network_geometry())
            return

        if route == "/api/live-events":
            self.stream_events()
            return

        if route == "/api/signal-recommendation":
            state = self.engine.get_state()
            rec = state.get("signal_recommendation")
            if rec:
                self.respond_json(rec)
            else:
                self.send_error(HTTPStatus.SERVICE_UNAVAILABLE, "Signal recommendation not yet computed.")
            return

        if route == "/api/flow-forecast":
            params = parse_qs(parsed.query)
            try:
                horizon = int(params.get("horizon", ["15"])[0])
            except (TypeError, ValueError):
                horizon = 15
            forecaster = getattr(self.engine, "forecaster", None)
            if forecaster is None:
                self.send_error(HTTPStatus.SERVICE_UNAVAILABLE, "Forecasting model is not enabled.")
                return
            horizons = sorted(set([5, 15, 30, max(5, min(60, horizon))]))
            try:
                forecast = forecaster.predict_all(horizons=horizons, live_state=self.engine.get_state())
            except Exception as exc:  # noqa: BLE001
                logger.warning("Forecast generation failed: %s", exc)
                self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, "Forecast generation failed.")
                return
            self.respond_json(forecast)
            return

        if route == "/api/anomaly":
            anomaly = self.engine.get_state().get("anomaly")
            if anomaly is None:
                self.send_error(HTTPStatus.SERVICE_UNAVAILABLE, "Anomaly detector has not produced a result yet.")
                return
            self.respond_json(anomaly)
            return

        if route == "/api/emissions":
            emissions = self.engine.get_state().get("emissions") or {}
            self.respond_json(emissions)
            return

        if route == "/api/data-source":
            source = getattr(self.engine, "data_source", None)
            if source is None:
                self.respond_json({"name": "legacy"})
            else:
                self.respond_json(source.describe())
            return

        if route == "/api/live-video-stats":
            processor = getattr(self.engine, "video_processor", None)
            if processor is None:
                self.send_error(HTTPStatus.SERVICE_UNAVAILABLE, "Live video processor not enabled.")
                return
            self.respond_json({
                "running": processor.is_running(),
                "stats": processor.get_per_direction_stats(),
                "describe": processor.describe(),
            })
            return

        # ── Video Analytics API ──────────────────────────────────
        if route == "/api/video-analytics-manifest":
            if VIDEO_MANIFEST_PATH.exists():
                manifest = json.loads(VIDEO_MANIFEST_PATH.read_text(encoding="utf-8"))
                self.respond_json(manifest)
            else:
                self.send_error(HTTPStatus.NOT_FOUND, "Video analytics manifest not found. Run build_video_analytics_dataset.py first.")
            return

        if route.startswith("/api/video-tracking/"):
            video_id = route.split("/")[-1]
            tracking_path = VIDEO_TRACKING_ROOT / f"{video_id}.json"
            if tracking_path.exists():
                tracking = json.loads(tracking_path.read_text(encoding="utf-8"))
                self.respond_json(tracking)
            else:
                self.send_error(HTTPStatus.NOT_FOUND, f"Tracking data not found for {video_id}.")
            return

        if route.startswith("/app/media/"):
            self._serve_media_file(head_only=False)
            return

        if route == "/":
            self.path = "/app/index.html"

        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path != "/api/adaptive-toggle":
            self.send_error(HTTPStatus.NOT_FOUND, "Unknown POST route.")
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        payload: dict[str, Any] = {}
        if content_length:
            raw = self.rfile.read(content_length).decode("utf-8")
            if raw:
                payload = json.loads(raw)
        enabled = payload.get("enabled")
        adaptive_state = self.engine.toggle_adaptive(enabled)
        self.respond_json({"adaptive_active": adaptive_state})

    def _accepts_gzip(self) -> bool:
        encoding = self.headers.get("Accept-Encoding", "")
        return "gzip" in encoding.lower()

    def _cache_control_for(self, path: str) -> str:
        if any(path.startswith(prefix) for prefix in _CACHEABLE_API_PREFIXES):
            return "public, max-age=3600"
        return "no-store"

    def respond_json(self, payload: Any, status: int = HTTPStatus.OK, *, raw_json: str | None = None) -> None:
        try:
            text = raw_json if raw_json is not None else json.dumps(payload, separators=(",", ":"))
        except (TypeError, ValueError) as exc:
            logger.error("JSON encode failed for %s: %s", self.path, exc)
            self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, "Server JSON encoding error")
            return
        content = text.encode("utf-8")

        # Compress responses ≥ 1KB when the client supports it
        send_gzip = len(content) >= _GZIP_MIN_BYTES and self._accepts_gzip()
        if send_gzip:
            buf = io.BytesIO()
            with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=5, mtime=0) as gz:
                gz.write(content)
            content = buf.getvalue()

        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", self._cache_control_for(self.path or ""))
        if send_gzip:
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Vary", "Accept-Encoding")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        try:
            self.wfile.write(content)
        except (BrokenPipeError, ConnectionResetError):
            # Client disconnected; not an error worth logging at WARNING
            pass

    def _serve_media_file(self, head_only: bool = False) -> None:
        parsed = urlparse(self.path)
        rel = parsed.path.lstrip("/")
        file_path = SIM_ROOT / rel
        if not file_path.exists():
            self.send_error(HTTPStatus.NOT_FOUND, "Media file not found.")
            return
        total_size = file_path.stat().st_size
        content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        range_header = self.headers.get("Range")
        if range_header and range_header.startswith("bytes="):
            value = range_header.removeprefix("bytes=")
            if "-" in value:
                start_text, end_text = value.split("-", 1)
                if start_text == "":
                    suffix_length = int(end_text)
                    start = max(total_size - suffix_length, 0)
                    end = total_size - 1
                else:
                    start = int(start_text)
                    end = int(end_text) if end_text else total_size - 1
                    end = min(end, total_size - 1)
                if start <= end:
                    length = end - start + 1
                    self.send_response(HTTPStatus.PARTIAL_CONTENT)
                    self.send_header("Content-Type", content_type)
                    self.send_header("Content-Length", str(length))
                    self.send_header("Content-Range", f"bytes {start}-{end}/{total_size}")
                    self.send_header("Accept-Ranges", "bytes")
                    self.end_headers()
                    if not head_only:
                        with file_path.open("rb") as fh:
                            fh.seek(start)
                            self.wfile.write(fh.read(length))
                    return
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(total_size))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()
        if not head_only:
            with file_path.open("rb") as fh:
                self.copyfile(fh, self.wfile)

    def stream_events(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

        last_version: int | None = None
        last_keepalive = time.monotonic()
        try:
            while True:
                # Wait up to 1s for a new state, otherwise emit a keepalive comment
                self.engine.wait_for_state_update(timeout=1.0)
                state = self.engine.get_state()
                version = state.get("state_version")
                now = time.monotonic()
                if version != last_version:
                    cached = self.engine.get_state_json()
                    payload = cached if cached is not None else json.dumps(state, separators=(",", ":"))
                    message = f"id: {version}\nevent: state\ndata: {payload}\n\n"
                    self.wfile.write(message.encode("utf-8"))
                    self.wfile.flush()
                    last_version = version
                    last_keepalive = now
                elif now - last_keepalive >= 15.0:
                    # SSE keepalive comment (ignored by EventSource clients)
                    self.wfile.write(b": keepalive\n\n")
                    self.wfile.flush()
                    last_keepalive = now
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception as exc:  # noqa: BLE001
            logger.warning("SSE stream terminated unexpectedly: %s", exc)
            return


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Start the live Google Routes + SUMO digital twin dashboard.")
    parser.add_argument("--config", help="Optional path to a live config JSON file.")
    parser.add_argument("--gui", action="store_true", help="Run SUMO using sumo-gui.")
    parser.add_argument("--open", action="store_true", help="Open the browser once the server starts.")
    parser.add_argument("--port", type=int, help="Override the configured HTTP port.")
    return parser.parse_args()


def build_server(host: str, port: int, handler: Any) -> tuple[ThreadingHTTPServer, int]:
    last_error: OSError | None = None
    for candidate in range(port, port + 20):
        try:
            return ThreadingHTTPServer((host, candidate), handler), candidate
        except OSError as error:
            last_error = error
            continue
    if last_error is not None:
        raise last_error
    raise OSError("Unable to bind the live server.")


def main() -> None:
    args = parse_args()
    log_level = os.environ.get("ITS_LOG_LEVEL", "INFO")
    log_dir = SIM_ROOT / "app" / "data"
    setup_logging(level=log_level, log_file=log_dir / "live_server.log")

    config = load_live_config(args.config)
    engine = LiveSimulationEngine(config, gui=args.gui)
    engine.start()
    logger.info("Live simulation engine started")

    host = config["server"]["host"]
    port = int(args.port or config["server"]["port"])

    def handler(*handler_args: Any, **handler_kwargs: Any) -> LiveHandler:
        return LiveHandler(*handler_args, engine=engine, **handler_kwargs)

    server, actual_port = build_server(host, port, handler)
    url = f"http://{host}:{actual_port}"
    logger.info("Live dashboard available at %s", url)
    logger.info("Health endpoint: %s/api/health", url)
    print(f"Live dashboard available at {url}")
    print(f"Health endpoint: {url}/api/health")

    if args.open:
        webbrowser.open(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Stopping live simulation (KeyboardInterrupt)")
        print("\nStopping live simulation.")
    finally:
        server.server_close()
        engine.stop()


if __name__ == "__main__":
    main()
