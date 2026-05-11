# Persona Classification Team — Final 48H Sprint Kanban
**Sprint Goal:** Ship a working LLM-as-a-Judge persona classification backend (FastAPI) with validated API contracts for frontend and database teams.  
**Deadline:** May 12, 2026 (tomorrow EOD).  
**Owner:** Persona Classification Team (4 engineers).  
**Stack:** FastAPI (backend), embedded SQLite (self-contained), static HTML mock frontend (served by FastAPI), Docker.  

> **Scope Boundary:** This document contains **backend tasks** for the Persona Team. Because other teams are not meeting deadlines, the Persona Team will deliver a **single, self-contained, Dockerized service** that works standalone with `docker compose up`. It includes an embedded database and a mock frontend so the demo requires zero external dependencies. API contracts for the Frontend and DB teams are still provided, but they are optional — the service does not need them to run.

---

## Day 1 — May 11 — "Backend Core + Contracts"

| ID | Task | Owner Team | Priority | Acceptance Criteria | Notes |
|---|---|---|---|---|---|
| **B-01** | **Scaffold FastAPI classification service** | Persona Team | P0 | New standalone repo/service. `main.py` with health check (`GET /health`), CORS, env-based config (`.env` for `OLLAMA_HOST`, `OLLAMA_API_KEY`). |  |
| **B-02** | **Build `POST /v1/classify` endpoint** | Persona Team | P0 | Accepts complaint JSON payload (identical schema to `edge_cases.md` inputs). Loads `sysprompt.md` from disk, injects complaint into LLM prompt. Calls LLM (Ollama/OpenAI-compatible). Returns raw classification JSON. | The prompt is `sysprompt.md` verbatim. The LLM is the judge. |
| **B-03** | **Build JSON validator & §0 hard-rule enforcer** | Persona Team | P0 | Post-LLM validation layer enforcing non-negotiable rules from `sysprompt.md` §0: <br>1. Evidence Gate: every persona ≥0.50 must have ≥2 verbatim quotes matching its ranked issue clusters. <br>2. P1 Override: if `escalation.required = true`, force `severity.composite_priority = "P1"`. <br>3. Recurring Threshold: if `prior_complaints_count < 3`, force `recurring_complainer.is_recurring = false`. <br>4. Christian-Minority Cap: if Christian + church court, cap Persona 4 confidence ≤0.69 and force `persona_match_status = partial`. <br>5. Retry once on malformed LLM JSON, then return `classification_failed`. | This is the safety layer. Failure here corrupts the PMO dashboard. |
| **B-04** | **Build `GET /v1/classifications` endpoint** | Persona Team | P0 | Paginated list of stored classifications from SQLite. Query params: `complaint_id`, `persona_id`, `composite_priority` (P1/P2/P3/P4), `page`, `page_size`. Returns classification JSON + joined persona definition metadata. | SQLite is embedded; no external DB needed. |
| **B-05** | **Build `GET /v1/personas/stats` endpoint** | Persona Team | P0 | Aggregation endpoint returning: <br>- `total_classifications` <br>- `persona_distribution`: count + avg confidence per persona <br>- `priority_distribution`: count per P1/P2/P3/P4 <br>- `escalation_count`: total requiring escalation <br>- `out_of_taxonomy_count` | Powers the dashboard KPI header. Reads from SQLite. |
| **B-06** | **Build `POST /v1/classify/batch` endpoint** | Persona Team | P1 | Accepts array of complaints (max 50). Processes sequentially with 1-second rate-limiting between LLM calls. Returns job ID and results array. | Use this to pre-seed demo data overnight. |
| **B-07** | **Build LLM failure fallback & retry logic** | Persona Team | P1 | If LLM returns malformed JSON twice, store a `classification_failed` record in SQLite with `persona_match_status: error`, `evidence_strength: insufficient`, and a `retry_url`. Surface this cleanly in API responses. | Do not silently drop failed classifications. |
| **DB-01** | **Build SQLite schema & SQLAlchemy models** | Persona Team | P0 | Create SQLAlchemy models and SQLite schema: <br>- `complaints` table: `id (PK)`, `complaint_id (unique)`, `payload (JSON)`, `source`, `submitted_at`, `created_at` <br>- `classifications` table: `id (PK)`, `complaint_id (FK)`, `classification_json (JSON)`, `model_used`, `classification_timestamp`, `persona_match_status`, `composite_priority`, `escalation_required`, `evidence_strength`, `created_at` <br>- `persona_definitions` table: `id (PK)`, `persona_id (unique)`, `name_ar`, `name_en`, `issue_clusters (JSON)`, `bias_tags (JSON)`, `priority_tier`, `description` <br>SQLite file lives in `./data/persona.db` (gitignored). | Embedded SQLite — no external DB team needed. |
| **DB-02** | **Seed `persona_definitions` reference data** | Persona Team | P0 | SQLAlchemy seed script populating `persona_definitions` with all 10 archetypes from `sysprompt.md` §13. Include: id, name_ar, name_en, issue_clusters, bias_tags, priority_tier, description. Runs automatically on first startup if table is empty. | Self-contained; no external team needed. |
| **FE-01** | **Build static HTML mock dashboard** | Persona Team | P0 | FastAPI serves a static HTML page at `GET /dashboard` that renders: <br>- KPI header row (fetches from `GET /v1/personas/stats`) <br>- Filterable persona cards grid (RTL, responsive, mobile-first) <br>- Each card: persona name (Arabic), match %, sample count, priority badge, bias tag, representative quote <br>Uses vanilla JS + Tailwind CDN. No React build step. | Self-contained mock UI. Works without the frontend team. |
| **FE-02** | **Build static HTML classification detail view** | Persona Team | P0 | FastAPI serves a static HTML page at `GET /dashboard/detail?complaint_id=XXX` that renders: <br>- Personas array with confidence bars <br>- Arabic evidence quotes (verbatim, untranslated) <br>- Severity badge (P1/P2/P3/P4) <br>- Escalation banner (if `escalation.required = true`) <br>- Responsible handling notes <br>- Issue clusters with intensity <br>Uses vanilla JS + Tailwind CDN. | Self-contained mock UI. Works without the frontend team. |
| **FE-03** | **Build static HTML complaint ingestion UI** | Persona Team | P0 | FastAPI serves a static HTML page at `GET /dashboard/ingest` that provides: <br>- Textarea to paste complaint JSON <br>- "Classify" button calling `POST /v1/classify` <br>- Loading spinner while LLM processes <br>- Inline rendering of the classification result <br>Uses vanilla JS + Tailwind CDN. | Critical for live demo. Self-contained; no frontend team needed. |
| **FE-04** | **Build static HTML intervention linkage cards** | Persona Team | P1 | FastAPI serves static HTML at `GET /dashboard/interventions` showing: <br>- Intervention cards per persona: title, affected ministry, expected impact, status badge <br>- Hardcoded static JSON data acceptable for demo <br>Uses vanilla JS + Tailwind CDN. | Self-contained mock UI. Works without the frontend team. |
| **INT-01** | **End-to-end smoke test (full service)** | Persona Team | P0 | Run Edge Case 1 from `edge_cases.md` through `POST /v1/classify`. Verify: <br>1. Valid JSON returned <br>2. `persona_match_status` is `out_of_taxonomy` (not Persona 9 or 1 trap) <br>3. `escalation.required` is `false` <br>4. `recurring_complainer.is_recurring` is `true` (8 prior complaints) <br>5. Response time < 30 seconds <br>6. Result visible in SQLite via `GET /v1/classifications` <br>7. Result renders correctly in static HTML dashboard at `GET /dashboard` | Validate the full stack: API + DB + mock UI. |
| **INT-02** | **Validate API contracts with curl/Postman collection** | Persona Team | P0 | Export a Postman collection (or curl scripts) covering: <br>- `POST /v1/classify` with all 10 edge/unclear cases <br>- `GET /v1/classifications` with filters <br>- `GET /v1/personas/stats` <br>- `POST /v1/classify/batch` <br>- `GET /dashboard` (static HTML) | Hand this to frontend/DB teams as their future integration spec. Our service works standalone regardless. |

