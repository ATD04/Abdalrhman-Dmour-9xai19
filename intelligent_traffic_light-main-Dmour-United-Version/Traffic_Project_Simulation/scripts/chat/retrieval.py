"""Read-only retrieval tools over live and historical Wadi Saqra data."""

from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

from .citations import ReferenceRegistry

SIM_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = SIM_ROOT.parent
SANDBOX_ROOT = PROJECT_ROOT / "Traffic_Data_Sandbox"
APP_DATA_ROOT = SIM_ROOT / "app" / "data"

DIRECTIONS = ("northbound", "southbound", "eastbound", "westbound")
WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
DIRECTION_APPROACHES = {
    "northbound": {"1", "2", "3"},
    "southbound": {"4", "5", "6"},
    "eastbound": {"7", "8", "9"},
    "westbound": {"10", "11", "12", "13", "14"},
}
DIRECTION_ALIASES = {
    "northbound": ("northbound", "north", "north side", "الشمال", "شمال", "شمالي", "جهة الشمال", "من الشمال", "الشمالي", "شمالا"),
    "southbound": ("southbound", "south", "south side", "الجنوب", "جنوب", "جنوبي", "جهة الجنوب", "من الجنوب", "الجنوبي", "جنوبا"),
    "eastbound": ("eastbound", "east", "east side", "الشرق", "شرق", "شرقي", "جهة الشرق", "من الشرق", "الشرقي", "شرقا"),
    "westbound": ("westbound", "west", "west side", "الغرب", "غرب", "غربي", "جهة الغرب", "من الغرب", "الغربي", "غربا"),
}


def normalize_direction(value: Any) -> str | None:
    text = str(value or "").strip().lower()
    if not text:
        return None
    if text.isdigit():
        return direction_for_approach(text)
    for direction, aliases in DIRECTION_ALIASES.items():
        if any(alias in text for alias in aliases):
            return direction
    return None


def direction_for_approach(approach_id: str | int | None) -> str | None:
    if approach_id is None:
        return None
    candidate = str(approach_id)
    for direction, approach_ids in DIRECTION_APPROACHES.items():
        if candidate in approach_ids:
            return direction
    return None


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


