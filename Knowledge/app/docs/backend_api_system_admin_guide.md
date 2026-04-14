# JNPI Backend API & Features Guide (System Admin Frontend)

## Purpose
This document is the backend integration reference for building the **main system-admin UI**.
It covers:
- All implemented backend services and routes
- Request/response contracts (practical fields)
- Feature capabilities already available in backend
- What to wire in frontend first (admin-priority checklist)

---

## 1) Platform Services Overview

| Service | Internal Port | Exposed Port | Role |
|---|---:|---:|---|
| knowledge-service | 8100 | 9100 | Document ingestion, indexing, semantic retrieval, source/version management |
| agent-service | 8200 | 9200 | Query orchestration, routing, citation/confidence output, escalation logic |
| governance-service | 8300 | 9300 | Guardrails, audit logs, evaluation, metrics, release status |
| workflow-service | 8400 | 9400 | Ticket lifecycle (create/list/update/resolve/notes), answered-ticket reuse |

### Core backend flow
1. User asks via `agent-service /query`
2. Agent routes + retrieves from `knowledge-service`
3. If no reliable answer: confirmation -> ticket via `workflow-service`
4. Admin resolves ticket (`/cases/{id}/resolve`)
5. Future same query can be answered from `workflow-service /cases/answered/match`

---

## 2) Cross-Service Integration Notes (Important)

- `agent-service /query` supports:
  - `session_id` (chat session context)
  - `user_id` (stable cross-session identity)
- Resolved-ticket reuse strategy is implemented in backend as:
  1) match by `user_id`
  2) fallback by `session_id`
  3) fallback global exact query hash match
- Main admin UI can rely on this for “learning from answered tickets” behavior.

---

## 3) Agent Service API (Port 9200)

### 3.1 POST `/query`
Main user query endpoint.

**Request fields**
- `query` (string, required)
- `user_type` (`citizen | employee | admin`, default `citizen`)
- `session_id` (optional string)
- `user_id` (optional string, recommended for persistent learning)
- `sector_hint` (optional)
- `language` (`ar | en`, default `ar`)
- `mode` (`concise | detailed`, default `concise`)

**Response fields (key)**
- `answer`
- `confidence` (0..1)
- `citations[]` (`source_id`, `source_name`, `page`, etc.)
- `agent_used`, `sector`
- `escalated` (bool)
- `escalation_confirmation_required` (bool)
- `response_id` (for confidence/explain endpoints)
- `timings` (step breakdown)

**Frontend implications**
- Show confirmation UI when `escalation_confirmation_required=true`
- Always send stable `user_id` from app auth profile for cross-chat ticket learning

### 3.2 GET `/confidence/{response_id}`
Returns confidence breakdown for previous `/query` response.

### 3.3 GET `/explain_decision/{response_id}`
Returns routing decision + confidence/amendment/verification details.

### 3.4 POST `/delegate`
Internal/direct specialist dispatch endpoint (advanced/testing use).

### 3.5 POST `/validate`
Re-validates an answer against evidence (admin QA tool candidate).

### 3.6 GET `/health`
Service health + knowledge-service reachability.

### 3.7 Orchestrator Runtime Policy
- `agent-service` now supports a single orchestrator runtime: `v2`.
- Startup validation is fail-fast: if `ORCHESTRATOR_RUNTIME` is anything other than `v2`, the service raises a `ValueError` and refuses to start.
- Legacy fastpath runtime has been removed to keep profiling, behavior, and maintenance aligned with one production path.

---

## 4) Knowledge Service API (Port 9100)

## 4.1 POST `/ingest`
Uploads and ingests one file.

**Supported uploads**
- `.pdf`, images, `.txt`, `.html/.htm`, `.docx`

**Form fields**
- `file` (required)
- `source_name` (optional)
- `tags` (comma-separated)
- `language` (default `auto`)
- `chunk_strategy` (`page | fixed | paragraph`)
- `visibility` (`public | internal | confidential`, optional override)
- `approval_status` (`approved | draft | revoked`)

**Response highlights**
- `source_id`
- `source_name`
- `chunks_created`
- `doc_type` (`regulation | general`)
- `classification` (title/year/visibility/sector/keywords)

**DOCX note**
- DOCX->PDF conversion robustness has been hardened in backend.

## 4.2 POST `/ingest/batch`
Multi-file ingestion.
Returns `successful[]`, `failed[]`, `total_processed`.

## 4.3 POST `/retrieve`
Semantic retrieval endpoint used by agents/admin search UI.

**Request fields**
- `query` (required)
- `top_k` (1..50)
- optional: `source_ids[]`, `tags[]`, `doc_type`, `sector`, `visibility`, `min_score`

**Response**
- `results[]` with `chunk_id`, `source_id`, `source_name`, `page`, `text`, `score`, metadata

## 4.4 GET `/sources`
List all ingested sources with metadata.

## 4.5 GET `/sources/{source_id}`
Get full source details.

## 4.6 DELETE `/sources/{source_id}`
Delete source + chunks + embeddings + page images.

## 4.7 GET `/sources/{source_id}/pages`
List all rendered page images for source.

## 4.8 GET `/sources/{source_id}/page/{page_num}`
Get page image binary (for document viewer panel).

## 4.9 GET `/sources/{source_id}/file`
Download original stored file.

## 4.10 GET `/versions/{source_id}`
Version history for source.

## 4.11 GET `/health`
Storage/model/status summary.

---

## 5) Workflow Service API (Port 9400)

## 5.1 POST `/cases`
Create escalation ticket.