---

## Day 2 — May 12 — "Demo Polish + Handoff"

| ID | Task | Owner Team | Priority | Acceptance Criteria | Notes |
|---|---|---|---|---|---|
| **B-08** | **Pre-compute all 10 test classifications** | Persona Team | P0 | Run all 10 cases from `edge_cases.md` + `unclear_cases.md` through `POST /v1/classify` (or `/batch`). Store outputs as JSON files in `./demo_data/precomputed_classifications/`. Also insert them into SQLite so the dashboard has data on first boot. | Do NOT rely on live LLM during the 5-minute demo. Ollama can hang. |
| **B-09** | **Build `Dockerfile` and `docker-compose.yml`** | Persona Team | P0 | `Dockerfile`: Python 3.11 slim, install deps, copy app, expose 8000. `docker-compose.yml`: builds the service, mounts `./data` for SQLite persistence, mounts `./demo_data` for precomputed classifications, env vars for LLM config. `docker compose up` boots the full stack in one command. | The entire service must be runnable with zero external dependencies except the LLM endpoint. |
| **B-10** | **Performance benchmark & timeout tuning** | Persona Team | P1 | Document LLM response times for: <br>- Single classify (target: < 20s) <br>- Batch of 10 (target: < 3 min with 1s rate limit) <br>- Set FastAPI timeout to 60s for classify, 5 min for batch. <br>Document Docker build time and image size (target: < 500MB). | Share benchmark numbers in handoff doc. |
| **B-11** | **Write `PERSONA_API_CONTRACT.md`** | Persona Team | P0 | Complete API contract document: <br>- All endpoints with request/response schemas <br>- Authentication: none for demo (platform team adds JWT later) <br>- Error codes: 200, 400 (invalid input), 422 (validation fail), 500 (LLM error), 504 (timeout) <br>- Rate limits: 1 req/sec per IP for classify, 50 items max for batch <br>- JSON schema for complaint input (from `edge_cases.md`) <br>- JSON schema for classification output (from `actual_case_1.json`) <br>- Docker usage instructions | This is the integration document for any future team. |
| **B-12** | **Write `PERSONA_SPRINT_HANDOFF.md`** | Persona Team | P0 | 1-page handoff covering: <br>- What we built (self-contained Dockerized LLM-as-a-Judge classification service) <br>- Architecture diagram (Complaint → FastAPI → LLM → JSON Validator → SQLite → Static HTML Dashboard) <br>- How to run: `docker compose up` <br>- API contract summary <br>- Known limitations (no auth, no Kafka, SQLite not Postgres) <br>- Demo script (5 min: ingest → classify → stats → detail) <br>- Next sprint recommendations (Postgres migration, caching, model fine-tuning, React frontend) | The R&D → Engineering handoff. |
| **INT-03** | **Demo dry-run** | Persona Team | P0 | Run the 5-minute demo script twice: <br>1. Using precomputed data (guaranteed path) <br>2. Using live `POST /v1/classify` (risky path, have precomputed as fallback) <br>Verify all JSON is valid, all Arabic renders correctly in static HTML, no 500s. <br>Run inside Docker to prove `docker compose up` works. | Record screen if possible. |
| **INT-04** | **Deliverables to other teams** | Persona Team | P0 | Package: <br>1. `PERSONA_API_CONTRACT.md` <br>2. Postman/curl collection <br>3. `demo_data/precomputed_classifications/` (10 JSON files) <br>4. `Dockerfile` + `docker-compose.yml` <br>5. Sample static `interventions.json` for future frontend use <br>6. `DB_CONTRACT.md` (for when they migrate from SQLite to Postgres) | Drop in shared drive or Slack. Our service works standalone regardless. |
| **INT-05** | **Deliverables to DB Team** | Persona Team | P0 | Package: <br>1. `DB_CONTRACT.md` (Postgres schema for future migration) <br>2. `persona_definitions_seed.sql` <br>3. Sample `complaints` insert script (1 row from edge_cases.md) <br>4. Sample `classifications` insert script (1 row from actual_case_1.json) <br>5. SQLite-to-Postgres migration notes | Drop in shared drive or Slack. Our service uses SQLite today; they can migrate later. |
| **FE-05** | **Polish static HTML: RTL, mobile, error states** | Persona Team | P1 | The static HTML dashboard should: <br>- Use Arabic-first typography (Noto Sans Arabic or similar via Google Fonts CDN) <br>- RTL layout (`dir="rtl"`) <br>- Responsive grid: 1 col mobile, 2 col tablet, 3 col desktop <br>- Loading skeletons for async data <br>- Error toasts for 500/504 <br>- Empty state when no classifications exist | Self-contained; no frontend team needed. |

