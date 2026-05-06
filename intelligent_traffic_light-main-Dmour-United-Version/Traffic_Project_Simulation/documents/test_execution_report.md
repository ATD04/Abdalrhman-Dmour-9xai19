# Test Execution Report

Last updated: 2026-05-06

## Environment

- Workspace: `/Users/ahmadhasasneh/Desktop/Intelligent-Traffic-Light`
- Python: `.venv/bin/python`
- Browser E2E runtime: Playwright Chromium
- Local LLM runtime: Ollama
- Required local model: `gemma4:latest`
- SUMO binary: `/Library/Frameworks/EclipseSUMO.framework/Versions/1.26.0/EclipseSUMO/bin/sumo`

## Commands Run

### 2026-05-06 delivery regression

#### JavaScript syntax

```bash
node --check Traffic_Project_Simulation/app/index.js
node --check Traffic_Project_Simulation/app/replay.js
node --check Traffic_Project_Simulation/app/reports.js
```

Result: passed.

#### Replay + Reports focused tests

```bash
.venv/bin/python -m pytest -q \
  Traffic_Project_Simulation/tests/test_replay_features.py \
  Traffic_Project_Simulation/tests/test_report_features.py \
  Traffic_Project_Simulation/tests/e2e/test_replay_reports_ui.py
```

Result: `6 passed in 4.19s`.

#### Existing smoke compatibility after Replay/Reports merge

```bash
.venv/bin/python -m pytest -q \
  Traffic_Project_Simulation/tests/e2e/test_chat_ui.py \
  Traffic_Project_Simulation/tests/e2e/test_replay_reports_ui.py
```

Result: `2 passed in 5.04s`.

#### Launcher compatibility

```bash
.venv/bin/python Traffic_Project_Simulation/scripts/core/start_live_simulation.py --help
.venv/bin/python Traffic_Project_Simulation/scripts/start_live_simulation.py --help
```

Result: both commands passed and exposed the expected CLI arguments.

#### Full project regression

```bash
.venv/bin/python -m pytest -q Traffic_Project_Simulation/tests
```

Result: `104 passed in 29.23s`.

#### Real live-server startup and API smoke

A temporary live server was started on port `3199`, then stopped after verification.

Command:

```bash
.venv/bin/python Traffic_Project_Simulation/scripts/start_live_simulation.py --port 3199
```

Observed startup:

- Live dashboard started successfully at `http://localhost:3199`.
- The runtime fell back from `google_routes` to `detector_data` after Google API retries failed locally, which is expected safe degraded behavior for this environment.

Checked endpoints:

- `GET /api/health`
- `GET /api/replay`
- `GET /api/report/latest`

Result summary:

```json
{
  "health_status": "ok",
  "engine_status": "running",
  "replay_schema_version": 2,
  "replay_snapshot_count": 7,
  "report_schema_version": 1,
  "report_generation_mode": "deterministic_rule_based"
}
```

### JavaScript syntax

```bash
node --check Traffic_Project_Simulation/app/index.js
```

Result: passed.

### Python compile check

```bash
.venv/bin/python -m compileall -q Traffic_Project_Simulation/scripts
```

Result: passed.

### Focused chat tests

```bash
.venv/bin/python -m pytest -q \
  Traffic_Project_Simulation/tests/test_chat_citations.py \
  Traffic_Project_Simulation/tests/test_chat_retrieval.py \
  Traffic_Project_Simulation/tests/test_ollama_client.py \
  Traffic_Project_Simulation/tests/test_chat_service.py \
  Traffic_Project_Simulation/tests/test_chat_http.py
```

Result: `13 passed`.

### Real local-model tests

```bash
.venv/bin/python -m pytest -q Traffic_Project_Simulation/tests/test_chat_real_model.py
```

Result: `8 passed`.

Covered scenarios:

- Arabic current northbound congestion question.
- English current signal phase question.
- Average queue over the last 5 minutes.
- Historical peak hours.
- Historical incidents from `incident_annotations.csv`.
- Historical signal phase log lookup.
- Mixed live + historical question.
- Out-of-scope city refusal.

### Browser E2E

```bash
.venv/bin/python -m pytest -q Traffic_Project_Simulation/tests/e2e/test_chat_ui.py
```

Result: `1 passed`.

### Full suite

```bash
.venv/bin/python -m pytest -q Traffic_Project_Simulation/tests
```

Result: `90 passed, 5 warnings in 19.47s`.

Warnings:

- Existing `datetime.utcnow()` deprecation warnings from `scripts/utils/backtester.py`.

### Real startup check

A temporary server was started on port `3210`, then stopped after verification.

Checked endpoints:

