"""Citation and reference registry for grounded chat answers."""

from __future__ import annotations

import hashlib
import json
import re
from copy import deepcopy
from typing import Any


class ReferenceRegistry:
    """In-memory reference store scoped to the running dashboard server."""

    def __init__(self) -> None:
        self._references: dict[str, dict[str, Any]] = {}

    @staticmethod
    def _stable_ref_id(source_type: str, locator: str, timestamp_or_range: str | None) -> str:
        seed = f"{source_type}|{locator}|{timestamp_or_range or ''}"
        return "ref_" + hashlib.sha1(seed.encode("utf-8")).hexdigest()[:16]

    @staticmethod
    def _excerpt(payload: Any) -> str:
        try:
            text = json.dumps(payload, ensure_ascii=False, sort_keys=True)
        except (TypeError, ValueError):
            text = str(payload)
        return text[:1800]

    @staticmethod
    def _render_descriptor(source_type: str, locator: str, payload: Any, ui_target: str) -> dict[str, Any]:
        locator_text = locator or ""
        render_type = "table"
        if source_type == "live_state":
            render_type = "live_metric_card"
        elif source_type == "detector_peak_hours" and "volume_heatmap" in locator_text:
            render_type = "heatmap_cell"
        elif source_type == "detector_peak_hours":
            render_type = "peak_hours"
        elif source_type in {"signal_logs", "model_evaluation"}:
            render_type = "metrics_table"
        elif source_type in {"incident_annotations", "congestion_events"}:
            render_type = "event_list"
        elif source_type == "metadata" and "monitoring_zones" in locator_text:
            render_type = "zone_preview"
        elif source_type == "metadata" and "network_geometry" in locator_text:
            render_type = "network_geometry"

        linked_entities: dict[str, Any] = {}
        direction_match = re.search(r"(northbound|southbound|eastbound|westbound)", locator_text)
        if direction_match:
            linked_entities["direction"] = direction_match.group(1)
        approach_match = re.search(r"approach[._-]?(\d+)", locator_text)
        if approach_match:
            linked_entities["approach_id"] = approach_match.group(1)
        if isinstance(payload, dict):
            for key in ("direction", "approach_id", "zone_id"):
                if payload.get(key) is not None:
                    linked_entities[key] = payload[key]
        return {
            "render_type": render_type,
            "render_hints": {
                "preferred_view": "rendered",
                "ui_target": ui_target,
                "has_structured_payload": payload is not None,
            },
            "linked_entities": linked_entities,
            "raw_json_available": True,
        }

    def register(
        self,
        *,
        source_type: str,
        title: str,
        locator: str,
        ui_target: str,
        structured_payload: Any,
        timestamp_or_range: str | None = None,
        file_origin: str | None = None,
        api_origin: str | None = None,
    ) -> dict[str, Any]:
        ref_id = self._stable_ref_id(source_type, locator, timestamp_or_range)
        descriptor = self._render_descriptor(source_type, locator, structured_payload, ui_target)
        reference = {
            "ref_id": ref_id,
            "title": title,
            "source_type": source_type,
            "ui_target": ui_target,
            "timestamp_or_range": timestamp_or_range,
            "raw_excerpt": self._excerpt(structured_payload),
            "structured_payload": deepcopy(structured_payload),
            "file_origin": file_origin,
            "api_origin": api_origin,
            "locator": locator,
            **descriptor,
        }
        self._references[ref_id] = reference
        return {
            "ref_id": ref_id,
            "title": title,
            "source_type": source_type,
            "ui_target": ui_target,
            "locator": locator,
            "timestamp_or_range": timestamp_or_range,
            "render_type": descriptor["render_type"],
        }

    def materialize(self, ref_id: str) -> dict[str, Any] | None:
        reference = self._references.get(ref_id)
        return deepcopy(reference) if reference else None