---

## Cross-Team Dependency Tracker

| Dependency | We Need It From | By When | If Late, Mitigation |
|---|---|---|---|
| Ollama endpoint live + reachable | LLM / Ops team | Start of May 11 | Fallback to OpenAI API if env key provided; if both down, use precomputed data only. The service still boots and serves the dashboard with cached data. |
| Postgres migration (future) | DB team | Post-sprint | Not needed for demo. SQLite is embedded. `DB_CONTRACT.md` provided for future migration. |
| React frontend (future) | Frontend team | Post-sprint | Not needed for demo. Static HTML dashboard is fully functional. API contracts provided for future React rebuild. |

> **Note:** Because other teams are not meeting deadlines, this service is designed to run **standalone** with `docker compose up`. No external team is a blocker for the demo.

---

## Out of Scope (Explicitly Cut)

| Item | Why | Who Owns It (If Anyone) |
|---|---|---|
| Kafka streaming | REST-only for 2-day sprint. | Platform team (future sprint) |
| WebSocket real-time | Polling or manual refresh is fine for demo. | Frontend team (future) |
| Auth / RBAC | Open API for demo. JWT added later by platform team. | Platform team |
| Audio / vision signal ingestion | Out of persona scope per scope doc §16–18. | Advanced Signals team |
| Simulation engine | Platform-wide concern. Persona team only delivers classification intelligence. | Simulation team |
| Postgres migration | SQLite is sufficient for demo and early usage. `DB_CONTRACT.md` provided for future migration. | DB team (future) |
| React / Next.js frontend | Static HTML dashboard is sufficient for demo. API contracts provided for future React rebuild. | Frontend team (future) |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM (Ollama) hangs or returns garbage during demo | High | Demo failure | **Pre-compute all 10 classifications (`B-08`).** Live classify is the risky path; precomputed is the safe path. The dashboard renders from SQLite instantly. |
| Other teams don't deliver their components | High | Blocked integration | **Not a risk for us.** The service is self-contained with SQLite + static HTML. We demo standalone. |
| Docker build fails or image is too large | Medium | Can't deploy | **Use Python 3.11 slim base.** Target image < 500MB. Test `docker compose up` on a clean machine. |
| LLM safety layer misses an escalation trigger | Low | Politically dangerous | **Manual review step:** every `escalation.required = true` output must be logged and flagged for human review. Document this in handoff. |
| Arabic text corrupted in JSON (encoding issues) | Medium | Evidence quotes unreadable | **Force UTF-8** on all file reads (`sysprompt.md`, complaint input) and all API responses. Test with Edge Case 1 Arabic quotes in static HTML. |

