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

if __package__ in (None, ""):
    # Allow: python3 scripts/core/start_live_simulation.py
    sys_path_root = Path(__file__).resolve().parents[1]
    import sys

    if str(sys_path_root) not in sys.path:
        sys.path.insert(0, str(sys_path_root))

try:  # package context: scripts.core.start_live_simulation
    from .live_support import SIM_ROOT, load_live_config, setup_logging
    from .replay import build_replay_payload
    from .reporting import SituationReportBuilder
    from ..simulation.simulation_lab import WhatIfJobStore
    from .sumo_traci_runner import LiveSimulationEngine
    from ..utils.traffic_counts import build_traffic_count_snapshot
    from ..cli.zone_support import ZoneRepository, ZoneValidationError, public_zone_payload
except ImportError:  # direct/top-level context used by tests and one-click wrapper
    from core.live_support import SIM_ROOT, load_live_config, setup_logging
    from core.replay import build_replay_payload
    from core.reporting import SituationReportBuilder
    from simulation.simulation_lab import WhatIfJobStore
    from core.sumo_traci_runner import LiveSimulationEngine
    from utils.traffic_counts import build_traffic_count_snapshot
    from cli.zone_support import ZoneRepository, ZoneValidationError, public_zone_payload

logger = logging.getLogger("its.server")

# Endpoints whose responses are static enough to benefit from a long Cache-Control header.
_CACHEABLE_API_PREFIXES = ("/api/network-geometry", "/api/live-config")
_GZIP_MIN_BYTES = 1024  # Don't bother compressing tiny payloads

APP_ROOT = SIM_ROOT / "app"
DATA_ROOT = APP_ROOT / "data"
MEDIA_ROOT = APP_ROOT / "media"
VIDEO_MANIFEST_PATH = DATA_ROOT / "video_analytics_manifest.json"
VIDEO_TRACKING_ROOT = DATA_ROOT / "video_tracking"
SITUATION_REPORT_PATH = DATA_ROOT / "latest_situation_report.json"
WHAT_IF_JOBS = WhatIfJobStore()


