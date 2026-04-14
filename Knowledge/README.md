# SHAHM — Jordan National Policy Intelligence Platform (JNPI)

> **Not a chatbot. A modular, government-grade, multi-agent AI system.**

SHAHM is a Retrieval-Augmented Generation (RAG) platform built for the Jordanian government. It ingests Arabic legal and policy documents, routes natural-language queries through specialist AI agents, and returns grounded, cited, confidence-scored answers — with a full human-in-the-loop escalation pipeline and a multi-layered governance layer.

---

## Table of Contents

1. [System Overview & Architecture](#1-system-overview--architecture)
2. [Full Feature Set](#2-full-feature-set)
3. [Detailed Tech Stack](#3-detailed-tech-stack)
4. [Service Architecture & Interactions](#4-service-architecture--interactions)
5. [Governance & Security](#5-governance--security)
6. [Development & Deployment Guide](#6-development--deployment-guide)
7. [API Reference](#7-api-reference)
8. [Extensibility — Adding New Agents & Sources](#8-extensibility--adding-new-agents--sources)

---

## 1. System Overview & Architecture

### The RAG Pipeline

Every query goes through a strict, multi-stage pipeline before a response is returned:

```
User Query (Arabic/English)
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│ 1. INPUT GUARDRAIL (governance-service)                   │
│    ─ Rule-based (fast mode) OR LLM-based (detailed mode)  │
│    ─ Blocks: prompt injection, off-topic, policy_violation│
└────────────────────┬──────────────────────────────────────┘
                     │
                     ▼
┌───────────────────────────────────────────────────────────┐
│ 2. ROUTER AGENT (agent-service/core/router.py)            │
│    ─ Concise mode: Rule-based keyword matching (0ms LLM)  │
│    ─ Detailed mode: Gemini 2.5 Flash classification       │
│    ─ Cache: SHA-256(query+user_type+sector+lang) → Redis  │
│    ─ Intent: legal_inquiry | service_inquiry |            │
│              policy_comparison | general_inquiry |        │
│              out_of_scope                                 │
└────────────────────┬──────────────────────────────────────┘
                     │ Routes to:
         ┌───────────┼─────────────┬──────────────┐
         ▼           ▼             ▼              ▼
   [legal_affairs] [public_services] [policy_analysis] [general_knowledge]
         │           │             │
         └───────────┴─────────────┘
                     │ (concurrent via DelegationEngine if required)
                     ▼
┌───────────────────────────────────────────────────────────┐
│ 3. KNOWLEDGE RETRIEVAL (knowledge-service)                │
│    ─ SQL pre-filter: visibility tier + approval_status    │
│    ─ Cosine similarity on JSON vector store               │
│    ─ Returns chunks: text + metadata + score              │
└────────────────────┬──────────────────────────────────────┘
                     │
                     ▼
┌───────────────────────────────────────────────────────────┐
│ 4. AGENT SYNTHESIS                                        │
│    ─ Citation extraction (citations.py)                   │
│    ─ Amendment detection (amendments.py)                  │
│    ─ Optional self-verification (verification.py)         │
│    ─ Confidence scoring (confidence.py) — 5-factor formula│
└────────────────────┬──────────────────────────────────────┘
                     │
                     ▼
┌───────────────────────────────────────────────────────────┐
│ 5. OUTPUT GUARDRAIL (governance-service)                  │
│    ─ Hallucination detection                              │
│    ─ Visibility leak check                                │
│    ─ Compliance validation                                │
└────────────────────┬──────────────────────────────────────┘
                     │
         ┌───────────┴────────────┐
         ▼                        ▼
  [confidence ≥ 0.4]      [confidence < 0.4]
  Return response          → EscalationEngine
  to frontend              → Propose ticket to user
                           → On consent: workflow-service
```

### Deployment Architecture

```
Browser (RTL/Arabic React 19 SPA)
      │ HTTPS
      ▼
frontend (nginx, port 5173 → internal 3000)
      │ REST
      ▼
agent-service (FastAPI, port 9200 → internal 8200)
      │ sync REST            │ async REST
      ▼                      ▼
governance-service     knowledge-service
(port 9300→8300)        (port 9100→8100)
                             │ async REST
                             ▼
                        workflow-service
                        (port 9400→8400)

All services share: Redis (port 6379) for routing/guardrail/response caching
```

---

## 2. Full Feature Set

### 2.1 Semantic Search & Knowledge Retrieval
**Location:** `app/services/knowledge-service/core/retrieval.py`

Two-stage retrieval pipeline:
1. **SQL pre-filter** — `WHERE visibility IN (user_tier_allowed) AND approval_status='approved'`
2. **Cosine similarity** — Dot product over `{hash}_v{n}.json` embedding files, top-K results returned

Supported chunking strategies: `page` (default), `paragraph`, `fixed_size`.

```python
# Visibility tier mapping applied at agent-service before calling knowledge-service
USER_TYPE_TO_VISIBILITY = {
    "citizen":  ["public"],
    "employee": ["public", "internal"],
    "admin":    ["public", "internal", "confidential"],
}
```

### 2.2 Page-Level Evidence Viewer
**Location:** `app/services/knowledge-service/api/sources.py` + frontend citation cards

Every agent response includes structured `Citation` objects:
```python
class Citation(BaseModel):
    source_id: str      # UUID of the knowledge source
    source_name: str    # Human-readable document title
    page: int           # Page number within the PDF
    text: str           # The exact retrieved chunk text
    score: float        # Cosine similarity score
```
The frontend converts `source_id + page` into an HTTP call to `GET /sources/{id}/page/{n}`, which returns a PNG rendering of the original document page. Users can **visually verify every claim** against the source document.

### 2.3 Confidence Scoring Engine
**Location:** `app/services/agent-service/core/confidence.py`

Five-factor weighted formula (all factors clamped to `[0.0, 1.0]`):

| Factor | Weight | Logic |
|---|---|---|
| `chunk_support` | 20% | `min(num_chunks / 3.0, 1.0)` |
| `avg_similarity` | 35% | Mean cosine similarity of retrieved chunks |
| `amendment_factor` | 10% | `0.7` if amendments found, else `1.0` |
| `sector_match` | 25% | Fraction of chunk sectors matching routed sector |
| `routing_confidence` | 10% | Router's own confidence hint |

**Penalty rules:**
- Severe sector mismatch (`sector_match < 0.34`) → `score *= 0.55`
- Thin + weak evidence (`num_chunks < 2` AND `avg_similarity < 0.72`) → `score *= 0.80`

### 2.4 Legal Amendment Detection
**Location:** `app/services/agent-service/core/amendments.py`

`AmendmentChecker` cross-references retrieved chunks against the knowledge base to find superseding laws. If an amendment is detected, an Arabic warning note is appended to the response:

> *"تنبيه: هذا القانون تم تعديله بموجب [قانون X] لسنة [Y]. يرجى مراجعة التعديل للتأكد من الأحكام السارية."*

Detection logic:
1. Check if any retrieved chunk has `metadata.is_amendment == True` (direct hit)
2. If not, call Knowledge Service to search for amendments targeting the cited source name

### 2.5 Expert-in-the-Loop Escalation
**Location:** `app/services/agent-service/core/escalation.py`

`EscalationEngine` is triggered by four conditions (in priority order):

| Trigger | Type | Behaviour |
|---|---|---|
| User says `"أريد موظف"` / `"speak to someone"` | `user_request` | Immediately propose ticket |
| Router classifies `out_of_scope` | `out_of_scope` | Polite rejection, no ticket |
| `confidence < CONFIDENCE_THRESHOLD` (default: `0.4`) | `low_confidence` | Propose ticket, await user "yes" |
| Self-verification found contradictions | `contradiction` | Propose ticket |

On user confirmation, a `POST /cases` call is made to `workflow-service` with the full query, session, sector, priority, and confidence at time of escalation.

### 2.6 Multi-Agent Delegation (Concurrent Dispatch)
**Location:** `app/services/agent-service/core/delegation.py`

For complex cross-domain queries, the Router sets `requires_delegation=True` and generates `sub_questions[]` — each assigned to a different specialist. `DelegationEngine` dispatches all sub-questions concurrently via `asyncio.gather()`, then calls Gemini to merge the specialist answers into a single coherent response.

### 2.7 Audit Trail & Governance Logging
**Location:** `app/services/governance-service/api/audit.py`

Every query fires an **asynchronous, fire-and-forget** audit POST to `governance-service`. The log record includes:

`request_id` · `session_id` · `query` · `user_type` · `intent` · `sector` · `agent_used` · `answer` · `confidence` · `input_guardrail_result` · `output_guardrail_result` · `total_latency_ms` · `knowledge_latency_ms` · `escalated` (bool)

Stored in SQLite. Retention: 90 days (configurable).

### 2.8 Platform Metrics & Strategic Gap Analysis
**Location:** `app/services/governance-service/api/metrics.py`

`GET /metrics` returns aggregate operational data for executive dashboards:
- Total query volume & daily trend
- P95 latency (ms)
- Average confidence score
- Escalation rate (% of in-scope queries that went to workflow)
- Guardrail rejection rate
- Query distribution by sector and agent type

The **Semantic Gap Analysis** derives from escalated + low-confidence queries: sectors with high escalation rates signal where the knowledge base has gaps or where new policy documents are needed.

### 2.9 Document Versioning & Amendment Tracking
**Location:** `app/services/knowledge-service/core/ingestion.py`

When a document is ingested whose title matches an existing record, a new version is created. Both versions remain active and linked via `is_amendment` / `amends_target` metadata fields.

`GET /versions/{source_id}` returns the full version history for any document.

### 2.10 Session Management & Conversation History
**Location:** `app/services/agent-service/session_manager.py`

- SQLite-backed session store per user
- TTL: 24 hours (`SESSION_TTL_HOURS`)
- Max conversation depth: 20 turns (`MAX_CONVERSATION_DEPTH`)
- User type (`citizen`/`employee`/`admin`) is bound to the session at creation and **cannot be escalated mid-session**

---

## 3. Detailed Tech Stack

### 3.1 Frontend

| Technology | Version | Role |
|---|---|---|
| React | 19.2.4 | UI framework |
| TypeScript | 5.9.3 | Type safety |
| Vite | 8.0.0 | Build tool & dev server |
| Tailwind CSS | 3.4.19 | Utility-first styling, Arabic RTL |
| Framer Motion | 12.36.0 | Message transition animations |
| Recharts | 3.8.0 | Metrics/analytics charts |
| Lucide React | 0.577.0 | Icon library |
| React Markdown | 10.1.0 | Renders structured agent responses |
| nginx | 1.27-alpine | Production SPA serving |

State management is handled via React Context + `localStorage` persistence (no Redux). A `SessionStore` class in `App.tsx` manages multi-chat history.

### 3.2 Backend (All Services)

| Technology | Version | Role |
|---|---|---|
| Python | 3.11 | Runtime |
| FastAPI | ≥0.115.0 | Async web framework |
| Uvicorn | ≥0.30.0 | ASGI server |
| Pydantic | ≥2.0.0 | Schema validation & serialization |
| aiosqlite | ≥0.20.0 | Async SQLite for sessions/audit |
| httpx | ≥0.27.0 | Async HTTP inter-service calls |
| redis | ≥5.0.0 | Routing & guardrail result caching |
| psycopg | ≥3.2.1 | PostgreSQL/Supabase driver (optional) |
| python-dotenv | ≥1.0.0 | Environment variable loading |

**Knowledge Service extras:**

| Technology | Role |
|---|---|
| PyMuPDF (`fitz`) | PDF rendering & page chunking to PNG |
| Pillow | Image processing |
| python-pptx | PPTX parsing |
| LibreOffice (headless) | DOCX → PDF conversion |
| Tesseract OCR + Arabic pack | Fallback OCR for scanned PDFs |

### 3.3 AI / ML Infrastructure

| Component | Value |
|---|---|
| **Reasoning LLM** | Google Gemini 2.5 Flash (`gemini-2.5-flash`) |
| **Fast Router LLM** | Configurable via `FAST_ROUTER_GEMINI_MODEL` env var |
| **Embedding Model** | Gemini Embedding 2 — 768-dim (Matryoshka MRL) |
| **Vector Storage** | JSON files per document + SQLite metadata |
| **Similarity Metric** | Cosine similarity (dot product over normalized L2 vectors) |
| **Retrieval Top-K** | 5 (concise mode), 8 (detailed mode) |

**Why Gemini Embedding 2 for Arabic:**

| Metric | Gemini Embedding 2 | OpenAI Alternative |
|---|---|---|
| Arabic ARCD win rate | **59.6%** | ~38% |
| MTEB score | **68.32** | Lower |
| Cost per 10,000 docs | **~$9.60** (no OCR) | ~$46.50 (requires OCR) |
| Arabic PDF handling | Native visual embedding | Requires OCR pipeline |

### 3.4 Infrastructure

| Technology | Role |
|---|---|
| Docker | All 6 services containerized |
| Docker Compose | Multi-service orchestration with health checks |
| Redis 7 | Shared cache (LRU, 512MB, AOF persistence) |
| nginx 1.27 (alpine) | Frontend serving + SPA fallback routing |
| GitHub Actions | CI: Python syntax validation, Docker build check, CodeQL SAST |

---

## 4. Service Architecture & Interactions

### Service Ports

| Service | Internal Port | Docker Exposed Port |
|---|---|---|
| frontend | 3000 | **5173** |
| knowledge-service | 8100 | **9100** |
| agent-service | 8200 | **9200** |
| governance-service | 8300 | **9300** |
| workflow-service | 8400 | **9400** |
| redis | 6379 | **6379** |

### Startup Dependency Order

```
redis  →  knowledge-service  →  agent-service  →  governance-service
                                               →  workflow-service
                                               →  frontend
```

All dependencies use `condition: service_healthy` so Docker Compose waits for readiness, not just process start.

### Inter-Service Call Patterns

```
agent-service  ──sync──►  governance-service  (guardrail_check: input + output)
agent-service  ──sync──►  knowledge-service   (POST /retrieve)
agent-service  ──async──► governance-service  (POST /audit/log — fire-and-forget)
agent-service  ──async──► workflow-service    (POST /cases — on escalation)
frontend       ──sync──►  knowledge-service   (GET /sources/{id}/page/{n} — citations)
frontend       ──sync──►  agent-service       (POST /query)
```

### Caching Architecture (Redis)

| Cache Type | Key | TTL |
|---|---|---|
| Routing result | `route:sha256(query+user_type+sector+lang+mode)` | 4 hours |
| Input guardrail | `guard_in:sha256(text+language)` | 5 min |
| Output guardrail | `guard_out:sha256(answer+query+user_type)` | 5 min |
| Response data | Request ID (FIFO, max 1000) | Session |

---

## 5. Governance & Security

### RBAC — Role-Based Access Control

RBAC is enforced at **two independent layers** (both must pass):

1. **Agent Service** (`core/agents/base.py`): Converts `user_type` to a `visibility` list before calling Knowledge Service.
2. **Knowledge Service** (`storage/database.py`): Applies `WHERE visibility IN (...)` as a mandatory SQL filter.

```
citizen   →  ["public"]
employee  →  ["public", "internal"]
admin     →  ["public", "internal", "confidential"]
```

There is **no code path** that allows a citizen to receive a confidential document — even if the agent were somehow compromised.

### Document Approval Gating

Ingested documents default to `approval_status = "pending"`. Only `approved` documents appear in retrieval results. Admins promote documents via the admin UI or `PATCH /sources/{id}`.

### Guardrail Implementation

**Input Guardrail** (`governance-service/core/input_guardrails.py`):

| Category | What It Catches |
|---|---|
| `prompt_injection` | Instructions to override system prompts or reveal internals |
| `off_topic` | Queries with zero relevance to Jordanian government/law |
| `policy_violation` | Politically sensitive or inappropriate content |
| `compliance_issue` | Queries that would create legal liability |

**Output Guardrail** (`governance-service/core/output_guardrails.py`):

| Category | What It Catches |
|---|---|
| `hallucination` | Claims not grounded in retrieved chunks |
| `visibility_leak` | Confidential content in a lower-tier response |
| `compliance_issue` | Responses creating regulatory liability |

**Two modes (controlled per request by agent-service):**
- `rule_only=True` — Pure regex/pattern matching. Zero LLM cost. Used in concise mode.
- `rule_only=False` — Gemini 2.5 Flash evaluates the full query/response. Used in detailed mode.

Results are cached in Redis to amortize LLM costs on repeated identical queries.

---

## 6. Development & Deployment Guide

### Prerequisites

- Docker ≥ 24.0 + Docker Compose v2
- A Google AI Studio API key with Gemini access

### Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/EzzoHamdan/Knowledge2.git
cd Knowledge2/app

# 2. Configure environment
cp .env.shared.example .env.shared
# Open .env.shared and fill in GEMINI_API_KEY

# 3. Build and launch all services
docker compose up --build

# 4. Access the platform
open http://localhost:5173        # Frontend
open http://localhost:9200/docs   # Agent Service OpenAPI
open http://localhost:9100/docs   # Knowledge Service OpenAPI
open http://localhost:9300/docs   # Governance Service OpenAPI
```

### Environment Variables

**Shared (`app/.env.shared`):**

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | *(required)* | Google AI Studio key |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Primary LLM |
| `KNOWLEDGE_SERVICE_URL` | `http://knowledge-service:8100` | Internal service URL |
| `AGENT_SERVICE_URL` | `http://agent-service:8200` | Internal service URL |
| `GOVERNANCE_SERVICE_URL` | `http://governance-service:8300` | Internal service URL |
| `WORKFLOW_SERVICE_URL` | `http://workflow-service:8400` | Internal service URL |
| `USE_SUPABASE` | `false` | Set `true` to use Supabase instead of SQLite |
| `DATABASE_URL` | *(empty)* | Supabase/Postgres URI if `USE_SUPABASE=true` |

**Agent Service (`app/services/agent-service/.env`):**

| Variable | Default | Description |
|---|---|---|
| `CONFIDENCE_THRESHOLD` | `0.4` | Below this → escalation triggered |
| `DEFAULT_TOP_K` | `5` | Retrieved chunks per query |
| `DETAILED_TOP_K` | `8` | Top-K in detailed mode |
| `MAX_CONVERSATION_DEPTH` | `20` | Max turns per session |
| `SESSION_TTL_HOURS` | `24` | Session expiry |
| `ENABLE_SELF_VERIFICATION` | `false` | Enable LLM self-check (adds ~200ms) |
| `FAST_MODE_RULE_ONLY_GUARDRAILS` | `true` | Rule-only guardrails in concise mode |
| `CONCISE_MAX_OUTPUT_TOKENS` | `1024` | Token budget for fast responses |
| `DETAILED_MAX_OUTPUT_TOKENS` | `8192` | Token budget for detailed responses |

### Ingesting Documents

```bash
# Upload a PDF to the knowledge base
curl -X POST http://localhost:9100/ingest \
  -F "file=@/path/to/law.pdf" \
  -F "visibility=public" \
  -F "sector=justice"

# The response returns a source_id and ingestion status
# The document is pending admin approval before appearing in searches
```

### Running a Query (API)

```bash
curl -X POST http://localhost:9200/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "ما هي عقوبة الجرائم الإلكترونية وفق قانون 2023؟",
    "user_type": "citizen",
    "mode": "detailed",
    "language": "ar"
  }'
```

---

## 7. API Reference

### Agent Service (`:9200`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/query` | Main query endpoint — full RAG pipeline |
| `POST` | `/delegate` | Internal — dispatch to a specific specialist |
| `GET` | `/confidence/{request_id}` | Retrieve confidence breakdown for a past response |
| `POST` | `/validate` | Verify an answer against the knowledge base |
| `GET` | `/explain_decision/{request_id}` | Explain routing decision |
| `GET` | `/health` | Service health check |
| `GET` | `/docs` | Auto-generated OpenAPI UI |

### Knowledge Service (`:9100`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/ingest` | Upload & embed a document |
| `POST` | `/retrieve` | Semantic search (internal use) |
| `GET` | `/sources` | List all ingested sources |
| `GET` | `/sources/{id}` | Get source metadata |
| `DELETE` | `/sources/{id}` | Remove a source |
| `GET` | `/sources/{id}/page/{n}` | Serve PNG of document page `n` |
| `GET` | `/versions/{id}` | Version history for a source |
| `GET` | `/health` | Service health check |

### Governance Service (`:9300`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/guardrail_check` | Validate input (`check_type: "input"`) or output (`check_type: "output"`) |
| `POST` | `/audit/log` | Write an audit record |
| `GET` | `/audit/logs` | Query audit log (admin) |
| `GET` | `/metrics` | Platform-wide operational metrics |
| `POST` | `/evaluate` | Evaluate response quality |
| `GET` | `/health` | Service health check |

### Workflow Service (`:9400`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/cases` | Create an escalated case |
| `GET` | `/cases` | List cases (filterable by status/sector/priority) |
| `GET` | `/cases/{id}` | Full case details + timeline |
| `PATCH` | `/cases/{id}` | Update status, priority, assignment |
| `POST` | `/cases/{id}/resolve` | Resolve with human-provided answer |
| `GET` | `/cases/user/{user_id}` | User's own ticket inbox |

---

## 8. Extensibility — Adding New Agents & Sources

### Adding a New Specialist Agent

1. **Create the agent class** in `app/services/agent-service/core/agents/`:

```python
# app/services/agent-service/core/agents/environment_affairs.py
from core.agents.base import BaseAgent, AgentContext, AgentResult

class EnvironmentAffairsAgent(BaseAgent):
    name = "environment_affairs"

    async def process(self, query: str, context: AgentContext) -> AgentResult:
        chunks = await self.retrieve_knowledge(query, context, doc_type="regulation")
        answer = await self.synthesize(query, chunks, context)
        return AgentResult(answer=answer, raw_chunks=chunks, agent_name=self.name, sector=context.sector)
```

2. **Create the system prompt** in `app/services/agent-service/prompts/environment_affairs_prompt.py`

3. **Register it** in `app/services/agent-service/core/agents/__init__.py`:

```python
from core.agents.environment_affairs import EnvironmentAffairsAgent

SON_REGISTRY: dict = {
    # ... existing agents ...
    "environment_affairs": EnvironmentAffairsAgent(),
}
```

4. **Update the Router** in `app/services/agent-service/prompts/router_prompt.py` — add `"environment_affairs"` to `VALID_AGENTS` and the sector `"environment"` to `VALID_SECTORS`.

5. **Add keyword rules** to `_fast_rule_route()` in `router.py` for fast-path routing.

### Adding a New Ministry Knowledge Source

1. Place PDF/DOCX files in `app/Minsitries_Data/{ministry_name}/`
2. Ingest via the `/ingest` API endpoint, specifying `sector` and `visibility`
3. Documents start as `approval_status: pending`; approve via admin UI
4. Ingest confirmation returns the `source_id` for query tracking

### Extending the Workflow SLA (Roadmap)

The Workflow Service is scaffolded at ~40% completion. The next implementation priorities are:
- **SLA enforcement**: Auto-escalate urgent tickets unresolved after a configurable time limit
- **Notification system**: Email/push on case state changes
- **FAQ pipeline**: Automatically promote resolved FAQ candidates into the knowledge base
- **Bulk admin operations**: Batch assignment and resolution

---

## Project Status

| Service | Completion | Production Ready |
|---|---|---|
| knowledge-service | 100% | ✅ Yes |
| agent-service | 100% | ✅ Yes |
| governance-service | 100% | ✅ Yes |
| workflow-service | ~40% | ⚠️ MVP Only |
| frontend | ~60% | ⚠️ No Real Auth |
| **Overall** | **~75%** | **Partial** |

---

*Developed for Jordan's National Digital Transformation Program.*
*Maintained by the SHAHM Engineering Team.*
