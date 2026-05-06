"""Operational situation report builder for Replay/Reports delivery features."""

from __future__ import annotations

import json
import logging
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger("its.reporting")

UTC = timezone.utc
DIRECTIONS = ("northbound", "southbound", "eastbound", "westbound")
SEVERITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}
REPORT_SCHEMA_VERSION = 1


def _num(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _now_iso() -> str:
    return datetime.now(UTC).astimezone().isoformat(timespec="seconds")


def _parse_time(value: Any) -> datetime | None:
    if not value:
        return None
    text = str(value)
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _direction_label(direction: str) -> str:
    return direction.replace("bound", "").title()


def _safe_json_loads(raw: str) -> dict[str, Any]:
    text = raw.strip()
    if text.startswith("```"):
        parts = [part for part in text.split("```") if part.strip()]
        if parts:
            text = parts[0]
        if text.lower().startswith("json"):
            text = text[4:].strip()
    return json.loads(text)


def _dedupe_incidents(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped = []
    seen: set[str] = set()
    for item in items:
        key = json.dumps(
            {
                "incident_type": item.get("incident_type") or item.get("type") or item.get("event_type"),
                "direction": item.get("direction"),
                "message": item.get("message"),
                "wall_time": item.get("wall_time"),
            },
            sort_keys=True,
            default=str,
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def validate_report_payload(payload: dict[str, Any]) -> dict[str, Any]:
    required_sections = {"status", "approaches", "incidents", "forecasts", "actions", "health"}
    if not isinstance(payload, dict):
        raise ValueError("Report payload must be a JSON object.")
    if payload.get("schema_version") != REPORT_SCHEMA_VERSION:
        raise ValueError("Report schema_version is invalid.")
    if payload.get("report_type") != "operational_situation":
        raise ValueError("Report type is invalid.")
    if not isinstance(payload.get("metadata"), dict):
        raise ValueError("Report metadata must be an object.")
    sections = payload.get("sections")
    if not isinstance(sections, dict) or required_sections - set(sections):
        raise ValueError("Report sections are incomplete.")
    if not isinstance(sections["approaches"], list) or len(sections["approaches"]) != len(DIRECTIONS):
        raise ValueError("Report must include one approach row per direction.")
    if not isinstance(sections["actions"], list):
        raise ValueError("Report actions must be a list.")
    json.dumps(payload, default=str)
    return payload


class SituationReportBuilder:
    """Builds deterministic situation reports with optional LLM phrasing."""

    def __init__(
        self,
        config: dict[str, Any],
        *,
        report_path: Path,
        ollama_client: Any | None = None,
    ) -> None:
        self.config = config
        self.report_path = report_path
        self.ollama_client = ollama_client

    def build(self, engine: Any, *, prefer_llm: bool = False, persist: bool = True) -> dict[str, Any]:
        state = engine.get_state() or {}
        history = engine.get_history() or []
        forecast = self._build_forecast(engine, state)
        report = self._build_deterministic_report(engine, state, history, forecast)

        llm_meta = {
            "requested": bool(prefer_llm),
            "used": False,
            "provider": getattr(self.ollama_client, "provider", None),
            "model": getattr(self.ollama_client, "model", None),
            "reason": "LLM enhancement not requested.",
        }
        if prefer_llm:
            report, llm_meta = self._maybe_enhance_report(report)

        report["metadata"]["llm"] = llm_meta
        if llm_meta["used"]:
            report["metadata"]["generation_mode"] = "llm_enhanced"

        validate_report_payload(report)
        if persist:
            self.report_path.parent.mkdir(parents=True, exist_ok=True)
            self.report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        return report

    def load_latest(self, engine: Any, *, auto_generate: bool = True) -> dict[str, Any]:
        if self.report_path.exists():
            try:
                payload = json.loads(self.report_path.read_text(encoding="utf-8"))
                return validate_report_payload(payload)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Latest report is invalid, rebuilding it: %s", exc)
        if not auto_generate:
            raise FileNotFoundError(self.report_path)
        return self.build(engine, prefer_llm=False, persist=True)

    def _build_forecast(self, engine: Any, state: dict[str, Any]) -> dict[str, Any]:
        forecaster = getattr(engine, "forecaster", None)
        if forecaster is None:
            return {
                "available": False,
                "mode": None,
                "generated_at": None,
                "horizons": [],
                "directions": {},
            }
        try:
            payload = forecaster.predict_all(horizons=(15, 30, 60), live_state=state)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Report forecast generation failed: %s", exc)
            return {
                "available": False,
                "mode": getattr(forecaster, "mode", None),
                "generated_at": None,
                "horizons": [],
                "directions": {},
                "error": str(exc),
            }
        return {
            "available": True,
            **payload,
        }

    def _collect_incidents(self, state: dict[str, Any], history: list[dict[str, Any]]) -> list[dict[str, Any]]:
        collected: list[dict[str, Any]] = []
        wall_time = state.get("wall_time")
        for item in (state.get("insights") or {}).get("events", []) or []:
            collected.append({
                "source": "insight",
                "wall_time": wall_time,
                **item,
            })
        for item in (state.get("anomaly") or {}).get("incidents", []) or []:
            collected.append({
                "source": "anomaly",
                "wall_time": wall_time,
                **item,
            })
        for item in state.get("video_incidents", []) or []:
            collected.append({
                "source": "video_incident",
                "wall_time": wall_time,
                **item,
            })
        for point in history[-20:]:
            point_time = point.get("wall_time")
            for item in point.get("events", []) or []:
                collected.append({
                    "source": "history_event",
                    "wall_time": point_time,
                    **item,
                })
            for item in point.get("anomaly_incidents", []) or []:
                collected.append({
                    "source": "history_anomaly",
                    "wall_time": point_time,
                    **item,
                })
            for item in point.get("video_incidents", []) or []:
                collected.append({
                    "source": "history_video_incident",
                    "wall_time": point_time,
                    **item,
                })
        incidents = _dedupe_incidents(collected)
        incidents.sort(
            key=lambda item: (
                SEVERITY_ORDER.get(str(item.get("severity") or "INFO").upper(), 9),
                item.get("wall_time") or "",
            )
        )
        return incidents

    def _build_actions(
        self,
        state: dict[str, Any],
        incidents: list[dict[str, Any]],
        approaches: list[dict[str, Any]],
        forecast: dict[str, Any],
    ) -> list[dict[str, Any]]:
        actions: list[dict[str, Any]] = []

        for incident in incidents:
            severity = str(incident.get("severity") or "INFO").upper()
            if severity not in {"CRITICAL", "HIGH"}:
                continue
            direction = incident.get("direction")
            actions.append({
                "priority": 1 if severity == "CRITICAL" else 2,
                "category": "incident_response",
                "direction": direction,
                "title": f"Inspect {_direction_label(direction)} approach immediately" if direction else "Inspect active incident immediately",
                "reason": incident.get("message") or incident.get("incident_type") or incident.get("type") or "Critical incident detected.",
                "source": incident.get("source"),
            })

        if forecast.get("available"):
            for direction in DIRECTIONS:
                forecasts = forecast.get("directions", {}).get(direction, [])
                sixty = next((item for item in forecasts if item.get("horizon_minutes") == 60), None)
                if not sixty:
                    continue
                if sixty.get("recommendation") == "EXTEND_GREEN" or sixty.get("spillback_risk") == "HIGH":
                    actions.append({
                        "priority": 3,
                        "category": "signal_timing",
                        "direction": direction,
                        "title": f"Prepare longer green on {_direction_label(direction)}",
                        "reason": (
                            f"60-minute forecast is {round(_num(sixty.get('veh_per_hour')))} veh/h with "
                            f"{sixty.get('spillback_risk', 'LOW')} spillback risk."
                        ),
                        "source": "forecast",
                    })

        hottest = max(approaches, key=lambda item: item.get("queue_m", 0.0), default=None)
        if hottest and hottest.get("queue_m", 0.0) >= 40.0:
            actions.append({
                "priority": 4,
                "category": "corridor_management",
                "direction": hottest.get("direction"),
                "title": f"Monitor discharge on {_direction_label(hottest.get('direction', 'northbound'))}",
                "reason": (
                    f"Current queue is {round(_num(hottest.get('queue_m')))} m with "
                    f"{round(_num(hottest.get('google_delay_s')))} s corridor delay."
                ),
                "source": "live_state",
            })

        if not actions:
            actions.append({
                "priority": 5,
                "category": "monitoring",
                "direction": state.get("insights", {}).get("dominant_queue_direction"),
                "title": "Maintain current plan and keep monitoring",
                "reason": "No critical incidents or spillback-risk forecasts require intervention right now.",
                "source": "rule_fallback",
            })

        deduped = []
        seen: set[tuple[Any, ...]] = set()
        for action in actions:
            key = (action.get("category"), action.get("direction"), action.get("title"))
            if key in seen:
                continue
            seen.add(key)
            deduped.append(action)
        deduped.sort(key=lambda item: (int(item.get("priority", 99)), item.get("direction") or ""))
        return deduped[:5]

    def _build_status_summary(
        self,
        state: dict[str, Any],
        incidents: list[dict[str, Any]],
        actions: list[dict[str, Any]],
    ) -> str:
        insights = state.get("insights") or {}
        queue_total = round(_num(insights.get("total_queue_m")), 1)
        avg_speed = round(_num(insights.get("avg_network_speed_kmh")), 1)
        dominant = insights.get("dominant_queue_direction") or "unknown"
        severe_count = sum(1 for item in incidents if str(item.get("severity") or "").upper() in {"CRITICAL", "HIGH"})
        lead_action = actions[0]["title"] if actions else "Continue monitoring"
        return (
            f"Network queue is {queue_total:.1f} m at {avg_speed:.1f} km/h average speed. "
            f"The most stressed approach is {_direction_label(dominant)}. "
            f"{severe_count} high-severity incident(s) are active or recently confirmed. "
            f"Recommended next move: {lead_action}."
        )

    def _build_health(self, engine: Any, state: dict[str, Any], history: list[dict[str, Any]], forecast: dict[str, Any]) -> dict[str, Any]:
        wall_time = _parse_time(state.get("wall_time"))
        data_age_s = None
        if wall_time is not None:
            data_age_s = round((datetime.now(wall_time.tzinfo or UTC) - wall_time).total_seconds(), 1)

        video_processor = getattr(engine, "video_processor", None)
        if video_processor is not None:
            try:
                video_health = video_processor.describe()
            except Exception as exc:  # noqa: BLE001
                video_health = {"enabled": False, "running": False, "error": str(exc)}
        else:
            video_health = {"enabled": False, "running": False}

        return {
            "engine_status": state.get("status", "unknown"),
            "data_source": state.get("source"),
            "history_points": len(history),
            "data_freshness_s": data_age_s,
            "forecasting": {
                "available": bool(forecast.get("available")),
                "mode": forecast.get("mode"),
                "horizons": forecast.get("horizons", []),
            },
            "video": video_health,
            "alert_dispatch": state.get("alert_dispatch") or {"enabled": False},
        }

    def _build_deterministic_report(
        self,
        engine: Any,
        state: dict[str, Any],
        history: list[dict[str, Any]],
        forecast: dict[str, Any],
    ) -> dict[str, Any]:
        baseline = history[0] if history else {}
        baseline_dir = (baseline.get("per_direction") or baseline.get("metrics") or {})
        metrics = state.get("metrics") or {}
        google = state.get("google_snapshot") or {}
        demand = state.get("demand") or {}
        incidents = self._collect_incidents(state, history)

        approaches = []
        for direction in DIRECTIONS:
            current = metrics.get(direction, {}) or {}
            previous = baseline_dir.get(direction, {}) or {}
            google_dir = google.get(direction, {}) or {}
            demand_dir = demand.get(direction, {}) or {}
            approaches.append({
                "direction": direction,
                "queue_m": round(_num(current.get("queue_m")), 1),
                "flow_veh_h": round(_num(current.get("flow_veh_h")), 1),
                "avg_speed_kmh": round(_num(current.get("avg_speed_kmh")), 1),
                "google_delay_s": round(_num(google_dir.get("delay_s")), 1),
                "congestion_level": google_dir.get("congestion_level"),
                "pressure_index": round(_num(demand_dir.get("pressure_index")), 3),
                "saturation_ratio": round(_num(demand_dir.get("saturation_ratio")), 3),
                "queue_delta_m": round(_num(current.get("queue_m")) - _num(previous.get("queue_m")), 1),
                "speed_delta_kmh": round(_num(current.get("avg_speed_kmh")) - _num(previous.get("avg_speed_kmh")), 1),
            })

        actions = self._build_actions(state, incidents, approaches, forecast)
        status = {
            "summary": self._build_status_summary(state, incidents, actions),
            "engine_status": state.get("status", "unknown"),
            "source": state.get("source"),
            "phase_label": (state.get("signal_plan") or {}).get("phase_label"),
            "adaptive_active": bool(state.get("adaptive_active")),
            "network_queue_m": round(_num((state.get("insights") or {}).get("total_queue_m")), 1),
            "network_avg_speed_kmh": round(_num((state.get("insights") or {}).get("avg_network_speed_kmh")), 1),
            "dominant_queue_direction": (state.get("insights") or {}).get("dominant_queue_direction"),
        }

        recent_incidents = deepcopy(incidents[:10])
        by_severity: dict[str, int] = {}
        for item in incidents:
            severity = str(item.get("severity") or "INFO").upper()
            by_severity[severity] = by_severity.get(severity, 0) + 1

        oldest = history[0].get("wall_time") if history else state.get("wall_time")
        newest = history[-1].get("wall_time") if history else state.get("wall_time")
        oldest_dt = _parse_time(oldest)
        newest_dt = _parse_time(newest)
        duration_s = 0.0
        if oldest_dt is not None and newest_dt is not None:
            duration_s = round(max(0.0, (newest_dt - oldest_dt).total_seconds()), 1)

        report = {
            "schema_version": REPORT_SCHEMA_VERSION,
            "report_type": "operational_situation",
            "generated_at": _now_iso(),
            "metadata": {
                "report_id": f"sitrep-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}",
                "generation_mode": "deterministic_rule_based",
                "time_window": {
                    "history_points": len(history),
                    "window_start": oldest,
                    "window_end": newest,
                    "duration_s": duration_s,
                },
            },
            "sections": {
                "status": status,
                "approaches": approaches,
                "incidents": {
                    "active_count": len(incidents),
                    "high_severity_count": sum(by_severity.get(level, 0) for level in ("CRITICAL", "HIGH")),
                    "by_severity": by_severity,
                    "recent": recent_incidents,
                },
                "forecasts": forecast,
                "actions": actions,
                "health": self._build_health(engine, state, history, forecast),
            },
        }
        return report

    def _maybe_enhance_report(self, base_report: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
        if self.ollama_client is None:
            return base_report, {
                "requested": True,
                "used": False,
                "provider": None,
                "model": None,
                "reason": "No Ollama client was provided for enhancement.",
            }

        try:
            health = self.ollama_client.health()
        except Exception as exc:  # noqa: BLE001
            return base_report, {
                "requested": True,
                "used": False,
                "provider": getattr(self.ollama_client, "provider", None),
                "model": getattr(self.ollama_client, "model", None),
                "reason": f"Ollama health check failed: {exc}",
            }

        if not health.get("ready"):
            return base_report, {
                "requested": True,
                "used": False,
                "provider": health.get("provider"),
                "model": health.get("model"),
                "reason": health.get("reason") or "Ollama is unavailable.",
            }

        action_seed = [
            {
                "priority": item.get("priority"),
                "direction": item.get("direction"),
                "title": item.get("title"),
                "reason": item.get("reason"),
            }
            for item in base_report["sections"]["actions"]
        ]
        prompt = (
            "Return JSON only. Rewrite the operational summary and action wording without changing meaning.\n"
            'Schema: {"status_summary":"string","actions":[{"priority":1,"title":"string","reason":"string"}]}\n'
            f"Current summary: {base_report['sections']['status']['summary']}\n"
            f"Actions: {json.dumps(action_seed, ensure_ascii=False)}"
        )
        try:
            raw = self.ollama_client.generate_answer(prompt)
            parsed = _safe_json_loads(raw)
            if not isinstance(parsed, dict):
                raise ValueError("LLM response is not a JSON object.")
            status_summary = str(parsed.get("status_summary") or "").strip()
            actions_payload = parsed.get("actions", [])
            if actions_payload and not isinstance(actions_payload, list):
                raise ValueError("LLM actions must be a list.")

            enhanced = deepcopy(base_report)
            if status_summary:
                enhanced["sections"]["status"]["summary"] = status_summary[:500]

            by_priority = {int(item.get("priority", 0)): item for item in actions_payload if isinstance(item, dict)}
            for action in enhanced["sections"]["actions"]:
                replacement = by_priority.get(int(action.get("priority", 0)))
                if not replacement:
                    continue
                title = str(replacement.get("title") or "").strip()
                reason = str(replacement.get("reason") or "").strip()
                if title:
                    action["title"] = title[:180]
                if reason:
                    action["reason"] = reason[:280]

            validate_report_payload(enhanced)
            return enhanced, {
                "requested": True,
                "used": True,
                "provider": health.get("provider"),
                "model": health.get("model"),
                "reason": None,
            }
        except Exception as exc:  # noqa: BLE001
            logger.warning("LLM report enhancement failed; falling back: %s", exc)
            return base_report, {
                "requested": True,
                "used": False,
                "provider": health.get("provider"),
                "model": health.get("model"),
                "reason": f"Fell back to deterministic report: {exc}",
            }
