"""Read-only local MCP-style tool server for the traffic chat assistant.

The project does not depend on an external MCP runtime. This module provides the
same operational boundary for the app: named tools, typed arguments, no writes,
and a single dispatch point used by the LLM orchestration layer.
"""

from __future__ import annotations

from typing import Any, Callable

from .retrieval import TrafficRetrieval


class LocalMCPServer:
    def __init__(self, retrieval: TrafficRetrieval) -> None:
        self.retrieval = retrieval
        self._tools: dict[str, Callable[..., dict[str, Any]]] = {
            "get_live_state_summary": retrieval.get_live_state_summary,
            "get_live_direction_metrics": retrieval.get_live_direction_metrics,
            "get_live_history_window": retrieval.get_live_history_window,
            "get_signal_plan": retrieval.get_signal_plan,
            "get_current_recommendations": retrieval.get_current_recommendations,
            "get_current_anomalies": retrieval.get_current_anomalies,
            "get_current_emissions": retrieval.get_current_emissions,
            "get_peak_hours": retrieval.get_peak_hours,
            "get_heatmap_cell": retrieval.get_heatmap_cell,
            "find_historical_incidents": retrieval.find_historical_incidents,
            "find_congestion_events": retrieval.find_congestion_events,
            "get_signal_phase_history": retrieval.get_signal_phase_history,
            "get_model_evaluation": retrieval.get_model_evaluation,
            "get_site_metadata": retrieval.get_site_metadata,
            "get_approach_mapping": retrieval.get_approach_mapping,
            "get_monitoring_zones": retrieval.get_monitoring_zones,
            "get_network_reference": retrieval.get_network_reference,
            "materialize_reference": self.materialize_reference,
        }

    def list_tools(self) -> list[dict[str, Any]]:
        return [
            {"name": name, "description": "Read-only Wadi Saqra traffic data tool."}
            for name in sorted(self._tools)
        ]

    def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> dict[str, Any]:
        if name not in self._tools:
            raise ValueError(f"Unknown MCP tool: {name}")
        return self._tools[name](**(arguments or {}))

    def materialize_reference(self, ref_id: str) -> dict[str, Any]:
        reference = self.retrieval.materialize_reference(ref_id)
        if reference is None:
            return {"error": f"Unknown reference id: {ref_id}"}
        return reference