- `GET /api/health`
- `GET /api/chat/health`

Result:

```json
{
  "health": {
    "status": "ok",
    "engine_status": "ready"
  },
  "chat": {
    "ready": true,
    "model": "gemma4:latest",
    "provider": "ollama",
    "tool_count": 18
  }
}
```

### Real server chat query check

A temporary server was started on port `3212`, queried, and stopped.

Request:

```json
{
  "message": "Is there congestion on northbound right now?"
}
```

Result summary:

```json
{
  "time_scope": "live",
  "citation_count": 2,
  "first_ref_source": "live_state",
  "first_ref_locator": "live_state.direction.northbound"
}
```

The referenced payload was materialized successfully through:

```text
GET /api/chat/reference/<ref_id>
```

## Delivery Gate Status

| Gate | Status |
|---|---|
| Unit tests | passed |
| Integration tests | passed |
| Real `gemma4:latest` tests | passed |
| Browser E2E | passed |
| Replay endpoint + payload | passed |
| Reports API + persistence | passed |
| Replay/Reports Playwright smoke | passed |
| JavaScript syntax | passed |
| Python compile | passed |
| Local server startup | passed |
| Real `/api/replay` smoke | passed |
| Real `/api/report/latest` smoke | passed |
| Chat health ready | passed |
| Citation materialization | passed |
| Polygon zone CRUD and geometry | passed |
| Vehicle entry counts and utilization | passed |
| Approach-level peak charts | passed |
| Simulation Lab what-if lifecycle | passed |
| Rendered source-data references | passed |
| Feature matrix completed | passed |

## 2026-05-06 Operator Fix Pass

### Commands run

```text
node --check Traffic_Project_Simulation/app/index.js
node --check Traffic_Project_Simulation/app/replay.js
node --check Traffic_Project_Simulation/app/reports.js
pytest Traffic_Project_Simulation/tests/test_simulation_lab.py Traffic_Project_Simulation/tests/test_replay_features.py Traffic_Project_Simulation/tests/test_report_features.py Traffic_Project_Simulation/tests/e2e/test_replay_reports_ui.py -q
pytest Traffic_Project_Simulation/tests/test_simulation_lab.py Traffic_Project_Simulation/tests/e2e/test_replay_reports_ui.py -q
pytest Traffic_Project_Simulation/tests -q
.venv/bin/python Traffic_Project_Simulation/scripts/start_live_simulation.py --help
```

### Results summary

```json
{
  "js_syntax": "passed",
  "targeted_suite": "14 passed",
  "sumo_regression_suite": "10 passed",
  "full_suite": "109 passed",
  "venv_launcher_help": "passed"
}
```

### Real server verification

A real server was started from the project virtualenv on port `3211`.

Verified endpoints:

- `GET /api/health`
- `GET /api/replay`
- `GET /api/report/latest`
- `POST /api/simulation/what-if` with `engine=sumo`

Observed summary:

```json
{
  "health": {
    "status": "ok",
    "source": "detector_data"
  },
  "replay": {
    "schema_version": 2,
    "count": 16
  },
  "report_latest": {
    "schema_version": 1,
    "generation_mode": "deterministic_rule_based"
  },
  "simulation_what_if": {
    "status": "completed",
    "engine_requested": "sumo",
    "engine_used": "sumo",
    "engine_fallback_reason": null,
    "post_job_health": {
      "status": "ok",
      "engine_status": "running",
      "source": "detector_data"
    }
  }
}
```

### Environment note

The system interpreter path:

```text
python3 Traffic_Project_Simulation/scripts/start_live_simulation.py --help
```

failed because `pyproj` is not installed in the system Python. The project virtualenv contains the required dependency set, so all real verification was executed through `.venv/bin/python`.

## 2026-05-06 Explicit Simulation Options And Report Export

### Commands run

```text
node --check Traffic_Project_Simulation/app/index.js
node --check Traffic_Project_Simulation/app/reports.js
pytest Traffic_Project_Simulation/tests/e2e/test_replay_reports_ui.py -q
pytest Traffic_Project_Simulation/tests/test_simulation_lab.py Traffic_Project_Simulation/tests/test_report_features.py Traffic_Project_Simulation/tests/e2e/test_replay_reports_ui.py -q
```

### Results summary

```json
{
  "js_syntax": "passed",
  "replay_reports_e2e": "3 passed",
  "simulation_reports_targeted": "13 passed"
}
```

### Coverage added

- Verified the Simulation Lab now exposes exactly two engine inputs through `input[name="sim-engine-option"]`.
- Verified Reports can export `JSON`.
- Verified Reports can export `PDF`.