---

## Demo Script (5 Minutes)

> Use this for the sprint review. Practice it twice. Run inside Docker.

1. **Setup (30 sec):** `docker compose up`. "This is the Persona Classification service. One command boots the API, the database, and the dashboard. No external dependencies."
2. **Ingest (1 min):** Open `http://localhost:8000/dashboard/ingest`. Paste Edge Case 1 JSON. Click Classify. Explain: "This is a 58-year-old man in Mafraq complaining about garbage. A weak classifier would call him Persona 9 because Mafraq has refugees. Our system returns `out_of_taxonomy` because the text doesn't match any archetype."
3. **Safety Layer (1 min):** Open `http://localhost:8000/dashboard/ingest` with Edge Case 2. "This looks like a workforce complaint, but it contains domestic violence. Our validator forces `escalation.required = true` and `composite_priority = P1` regardless of the persona match."
4. **Stats (1 min):** Open `http://localhost:8000/dashboard`. "Here's the aggregate view — persona distribution, priority breakdown, escalation count. All rendered from the embedded SQLite database."
5. **Detail (1 min):** Click a classification card. "And here's the full classification output with Arabic evidence quotes, confidence scores, and handling notes for the caseworker."
6. **Close (30 sec):** "The service is Dockerized and self-contained. Other teams can integrate later via the API contracts we provided. But the demo works now, standalone."

---

## Appendix: Input / Output Schema Reference

### Complaint Input Schema (what `POST /v1/classify` accepts)
```json
{
  "complaint_id": "string",
  "citizen_id": "string",
  "text": "string (Arabic or English)",
  "channel": "string (Sanad|call_center|web_portal|social_media|NGO|UN_channel|diwan|MP_office|SMS|WhatsApp|service_center)",
  "language": "string (Arabic|English|Mixed)",
  "governorate": "string",
  "district": "string",
  "service_entity": "string",
  "service_type": "string",
  "complaint_category": "string",
  "age": "integer",
  "gender": "string (male|female)",
  "occupation": "string",
  "citizenship_or_status": "string",
  "prior_complaints_count": "integer",
  "has_open_complaints": "boolean",
  "submitted_at": "ISO8601 datetime",
  "metadata": "object (optional)"
}
```

### Classification Output Schema (what the LLM returns, validated by B-03)
See `actual_case_1.json` and `sysprompt.md` §4 for the full schema. Key fields:
- `personas[]` with `persona_id`, `confidence`, `rationale`, `evidence_quotes[]`
- `persona_match_status`: `strong|partial|weak|none|out_of_taxonomy`
- `severity.composite_priority`: `P1|P2|P3|P4`
- `escalation.required`: `boolean`
- `recurring_complainer.is_recurring`: `boolean`
- `evidence_strength`: `strong|moderate|weak|insufficient`
- `responsible_handling_notes`: `string`

---

*Document prepared by Persona Classification Team for Task Writer (Kanban). Do not modify scope without team lead approval.*
