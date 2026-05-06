# Feature Verification Matrix

Last updated: 2026-05-03

| Feature | Documented in | Implemented in | API surface | UI surface | Automated tests | Manual/runtime check | Status |
|---|---|---|---|---|---|---|---|
| Geometry-scaled capacity and saturation | `implementation_progress.md`, dashboard docs | `scripts/live_support.py`, `scripts/sumo_traci_runner.py` | `/api/live-state`, `/api/live-history` | Digital Twin approach table | `tests/test_helpers.py`, full pytest suite | Included in live state regression tests | implemented |
| Peak hours dashboard | `implementation_progress.md` | `scripts/live_support.py`, `scripts/start_live_simulation.py` | `/api/analytics/peak-hours` | Analytics peak-hour cards | `tests/test_helpers.py`, `tests/test_chat_retrieval.py` | Historical detector analytics used by chat references | implemented |
| Real volume heatmap | `implementation_progress.md` | `scripts/live_support.py`, `app/index.js` | `/api/analytics/volume-heatmap` | Analytics volume heat map | `tests/test_helpers.py`, smoke checks | Covered by retrieval heatmap tool | implemented |
| Alert dispatch | `implementation_progress.md` | `scripts/alert_dispatch.py`, `scripts/sumo_traci_runner.py` | `/api/alert-dispatch` | System alert dispatch panel | `tests/test_alert_dispatch.py`, full pytest suite | Dispatcher diagnostics remain available | implemented |
| Legacy deterministic assistant | `implementation_progress.md` | `scripts/assistant_query.py`, `scripts/start_live_simulation.py` | `/api/assistant/query` | Legacy UI removed; API retained | `tests/test_assistant_query.py`, `tests/test_chat_http.py` | Backward-compatible endpoint verified | implemented |
| Standalone grounded Chat tab | `full_project_plan_1.md` | `app/index.html`, `app/index.js`, `app/styles/components.css` | `/api/chat/query` | Dedicated Chat tab | `tests/e2e/test_chat_ui.py` | Browser E2E passed | implemented |
| Ollama local LLM integration | `full_project_plan_1.md` | `scripts/chat/ollama_client.py`, `scripts/chat/service.py` | `/api/chat/health`, `/api/chat/query` | Chat health badge and System runtime panel | `tests/test_ollama_client.py`, `tests/test_chat_real_model.py` | `gemma4:latest` real-model tests passed | implemented |
| Read-only MCP-style tools | `full_project_plan_1.md` | `scripts/chat/mcp_server.py`, `scripts/chat/retrieval.py` | Internal tool dispatcher exposed through chat service | Not directly exposed; results shown as citations | `tests/test_chat_retrieval.py`, `tests/test_chat_service.py` | `/api/chat/health` reports 18 tools | implemented |
| Clickable source citations | `full_project_plan_1.md` | `scripts/chat/citations.py`, `app/index.js` | `/api/chat/reference/<ref_id>` | Citation chips and reference panel | `tests/test_chat_citations.py`, `tests/test_chat_http.py`, E2E test | Real server citation materialization passed | implemented |
| Rendered source-data views | `full_project_plan_2.md`, `implementation_progress.md` | `scripts/chat/citations.py`, `app/index.js`, `app/styles/components.css` | `/api/chat/reference/<ref_id>` | Chat Source Data rendered cards/tables + raw JSON toggle | `tests/test_chat_citations.py`, `tests/e2e/test_chat_ui.py` | Render metadata and Raw JSON toggle verified | implemented |
| Polygon monitoring zones | `full_project_plan_2.md`, `implementation_progress.md` | `scripts/zone_support.py`, `config/zone_definitions.json`, `scripts/live_video/stream_processor.py` | `/api/zones` | Video Analytics zone overlay and editor | `tests/test_zone_support.py`, full pytest suite | CRUD and geometry fallback verified | implemented |
| Vehicle entry counts by direction/approach | `full_project_plan_2.md`, `implementation_progress.md` | `scripts/traffic_counts.py`, `scripts/live_video/stream_processor.py`, `app/index.js` | `/api/analytics/traffic-counts` | Analytics entries/utilization/risk panel | `tests/test_traffic_counts.py`, full pytest suite | Video crossing logic and fallback estimates verified | implemented |
| Congestion/utilization percentages | `full_project_plan_2.md`, `implementation_progress.md` | `scripts/traffic_counts.py`, `scripts/sumo_traci_runner.py` | `/api/live-state`, `/api/analytics/traffic-counts` | Analytics utilization bars and risk cards | `tests/test_traffic_counts.py`, smoke checks | Direction and approach payloads verified | implemented |
| Approach-level peak-hour charts | `full_project_plan_2.md`, `implementation_progress.md` | `scripts/live_support.py`, `scripts/sumo_traci_runner.py`, `app/index.js` | `/api/analytics/peak-hours`, `/api/analytics/volume-heatmap` | Analytics peak chart with direction/approach toggle | `tests/test_helpers.py`, full pytest suite | Approach top-hour sorting verified | implemented |
| Simulation Lab what-if sandbox | `full_project_plan_2.md`, `implementation_progress.md` | `scripts/simulation_lab.py`, `scripts/start_live_simulation.py`, `app/index.js` | `/api/simulation/what-if` | Simulation Lab tab with sliders, canvas, comparison cards | `tests/test_simulation_lab.py`, smoke checks | Deterministic same-seed and green-time effect verified | implemented |
| Historical incidents and congestion events in chat | `full_project_plan_1.md`, sandbox data dictionary | `scripts/chat/retrieval.py` | `/api/chat/query` via MCP tools | Chat reference panel | `tests/test_chat_retrieval.py`, `tests/test_chat_real_model.py` | Historical source files cited | implemented |
| Signal phase history in chat | `full_project_plan_1.md`, sandbox data dictionary | `scripts/chat/retrieval.py` | `/api/chat/query` via MCP tools | Chat reference panel | `tests/test_chat_real_model.py` | Signal log source cited | implemented |
| System diagnostics and health | `README.md`, `implementation_progress.md` | `scripts/start_live_simulation.py`, `app/index.js` | `/api/health`, `/api/chat/health`, `/api/data-source` | System tab | `tests/test_chat_http.py`, full pytest suite | Real startup `/api/health` and `/api/chat/health` passed | implemented |
| Video analytics preservation | `README.md` | `app/video-analytics.js`, existing video data APIs | `/api/video-analytics-manifest`, `/api/video-tracking/<id>` | Video Analytics tab | Existing smoke/regression tests, full pytest suite | No regression introduced by chat changes | implemented |

## Delivery Gaps Closed

- `full_project_plan_1.md` is no longer empty.
- Chat is now a standalone tab.
- The chat flow uses local Ollama with `gemma4:latest`.
- Read-only MCP-style tools cover live, historical, metadata, signal, anomaly, and evaluation data.
- Citations are materialized through a dedicated API endpoint.
- Source Data references now render as cards/tables/charts before raw JSON.
- Polygon zones can be authored and reused for video counting.
- Entry counts, utilization, and near-term risk are exposed by direction and approach.
- Simulation Lab supports same-seed baseline/candidate what-if comparisons.
- The System tab exposes chat runtime readiness.
- Playwright E2E is installed and passing locally.