class TrafficRetrieval:
    """Tool implementation used by the local MCP-style server."""

    def __init__(self, engine: Any, references: ReferenceRegistry) -> None:
        self.engine = engine
        self.references = references
        self._historical_analytics: dict[str, Any] | None = None

    def _state(self) -> dict[str, Any]:
        persisted_state = _read_json(APP_DATA_ROOT / "last_live_state.json", {})
        try:
            state = self.engine.get_state()
            if isinstance(state, dict):
                merged = dict(persisted_state) if isinstance(persisted_state, dict) else {}
                merged.update(state)
                if not merged.get("google_snapshot"):
                    snapshot = _read_json(APP_DATA_ROOT / "live_traffic_snapshot.json", {})
                    if isinstance(snapshot, dict) and snapshot.get("approaches"):
                        merged["google_snapshot"] = snapshot.get("approaches", {})
                        merged.setdefault("wall_time", snapshot.get("timestamp"))
                        merged.setdefault("source", snapshot.get("source"))
                return merged
        except Exception:  # noqa: BLE001
            pass
        if isinstance(persisted_state, dict) and persisted_state:
            return persisted_state
        snapshot = _read_json(APP_DATA_ROOT / "live_traffic_snapshot.json", {})
        if isinstance(snapshot, dict) and snapshot.get("approaches"):
            return {
                "wall_time": snapshot.get("timestamp"),
                "source": snapshot.get("source"),
                "google_snapshot": snapshot.get("approaches", {}),
            }
        return {}

    def _history(self) -> list[dict[str, Any]]:
        try:
            history = self.engine.get_history()
            if isinstance(history, list):
                return history
        except Exception:  # noqa: BLE001
            pass
        payload = _read_json(APP_DATA_ROOT / "live_history.json", [])
        return payload if isinstance(payload, list) else []

    def _network_geometry(self) -> dict[str, Any]:
        try:
            geometry = self.engine.get_network_geometry()
            if isinstance(geometry, dict):
                return geometry
        except Exception:  # noqa: BLE001
            pass
        return _read_json(APP_DATA_ROOT / "live_network_geometry.json", {})

    def _analytics(self) -> dict[str, Any]:
        if self._historical_analytics:
            return self._historical_analytics
        try:
            analytics = self.engine.get_historical_analytics()
            if isinstance(analytics, dict):
                self._historical_analytics = analytics
                return analytics
        except Exception:  # noqa: BLE001
            pass
        self._historical_analytics = self._build_detector_analytics()
        return self._historical_analytics

    def _citation(
        self,
        *,
        source_type: str,
        title: str,
        locator: str,
        ui_target: str,
        payload: Any,
        timestamp_or_range: str | None = None,
        file_origin: str | None = None,
        api_origin: str | None = None,
    ) -> dict[str, Any]:
        return self.references.register(
            source_type=source_type,
            title=title,
            locator=locator,
            ui_target=ui_target,
            structured_payload=payload,
            timestamp_or_range=timestamp_or_range,
            file_origin=file_origin,
            api_origin=api_origin,
        )

    def _tool_result(
        self,
        name: str,
        data: Any,
        citations: list[dict[str, Any]],
        time_scope: str,
    ) -> dict[str, Any]:
        return {"tool": name, "data": data, "citations": citations, "time_scope": time_scope}

    def get_live_state_summary(self, direction: str | None = None) -> dict[str, Any]:
        direction = normalize_direction(direction) if direction else None
        state = self._state()
        if direction:
            return self.get_live_direction_metrics(direction)
        approach_data = state.get("google_snapshot", {}) or {}
        metrics_data = state.get("metrics", {}) or {}
        if not approach_data and not metrics_data:
            return self._tool_result("get_live_state_summary", {"error": "No live state available."}, [], "live")
        ranked = sorted(
            ((float(v.get("delay_s", 0.0)), k) for k, v in approach_data.items()),
            reverse=True,
        )
        worst = ranked[0][1] if ranked else None
        data = {
            "wall_time": state.get("wall_time"),
            "source": state.get("source"),
            "dominant_queue_direction": state.get("insights", {}).get("dominant_queue_direction"),
            "worst_delay_direction": worst,
            "directions": approach_data,
        }
        citation = self._citation(
            source_type="live_state",
            title="Current live traffic state",
            locator="live_state.directions",
            ui_target="tab-dashboard:data-source-banner",
            payload=data,
            timestamp_or_range=state.get("wall_time"),
            api_origin="/api/live-state",
        )
        return self._tool_result("get_live_state_summary", data, [citation], "live")

    def get_live_direction_metrics(self, direction: str) -> dict[str, Any]:
        direction = normalize_direction(direction) or direction
        state = self._state()
        corridor = (state.get("google_snapshot", {}) or {}).get(direction, {})
        metrics = (state.get("metrics", {}) or {}).get(direction, {})
        demand = (state.get("demand", {}) or {}).get(direction, {})
        if not corridor and not metrics:
            return self._tool_result("get_live_direction_metrics", {"error": f"No live data for {direction}."}, [], "live")
        data = {
            "direction": direction,
            "wall_time": state.get("wall_time"),
            "source": state.get("source"),
            "corridor_travel_time": corridor,
            "simulation_metrics": metrics,
            "demand": demand,
        }
        citation = self._citation(
            source_type="live_state",
            title=f"Current {direction} live readings",
            locator=f"live_state.direction.{direction}",
            ui_target="tab-dashboard:dash-kpi-row",
            payload=data,
            timestamp_or_range=state.get("wall_time"),
            api_origin="/api/live-state",
        )
        return self._tool_result("get_live_direction_metrics", data, [citation], "live")

    def get_live_history_window(self, direction: str, minutes: int = 5) -> dict[str, Any]:
        direction = normalize_direction(direction) or direction
        minutes = max(1, min(int(minutes or 5), 60))
        history = self._history()
        if not history:
            return self._tool_result("get_live_history_window", {"error": "No live history available."}, [], "live")
        sample_count = max(1, min(len(history), minutes * 60))
        points = history[-sample_count:]
        values = [point.get("per_direction", {}).get(direction, {}) for point in points]
        queue_values = [float(value.get("queue_m", 0.0)) for value in values]
        speed_values = [float(value.get("avg_speed_kmh", 0.0)) for value in values]
        flow_values = [float(value.get("flow_veh_h", 0.0)) for value in values]
        data = {
            "direction": direction,
            "minutes": minutes,
            "samples": len(points),
            "start_time": points[0].get("wall_time"),
            "end_time": points[-1].get("wall_time"),
            "average_queue_m": round(sum(queue_values) / len(queue_values), 1) if queue_values else None,
            "average_speed_kmh": round(sum(speed_values) / len(speed_values), 1) if speed_values else None,
            "average_flow_veh_h": round(sum(flow_values) / len(flow_values), 1) if flow_values else None,
        }
        citation = self._citation(
            source_type="live_history",
            title=f"{direction} live history window",
            locator=f"live_history.{direction}.last_{minutes}_minutes",
            ui_target="tab-dashboard:history-chart",
            payload=data,
            timestamp_or_range=f"{data['start_time']} to {data['end_time']}",
            api_origin="/api/live-history",
        )
        return self._tool_result("get_live_history_window", data, [citation], "live")

    def get_signal_plan(self, direction: str | None = None) -> dict[str, Any]:
        direction = normalize_direction(direction) if direction else None
        state = self._state()
        plan = state.get("signal_plan", {}) or {}
        if direction:
            data = {
                "direction": direction,
                "active": direction in (plan.get("active_directions") or []),
                "signal_plan": plan,
                "signal_recommendation": state.get("signal_recommendation"),
            }
        else:
            data = {"signal_plan": plan, "signal_recommendation": state.get("signal_recommendation")}
        citation = self._citation(
            source_type="live_state",
            title="Current signal plan",
            locator="live_state.signal_plan",
            ui_target="tab-dashboard:signal-phase-summary",
            payload=data,
            timestamp_or_range=state.get("wall_time"),
            api_origin="/api/live-state",
        )
        return self._tool_result("get_signal_plan", data, [citation], "live")

    def get_current_recommendations(self, direction: str | None = None) -> dict[str, Any]:
        direction = normalize_direction(direction) if direction else None
        state = self._state()
        insights = state.get("insights", {}) or {}
        anomaly = state.get("anomaly", {}) or {}
        events = list(insights.get("events", []) or [])
        incidents = list(anomaly.get("incidents", []) or [])
        if direction:
            events = [event for event in events if event.get("direction") == direction]
            incidents = [incident for incident in incidents if incident.get("direction") == direction]
        data = {
            "direction": direction,
            "recommendation": insights.get("recommendation"),
            "events": events,
            "anomaly_incidents": incidents,
        }
        citation = self._citation(
            source_type="insight",
            title="Current decision-support insights",
            locator=f"live_state.insights.{direction or 'all'}",
            ui_target="tab-dashboard:recommendation",
            payload=data,
            timestamp_or_range=state.get("wall_time"),
            api_origin="/api/live-state",
        )
        return self._tool_result("get_current_recommendations", data, [citation], "live")

    def get_current_anomalies(self, direction: str | None = None) -> dict[str, Any]:
        direction = normalize_direction(direction) if direction else None
        state = self._state()
        anomaly = state.get("anomaly", {}) or {}
        data = anomaly
        if direction and anomaly.get("directions"):
            data = {
                "direction": direction,
                "direction_result": anomaly["directions"].get(direction),
                "incidents": [i for i in anomaly.get("incidents", []) if i.get("direction") == direction],
                "mode": anomaly.get("mode"),
            }
        citation = self._citation(
            source_type="live_state",
            title="Current anomaly detector output",
            locator=f"live_state.anomaly.{direction or 'all'}",
            ui_target="tab-analytics:anomaly-grid",
            payload=data,
            timestamp_or_range=state.get("wall_time"),
            api_origin="/api/anomaly",
        )
        return self._tool_result("get_current_anomalies", data, [citation], "live")

    def get_current_emissions(self) -> dict[str, Any]:
        state = self._state()
        data = state.get("emissions", {}) or {}
        citation = self._citation(
            source_type="live_state",
            title="Current emissions summary",
            locator="live_state.emissions",
            ui_target="tab-analytics:demand-pressure",
            payload=data,
            timestamp_or_range=state.get("wall_time"),
            api_origin="/api/emissions",
        )
        return self._tool_result("get_current_emissions", data, [citation], "live")

    def get_peak_hours(self, direction: str) -> dict[str, Any]:
        direction = normalize_direction(direction) or direction
        analytics = self._analytics()
        entries = analytics.get("directions", {}).get(direction, {}).get("top_hours", [])
        data = {"direction": direction, "top_hours": entries[:5], "source": analytics.get("source")}
        citation = self._citation(
            source_type="detector_peak_hours",
            title=f"{direction} historical peak hours",
            locator=f"detector_peak_hours.{direction}",
            ui_target="tab-analytics:peak-hours-grid",
            payload=data,
            timestamp_or_range="historical detector data",
            api_origin="/api/analytics/peak-hours",
            file_origin="Traffic_Data_Sandbox/detector_data/*.csv",
        )
        return self._tool_result("get_peak_hours", data, [citation], "historical")

    def get_heatmap_cell(self, direction: str, weekday: int | str | None = None, hour: int | None = None) -> dict[str, Any]:
        direction = normalize_direction(direction) or direction
        now = datetime.now()
        weekday_idx = self._weekday_index(weekday) if weekday is not None else now.weekday()
        hour_idx = max(0, min(int(hour if hour is not None else now.hour), 23))
        analytics = self._analytics()
        heatmap = analytics.get("directions", {}).get(direction, {}).get("heatmap", [])
        value = None
        if 0 <= weekday_idx < len(heatmap) and hour_idx < len(heatmap[weekday_idx]):
            value = heatmap[weekday_idx][hour_idx]
        data = {
            "direction": direction,
            "weekday": WEEKDAYS[weekday_idx],
            "weekday_index": weekday_idx,
            "hour": hour_idx,
            "mean_veh_h": value,
        }
        citation = self._citation(
            source_type="detector_peak_hours",
            title=f"{direction} heatmap cell",
            locator=f"volume_heatmap.{direction}.{weekday_idx}.{hour_idx}",
            ui_target="tab-analytics:volume-heatmap",
            payload=data,
            timestamp_or_range=f"{WEEKDAYS[weekday_idx]} {hour_idx:02d}:00 historical average",
            api_origin="/api/analytics/volume-heatmap",
            file_origin="Traffic_Data_Sandbox/detector_data/*.csv",
        )
        return self._tool_result("get_heatmap_cell", data, [citation], "historical")

    def find_historical_incidents(
        self,
        direction: str | None = None,
        incident_type: str | None = None,
        severity: str | None = None,
        date_range: str | None = None,
    ) -> dict[str, Any]:
        direction = normalize_direction(direction) if direction else None
        path = SANDBOX_ROOT / "annotations" / "incident_annotations.csv"
        rows: list[dict[str, Any]] = []
        if path.exists():
            with path.open("r", encoding="utf-8", newline="") as handle:
                for row in csv.DictReader(handle):
                    row_direction = direction_for_approach(row.get("approach_id"))
                    row["direction"] = row_direction
                    if direction and row_direction != direction:
                        continue
                    if incident_type and incident_type.lower() not in row.get("incident_type", "").lower():
                        continue
                    if severity and severity.lower() != row.get("severity", "").lower():
                        continue
                    rows.append(row)
        data = {"direction": direction, "incidents": rows[:8], "count": len(rows)}
        citation = self._citation(
            source_type="incident_annotations",
            title="Historical incident annotations",
            locator=f"incident_annotations.{direction or 'all'}",
            ui_target="tab-chat:reference-drawer",
            payload=data,
            timestamp_or_range=date_range or "historical incident annotation range",
            file_origin=str(path.relative_to(PROJECT_ROOT)),
        )
        return self._tool_result("find_historical_incidents", data, [citation], "historical")

    def find_congestion_events(
        self,
        direction: str | None = None,
        severity: str | None = None,
        date_range: str | None = None,
    ) -> dict[str, Any]:
        direction = normalize_direction(direction) if direction else None
        path = SANDBOX_ROOT / "annotations" / "congestion_events.json"
        payload = _read_json(path, {"events": []})
        events = []
        for event in payload.get("events", []):
            dominant = {str(item) for item in event.get("dominant_approaches", [])}
            if direction and not dominant.intersection(DIRECTION_APPROACHES[direction]):
                continue
            if severity and severity.lower() != str(event.get("severity", "")).lower():
                continue
            events.append(event)
        data = {"direction": direction, "events": events[:8], "count": len(events)}
        citation = self._citation(
            source_type="congestion_events",
            title="Historical congestion event windows",
            locator=f"congestion_events.{direction or 'all'}",
            ui_target="tab-chat:reference-drawer",
            payload=data,
            timestamp_or_range=date_range or "historical congestion event range",
            file_origin=str(path.relative_to(PROJECT_ROOT)),
        )
        return self._tool_result("find_congestion_events", data, [citation], "historical")

    def get_signal_phase_history(self, phase_number: int | None = None, date_range: str | None = None) -> dict[str, Any]:
        path = SANDBOX_ROOT / "signal_logs" / "signal_timing_logs.csv"
        rows: list[dict[str, Any]] = []
        if path.exists():
            with path.open("r", encoding="utf-8", newline="") as handle:
                for row in csv.DictReader(handle):
                    if phase_number is not None and int(row["phase_number"]) != int(phase_number):
                        continue
                    rows.append(row)
                    if len(rows) >= 12:
                        break
        data = {"phase_number": phase_number, "events": rows, "count_returned": len(rows)}
        citation = self._citation(
            source_type="signal_logs",
            title="Historical signal phase log",
            locator=f"signal_logs.phase_{phase_number or 'all'}",
            ui_target="tab-system:shortcuts-table",
            payload=data,
            timestamp_or_range=date_range or "historical signal log sample",
            file_origin=str(path.relative_to(PROJECT_ROOT)),
        )
        return self._tool_result("get_signal_phase_history", data, [citation], "historical")

    def get_model_evaluation(self) -> dict[str, Any]:
        path = APP_DATA_ROOT / "model_evaluation.json"
        data = _read_json(path, {"error": "No model evaluation data available."})
        citation = self._citation(
            source_type="model_evaluation",
            title="Forecast model evaluation",
            locator="app.data.model_evaluation",
            ui_target="tab-analytics:forecast-grid",
            payload=data,
            file_origin=str(path.relative_to(PROJECT_ROOT)),
        )
        return self._tool_result("get_model_evaluation", data, [citation], "historical")

    def get_site_metadata(self) -> dict[str, Any]:
        path = SANDBOX_ROOT / "metadata" / "metadata.json"
        data = _read_json(path, {})
        citation = self._citation(
            source_type="metadata",
            title="Wadi Saqra site metadata",
            locator="metadata.site",
            ui_target="tab-system:sys-data-source",
            payload=data,
            file_origin=str(path.relative_to(PROJECT_ROOT)),
        )
        return self._tool_result("get_site_metadata", data, [citation], "historical")

    def get_approach_mapping(self, direction_or_id: str | int | None = None) -> dict[str, Any]:
        metadata = _read_json(SANDBOX_ROOT / "metadata" / "metadata.json", {})
        direction = normalize_direction(direction_or_id)
        approach_id = str(direction_or_id) if str(direction_or_id or "").isdigit() else None
        approach_ids = [approach_id] if approach_id else sorted(DIRECTION_APPROACHES.get(direction or "", []), key=int)
        labels = metadata.get("approach_labels", {})
        lane_config = metadata.get("lane_configurations", {})
        rows = []
        for item in approach_ids:
            rows.append({
                "approach_id": item,
                "direction": direction_for_approach(item),
                "label": labels.get(item),
                "lane_configuration": lane_config.get(f"approach_{item}"),
            })
        data = {"query": direction_or_id, "direction": direction, "approaches": rows}
        citation = self._citation(
            source_type="metadata",
            title="Approach mapping",
            locator=f"metadata.approach.{direction_or_id or 'all'}",
            ui_target="tab-chat:reference-drawer",
            payload=data,
            file_origin="Traffic_Data_Sandbox/metadata/metadata.json",
        )
        return self._tool_result("get_approach_mapping", data, [citation], "historical")

    def get_monitoring_zones(self, direction_or_id: str | int | None = None) -> dict[str, Any]:
        metadata = _read_json(SANDBOX_ROOT / "metadata" / "metadata.json", {})
        direction = normalize_direction(direction_or_id)
        approach_ids = DIRECTION_APPROACHES.get(direction or "", set())
        zones = []
        for zone in metadata.get("monitoring_zones", []):
            zone_approaches = {str(item) for item in zone.get("approaches", [])}
            if approach_ids and not zone_approaches.intersection(approach_ids):
                continue
            zones.append(zone)
        data = {"query": direction_or_id, "direction": direction, "monitoring_zones": zones}
        citation = self._citation(
            source_type="metadata",
            title="Monitoring zones",
            locator=f"metadata.monitoring_zones.{direction_or_id or 'all'}",
            ui_target="tab-chat:reference-drawer",
            payload=data,
            file_origin="Traffic_Data_Sandbox/metadata/metadata.json",
        )
        return self._tool_result("get_monitoring_zones", data, [citation], "historical")

    def get_network_reference(self, direction: str | None = None) -> dict[str, Any]:
        direction = normalize_direction(direction) if direction else None
        geometry = self._network_geometry()
        data = geometry.get("approaches", {}).get(direction, geometry) if direction else geometry
        citation = self._citation(
            source_type="metadata",
            title=f"{direction or 'Network'} geometry reference",
            locator=f"network_geometry.{direction or 'all'}",
            ui_target="tab-twin:approach-table-body",
            payload=data,
            api_origin="/api/network-geometry",
            file_origin="Traffic_Project_Simulation/app/data/live_network_geometry.json",
        )
        return self._tool_result("get_network_reference", data, [citation], "live")

    def materialize_reference(self, ref_id: str) -> dict[str, Any] | None:
        return self.references.materialize(ref_id)

    def collect_evidence(self, query: str) -> dict[str, Any]:
        q = query.lower()
        direction = normalize_direction(query)
        tools: list[dict[str, Any]] = []

        if any(city in q for city in ("irbid", "aqaba", "zarqa", "إربد", "اربد", "العقبة", "الزرقاء", "معان", "الكرك")):
            refusal = ("هذا المساعد مخصص فقط لتقاطع وادي صقرة في عمّان."
                       if any("\u0600" <= c <= "\u06ff" for c in q) else
                       "This assistant is scoped to the Wadi Saqra intersection only.")
            return self._bundle([], "unsupported", refusal)

        historical_hint = any(token in q for token in (
            "historical", "history", "peak", "usual", "last week", "last month", "yesterday",
            "تاريخ", "تاريخي", "تاريخية", "عادة", "الماضي", "الأسبوع", "اسبوع", "امس", "أمس",
            "سجل", "سابق", "سابقا", "قبل",
        ))
        current_hint = any(token in q for token in (
            "current", "now", "right now", "live", "existing", "today",
            "اليوم", "الآن", "الان", "حاليا", "حالياً", "الموجود", "الحالي", "الحالية",
            "هلق", "هلأ", "دلوقتي", "هسا", "هسه",  # colloquial Arabic variants
        ))

        minutes = self._extract_minutes(q)
        if "average queue" in q or ("queue" in q and "last" in q) or ("طابور" in q and ("آخر" in q or "اخر" in q)) or "متوسط الطابور" in q:
            tools.append(self.get_live_history_window(direction or "northbound", minutes))

        if "peak" in q or "ذروة" in q or "اكثر ازدحام" in q or "أكثر ازدحام" in q or "busiest" in q:
            tools.append(self.get_peak_hours(direction or "northbound"))

        if "heatmap" in q or "heat map" in q or "خريطة" in q or "خريطة حرارية" in q:
            tools.append(self.get_heatmap_cell(direction or "northbound", self._extract_weekday(q), self._extract_hour(q)))

        if "incident" in q or "alert" in q or "حادث" in q or "تنبيه" in q or "حوادث" in q or "تنبيهات" in q:
            if current_hint and not historical_hint:
                tools.append(self.get_current_anomalies(direction))
                tools.append(self.get_current_recommendations(direction))
            else:
                tools.append(self.find_historical_incidents(direction))
                tools.append(self.find_congestion_events(direction))

        if any(kw in q for kw in ("congestion", "delay", "traffic", "ازدحام", "أزمة", "ازمة", "تأخير", "زحمة", "زحام", "وضع")):
            if current_hint or not historical_hint:
                if direction:
                    tools.append(self.get_live_direction_metrics(direction))
                else:
                    tools.append(self.get_live_state_summary())
                tools.append(self.get_current_recommendations(direction))
            if historical_hint:
                tools.append(self.get_peak_hours(direction or "northbound"))
                tools.append(self.find_congestion_events(direction))

        if any(kw in q for kw in ("signal", "phase", "اشارة", "إشارة", "طور", "ضوء", "اخضر", "أخضر", "احمر", "أحمر", "green", "red")):
            if historical_hint:
                tools.append(self.get_signal_phase_history(self._extract_phase(q)))
            else:
                tools.append(self.get_signal_plan(direction))

        if any(kw in q for kw in ("emission", "co2", "nox", "fuel", "انبعاث", "وقود", "تلوث", "بيئة")):
            tools.append(self.get_current_emissions())

        if any(kw in q for kw in ("model", "accuracy", "evaluation", "forecast", "predict", "دقة", "نموذج", "تنبؤ", "توقع")):
            tools.append(self.get_model_evaluation())

        if any(kw in q for kw in ("recommend", "suggest", "توصية", "نصيحة", "اقتراح", "شو اعمل", "ايش اسوي")):
            tools.append(self.get_current_recommendations(direction))
            if direction:
                tools.append(self.get_live_direction_metrics(direction))

        if any(kw in q for kw in ("queue", "طابور", "صف", "رتل")) and not tools:
            if direction:
                tools.append(self.get_live_direction_metrics(direction))
            else:
                tools.append(self.get_live_state_summary())

        if any(kw in q for kw in ("speed", "سرعة")) and not tools:
            tools.append(self.get_live_direction_metrics(direction or "northbound"))

        if any(kw in q for kw in ("camera", "site", "metadata", "approach", "zone", "كاميرا", "موقع", "مناطق")):
            tools.append(self.get_site_metadata())
            if direction:
                tools.append(self.get_approach_mapping(direction))
                tools.append(self.get_monitoring_zones(direction))

        # Fallback: if no tools matched but we have a direction, get live data for it
        if not tools and direction:
            tools.append(self.get_live_direction_metrics(direction))

        # Fallback: general question → give full live summary
        if not tools:
            tools.append(self.get_live_state_summary())

        return self._bundle(tools, None, None)

    def _bundle(self, tools: list[dict[str, Any]], forced_scope: str | None, refusal: str | None) -> dict[str, Any]:
        valid_tools = [tool for tool in tools if not tool.get("data", {}).get("error")]
        if refusal:
            return {"items": [], "citations": [], "tools_used": [], "time_scope": forced_scope, "refusal_reason": refusal}
        if not valid_tools:
            return {
                "items": [],
                "citations": [],
                "tools_used": [tool.get("tool") for tool in tools],
                "time_scope": None,
                "refusal_reason": "No supported project data was found for this question.",
            }
        citations: list[dict[str, Any]] = []
        scopes = set()
        for tool in valid_tools:
            citations.extend(tool.get("citations", []))
            scopes.add(tool.get("time_scope"))
        if "live" in scopes and "historical" in scopes:
            scope = "mixed"
        elif "live" in scopes:
            scope = "live"
        else:
            scope = "historical"
        return {
            "items": valid_tools,
            "citations": citations,
            "tools_used": [tool.get("tool") for tool in valid_tools],
            "time_scope": scope,
            "refusal_reason": None,
        }

    def _build_detector_analytics(self) -> dict[str, Any]:
        detector_dir = SANDBOX_ROOT / "detector_data"
        grouped: dict[str, Counter[str]] = defaultdict(Counter)
        for path in sorted(detector_dir.glob("detector_*.csv")):
            with path.open("r", encoding="utf-8", newline="") as handle:
                for row in csv.DictReader(handle):
                    grouped[row["timestamp"]][str(int(row["approach_id"]))] += int(row["vehicle_count"])

        slots: dict[str, dict[tuple[int, int], list[float]]] = {direction: defaultdict(list) for direction in DIRECTIONS}
        for ts_text, counts in grouped.items():
            dt = datetime.strptime(ts_text, "%Y-%m-%d %H:%M:%S")
            for direction, approach_ids in DIRECTION_APPROACHES.items():
                count_15m = sum(counts.get(approach_id, 0) for approach_id in approach_ids)
                slots[direction][(dt.weekday(), dt.hour)].append(count_15m * 4.0)

        payload: dict[str, Any] = {"source": "detector_data", "weekdays": WEEKDAYS, "hours": list(range(24)), "directions": {}}
        for direction in DIRECTIONS:
            heatmap: list[list[float | None]] = []
            ranked = []
            for weekday in range(7):
                row = []
                for hour in range(24):
                    values = slots[direction].get((weekday, hour), [])
                    value = round(sum(values) / len(values), 1) if values else None
                    row.append(value)
                    if value is not None:
                        ranked.append({"weekday": WEEKDAYS[weekday], "weekday_index": weekday, "hour": hour, "mean_veh_h": value})
                heatmap.append(row)
            ranked.sort(key=lambda item: item["mean_veh_h"], reverse=True)
            payload["directions"][direction] = {
                "top_hours": ranked[:5],
                "heatmap": heatmap,
                "heatmap_max": max([item["mean_veh_h"] for item in ranked] or [0.0]),
                "hourly_profile": [
                    {
                        "hour": hour,
                        "mean_veh_h": round(
                            sum(v for v in (heatmap[weekday][hour] for weekday in range(7)) if v is not None)
                            / max(1, sum(1 for weekday in range(7) if heatmap[weekday][hour] is not None)),
                            1,
                        ),
                    }
                    for hour in range(24)
                ],
            }
        return payload

    @staticmethod
    def _extract_minutes(query: str) -> int:
        match = re.search(r"last\s+(\d+)\s+minute", query)
        if match:
            return int(match.group(1))
        match = re.search(r"آخر\s+(\d+)|اخر\s+(\d+)", query)
        if match:
            return int(match.group(1) or match.group(2))
        return 5

    @staticmethod
    def _extract_phase(query: str) -> int | None:
        match = re.search(r"phase\s*(\d+)|طور\s*(\d+)", query)
        if match:
            return int(match.group(1) or match.group(2))
        return None

    @staticmethod
    def _extract_hour(query: str) -> int | None:
        match = re.search(r"\b([01]?\d|2[0-3])(?::00)?\b", query)
        return int(match.group(1)) if match else None

    @staticmethod
    def _extract_weekday(query: str) -> int | None:
        lowered = query.lower()
        for idx, label in enumerate(WEEKDAYS):
            if label.lower() in lowered:
                return idx
        arabic = {
            "الاثنين": 0,
            "الثلاثاء": 1,
            "الأربعاء": 2,
            "الاربعاء": 2,
            "الخميس": 3,
            "الجمعة": 4,
            "السبت": 5,
            "الأحد": 6,
            "الاحد": 6,
        }
        for label, idx in arabic.items():
            if label in query:
                return idx
        return None

    @staticmethod
    def _weekday_index(value: int | str) -> int:
        if isinstance(value, int):
            return max(0, min(value, 6))
        text = str(value).lower()
        for idx, label in enumerate(WEEKDAYS):
            if label.lower() == text:
                return idx
        return 0