class LiveHandler(SimpleHTTPRequestHandler):
    server_version = "WadiSaqraLive/1.0"

    def __init__(
        self,
        *args: Any,
        engine: LiveSimulationEngine,
        chat_service: Any = None,
        zone_repository: ZoneRepository | None = None,
        **kwargs: Any,
    ) -> None:
        self.engine = engine
        self.chat_service = chat_service
        self.zone_repository = zone_repository or ZoneRepository()
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

        if route == "/api/replay":
            self.respond_json(build_replay_payload(self.engine.get_history()))
            return

        if route == "/api/report/latest":
            builder = SituationReportBuilder(
                self.engine.config,
                report_path=SITUATION_REPORT_PATH,
                ollama_client=getattr(self.chat_service, "ollama", None),
            )
            try:
                self.respond_json(builder.load_latest(self.engine, auto_generate=True))
            except Exception as exc:  # noqa: BLE001
                logger.warning("Latest report load failed: %s", exc)
                self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, "Latest report could not be generated.")
            return

        if route == "/api/network-geometry":
            self.respond_json(self.engine.get_network_geometry())
            return

        if route == "/api/live-events":
            self.stream_events()
            return

        if route == "/api/zones":
            params = parse_qs(parsed.query)
            video_id = params.get("video_id", [None])[0]
            self.respond_json(public_zone_payload(video_id, self.zone_repository))
            return

        if route == "/api/zones/defaults":
            self.respond_json({
                "document": self.zone_repository.defaults(),
                "source": "metadata_defaults",
            })
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
                try:
                    DATA_ROOT.mkdir(parents=True, exist_ok=True)
                    (DATA_ROOT / "latest_flow_forecast.json").write_text(
                        json.dumps(forecast, indent=2),
                        encoding="utf-8",
                    )
                except Exception as exc:  # noqa: BLE001
                    logger.debug("Could not persist latest forecast snapshot: %s", exc)
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

        if route == "/api/alert-dispatch":
            dispatcher = getattr(self.engine, "alert_dispatcher", None)
            if dispatcher is None:
                self.respond_json({"enabled": False, "reason": "Alert dispatcher not initialised."})
            else:
                self.respond_json(dispatcher.describe())
            return

        if route == "/api/chat/health":
            if self.chat_service is None:
                self.respond_json({"ready": False, "reason": "Chat service not initialised."})
            else:
                self.respond_json(self.chat_service.health())
            return

        if route.startswith("/api/chat/reference/"):
            ref_id = route.rsplit("/", 1)[-1]
            if self.chat_service is None:
                self.respond_json({"error": "Chat service not initialised."}, status=HTTPStatus.SERVICE_UNAVAILABLE)
                return
            reference = self.chat_service.materialize_reference(ref_id)
            if reference is None:
                self.respond_json({"error": f"Unknown reference id: {ref_id}"}, status=HTTPStatus.NOT_FOUND)
                return
            self.respond_json(reference)
            return

        if route == "/api/live-video-stats":
            processor = getattr(self.engine, "video_processor", None)
            if processor is None:
                self.send_error(HTTPStatus.SERVICE_UNAVAILABLE, "Live video processor not enabled.")
                return
            self.respond_json({
                "running": processor.is_running(),
                "stats": processor.get_per_direction_stats(),
                "incidents": processor.get_incident_events() if hasattr(processor, "get_incident_events") else [],
                "describe": processor.describe(),
            })
            return

        if route == "/api/model-evaluation":
            eval_path = DATA_ROOT / "model_evaluation.json"
            if eval_path.exists():
                self.respond_json(json.loads(eval_path.read_text(encoding="utf-8")))
            else:
                self.respond_json({"error": "No evaluation data. Run: python3 scripts/utils/backtester.py"})
            return

        if route == "/api/analytics/peak-hours":
            peak_hours = self.engine.get_peak_hours()
            if peak_hours is None:
                self.send_error(HTTPStatus.SERVICE_UNAVAILABLE, "Peak-hour analytics not available.")
                return
            self.respond_json(peak_hours)
            return

        if route == "/api/analytics/volume-heatmap":
            analytics = self.engine.get_historical_analytics()
            if analytics is None:
                self.send_error(HTTPStatus.SERVICE_UNAVAILABLE, "Historical volume analytics not available.")
                return
            self.respond_json(analytics)
            return

        if route == "/api/analytics/traffic-counts":
            processor = getattr(self.engine, "video_processor", None)
            video_stats = None
            if processor is not None and processor.is_running():
                video_stats = {"stats": processor.get_per_direction_stats(), "describe": processor.describe()}
            self.respond_json(build_traffic_count_snapshot(self.engine.get_state(), self.engine.get_history(), video_stats))
            return

        if route.startswith("/api/simulation/what-if/"):
            job_id = route.rsplit("/", 1)[-1]
            job = WHAT_IF_JOBS.get(job_id)
            if job is None:
                self.respond_json({"error": f"Unknown what-if job: {job_id}"}, status=HTTPStatus.NOT_FOUND)
                return
            self.respond_json(job)
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

    def _read_json_payload(self) -> dict[str, Any] | None:
        content_length = int(self.headers.get("Content-Length", "0"))
        payload: dict[str, Any] = {}
        if content_length:
            try:
                raw = self.rfile.read(content_length).decode("utf-8")
                if raw:
                    payload = json.loads(raw)
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                self.send_error(HTTPStatus.BAD_REQUEST, f"Invalid JSON body: {exc}")
                return None
        return payload

    def do_PUT(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        payload = self._read_json_payload()
        if payload is None:
            return

        if parsed.path == "/api/zones":
            try:
                saved = self.zone_repository.save(payload)
            except ZoneValidationError as exc:
                self.send_error(HTTPStatus.BAD_REQUEST, str(exc))
                return
            self.respond_json(public_zone_payload(None, self.zone_repository) | {"document": saved})
            return

        self.send_error(HTTPStatus.NOT_FOUND, f"Unknown PUT route: {parsed.path}")

    def do_DELETE(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/zones/"):
            zone_id = parsed.path.rsplit("/", 1)[-1]
            if not zone_id:
                self.send_error(HTTPStatus.BAD_REQUEST, "Missing zone id.")
                return
            try:
                self.zone_repository.delete(zone_id)
            except KeyError:
                self.send_error(HTTPStatus.NOT_FOUND, f"Unknown zone id: {zone_id}")
                return
            self.respond_json(public_zone_payload(None, self.zone_repository))
            return

        self.send_error(HTTPStatus.NOT_FOUND, f"Unknown DELETE route: {parsed.path}")

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        payload = self._read_json_payload()
        if payload is None:
            return

        if parsed.path == "/api/adaptive-toggle":
            enabled = payload.get("enabled")
            adaptive_state = self.engine.toggle_adaptive(enabled)
            self.respond_json({"adaptive_active": adaptive_state})
            return

        if parsed.path == "/api/assistant/query":
            query = str(payload.get("query", "")).strip()
            if not query:
                self.send_error(HTTPStatus.BAD_REQUEST, "Request body must include a non-empty 'query' field.")
                return
            try:
                from ..cli.assistant_query import answer_query
            except ImportError:
                from cli.assistant_query import answer_query

            response = answer_query(
                query,
                self.engine.get_state(),
                self.engine.get_history(),
                self.engine.get_peak_hours(),
            )
            self.respond_json(response)
            return

        if parsed.path == "/api/chat/query":
            if self.chat_service is None:
                self.respond_json({"answer": None, "refusal_reason": "Chat service not initialised."}, status=HTTPStatus.SERVICE_UNAVAILABLE)
                return
            try:
                response = self.chat_service.query(payload)
            except ValueError as exc:
                self.send_error(HTTPStatus.BAD_REQUEST, str(exc))
                return
            self.respond_json(response)
            return

        if parsed.path == "/api/chat/reset":
            if self.chat_service is None:
                self.respond_json({"reset": False, "reason": "Chat service not initialised."}, status=HTTPStatus.SERVICE_UNAVAILABLE)
                return
            self.respond_json(self.chat_service.reset(payload.get("conversation_id")))
            return

        if parsed.path == "/api/fusion-toggle":
            # Toggle sensor fusion on/off at runtime
            source = getattr(self.engine, "data_source", None)
            if source is None:
                self.send_error(HTTPStatus.SERVICE_UNAVAILABLE, "Composite data source not initialised.")
                return
            enabled = payload.get("enabled")
            if enabled is None:
                source.fusion_enabled = not source.fusion_enabled
            else:
                source.fusion_enabled = bool(enabled)
            self.respond_json({
                "fusion_enabled": source.fusion_enabled,
                "sources": [source.primary.name] + [s.name for s in source.fallbacks],
            })
            return

        if parsed.path == "/api/simulation/what-if":
            job = WHAT_IF_JOBS.submit(payload, self.engine.get_state())
            status = HTTPStatus.BAD_REQUEST if job.get("status") == "failed" else HTTPStatus.ACCEPTED
            self.respond_json(job, status=status)
            return

        if parsed.path == "/api/zones/reset":
            video_id = payload.get("video_id")
            saved = self.zone_repository.reset(str(video_id) if video_id else None)
            self.respond_json(public_zone_payload(str(video_id) if video_id else None, self.zone_repository) | {"document": saved})
            return

        if parsed.path == "/api/report/generate":
            prefer_llm = bool(payload.get("prefer_llm") or payload.get("use_llm"))
            builder = SituationReportBuilder(
                self.engine.config,
                report_path=SITUATION_REPORT_PATH,
                ollama_client=getattr(self.chat_service, "ollama", None),
            )
            try:
                report = builder.build(self.engine, prefer_llm=prefer_llm, persist=True)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Report generation failed: %s", exc)
                self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, "Report generation failed.")
                return
            self.respond_json(report, status=HTTPStatus.CREATED)
            return

        self.send_error(HTTPStatus.NOT_FOUND, f"Unknown POST route: {parsed.path}")

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
    from chat.service import ChatService

    chat_service = ChatService(config, engine)

    host = config["server"]["host"]
    port = int(args.port or config["server"]["port"])

    def handler(*handler_args: Any, **handler_kwargs: Any) -> LiveHandler:
        return LiveHandler(*handler_args, engine=engine, chat_service=chat_service, **handler_kwargs)

    server, actual_port = build_server(host, port, handler)
    display_host = "localhost" if host == "0.0.0.0" else host
    url = f"http://{display_host}:{actual_port}"
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