**Request fields**
- `request_id` (required)
- optional: `session_id`, `user_id`
- `query`
- `user_type`
- `sector_primary`, `sector_labels[]`
- `priority` (`low|medium|high|urgent`)
- `escalation_reason`
- `confidence`
- `source_response_id`

## 5.2 GET `/cases`
Admin/global list with filters: `status`, `sector`, `priority`, `assignee`, `user_id`, paging.

## 5.3 GET `/cases/{case_id}`
Case details + timeline.

## 5.4 PATCH `/cases/{case_id}`
Update status/priority/assignment/sector fields.

## 5.5 POST `/cases/{case_id}/notes`
Add timeline note.

## 5.6 POST `/cases/{case_id}/resolve`
Resolve ticket with:
- `actor`
- `resolution_answer` (critical for user-facing answer reuse)
- `resolution_note`

## 5.7 GET `/users/{user_id}/cases`
List cases for one user identity (main user inbox endpoint).

## 5.8 POST `/cases/{case_id}/faq_candidate`
Mark case for FAQ/knowledge curation pipeline.

## 5.9 GET `/cases/answered/match`
Find resolved answer for same query.

**Query params**
- `query` (required)
- optional `user_id`, `session_id`

**Response**
- `{ "found": false }` OR
- `{ found: true, case_id, resolution_answer, resolved_at, query }`

## 5.10 GET `/health`
Case-count health summary.

---

## 6) Governance Service API (Port 9300)

## 6.1 POST `/guardrail_check`
Input/output guardrails.

**Request**
- `check_type`: `input | output`
- `text`
- `query` required for output checks
- `user_type`, `language`, `rule_only`

## 6.2 POST `/audit`
Create audit log record.

## 6.3 GET `/audit`
Filterable audit query:
- `session_id`, `user_type`, `sector`, `escalated`, `input_passed`, `output_passed`, date range, paging

## 6.4 GET `/audit/{request_id}`
Single audit record by request_id.

## 6.5 POST `/audit/cleanup`
Retention cleanup operation.

## 6.6 POST `/evaluate`
Modes:
- `single` (expected vs actual)
- `batch` (suite)
- `aggregate` (period summary)

## 6.7 GET `/metrics`
Aggregated KPIs over period (`1h|24h|7d|30d`).

## 6.8 GET `/release_status`
Platform service reachability + status summary.

## 6.9 GET `/logs`
Simplified recent logs endpoint (alias style).

## 6.10 GET `/health`
Governance health + sibling service health checks.

---

## 7) System Admin Frontend Build Checklist (Main UI)

## Phase A — Must-have control plane
1. **Knowledge Hub**
   - Upload single/batch docs via `/ingest`, `/ingest/batch`
   - Browse/delete/download via `/sources`, `/sources/{id}`, `/sources/{id}/file`, `DELETE /sources/{id}`
   - Page viewer via `/sources/{id}/pages` + `/sources/{id}/page/{n}`
   - Retrieval test console via `/retrieve`

2. **Ticket Operations**
   - Global queue via `GET /cases`
   - Resolve flow with `POST /cases/{id}/resolve`
   - Notes/status/assignment via `/cases/{id}/notes`, `PATCH /cases/{id}`

3. **Answered-Ticket Reuse Monitor**
   - Query check via `GET /cases/answered/match`
   - Display match rate and stale unanswered clusters

## Phase B — Governance/quality panel
4. **Guardrail Console** via `/guardrail_check`
5. **Audit Explorer** via `/audit`, `/logs`
6. **Ops Metrics** via `/metrics`, `/evaluate`, `/release_status`

## Phase C — Existing service UI parity in main admin UI
7. Move these from service-local UIs into main admin shell:
   - Knowledge source browser/viewer
   - Ticket resolve/reply workflows
   - Audit + performance dashboards

---

## 8) Integration Conventions for Frontend

- Use service base URLs from gateway/proxy env (recommended):
  - `http://localhost:9100` knowledge
  - `http://localhost:9200` agent
  - `http://localhost:9300` governance
  - `http://localhost:9400` workflow
- Always include stable `user_id` in `/query` requests.
- Keep `session_id` per chat thread, but do not rely on it alone for ticket learning.
- For ticket inbox in user-facing UI, query by `auth.id` through `/users/{user_id}/cases`.

---

## 9) Known Backend Constraints / Notes

- Current answered-ticket learning is **exact query-hash based** (not semantic paraphrase matching).
- No explicit auth middleware is enforced at API layer in current code; role control is frontend/app-level.
- `/audit/{request_id}` error behavior is non-standard in implementation (returns tuple pattern) and may need normalization later.

---

## 10) Quick API Smoke Commands

### Agent query
```bash
curl -X POST http://localhost:9200/query \
  -H 'Content-Type: application/json' \
  -d '{"query":"ما هي المادة الأولى من الدستور؟","user_type":"user","user_id":"u1","session_id":"s1","language":"ar","mode":"concise"}'
```

### Resolve a ticket
```bash
curl -X POST http://localhost:9400/cases/<case_id>/resolve \
  -H 'Content-Type: application/json' \
  -d '{"actor":"admin","resolution_answer":"...","resolution_note":"resolved"}'
```

### Check answered reuse
```bash
curl -G http://localhost:9400/cases/answered/match \
  --data-urlencode 'query=...' \
  --data-urlencode 'user_id=u1'
```

### Ingest document
```bash
curl -X POST http://localhost:9100/ingest \
  -F 'file=@/path/to/file.pdf' \
  -F 'source_name=Policy Document' \
  -F 'tags=policy,2026'
```
