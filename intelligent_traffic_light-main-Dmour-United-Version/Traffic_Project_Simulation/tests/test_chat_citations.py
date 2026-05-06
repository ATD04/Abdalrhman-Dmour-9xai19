"""Tests for chat citation and reference materialization."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))


def test_reference_registry_returns_stable_ref_id():
    from chat.citations import ReferenceRegistry

    registry = ReferenceRegistry()
    first = registry.register(
        source_type="live_state",
        title="North readings",
        locator="live_state.direction.northbound",
        ui_target="tab-dashboard:dash-kpi-row",
        timestamp_or_range="2026-05-03T12:00:00+03:00",
        structured_payload={"queue_m": 42},
    )
    second = registry.register(
        source_type="live_state",
        title="North readings",
        locator="live_state.direction.northbound",
        ui_target="tab-dashboard:dash-kpi-row",
        timestamp_or_range="2026-05-03T12:00:00+03:00",
        structured_payload={"queue_m": 42},
    )
    assert first["ref_id"] == second["ref_id"]
    materialized = registry.materialize(first["ref_id"])
    assert materialized["structured_payload"]["queue_m"] == 42
    assert materialized["render_type"] == "live_metric_card"
    assert materialized["raw_json_available"] is True
    assert materialized["linked_entities"]["direction"] == "northbound"


def test_reference_registry_assigns_peak_render_type():
    from chat.citations import ReferenceRegistry

    registry = ReferenceRegistry()
    citation = registry.register(
        source_type="detector_peak_hours",
        title="North peak",
        locator="detector_peak_hours.northbound",
        ui_target="tab-analytics:peak-hours-grid",
        structured_payload={"direction": "northbound", "top_hours": [{"hour": 8, "mean_veh_h": 1000}]},
    )
    ref = registry.materialize(citation["ref_id"])
    assert ref["render_type"] == "peak_hours"
    assert ref["render_hints"]["preferred_view"] == "rendered"


def test_reference_registry_unknown_ref_returns_none():
    from chat.citations import ReferenceRegistry

    assert ReferenceRegistry().materialize("ref_missing") is None
