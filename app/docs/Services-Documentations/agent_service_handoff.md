# Agent Service — Handoff Documentation

> **Date:** March 12, 2026
> **Status:** All 11 phases code-complete. Needs `.env` setup, end-to-end testing, and 2 missing router registrations.
> **Lines of code:** 2,721 across 45 files

---

## What Was Built

The **Agent Orchestration Microservice** (port 8200) for the Jordan National Policy Intelligence Platform (JNPI). It is the "brain" that sits between users and the Knowledge Service, routing queries to specialist AI agents that generate government-grade answers with citations, confidence scores, and amendment warnings.

### Architecture

```
User Query
    ↓
[1] Escalation Check (user requesting human?)
    ↓
[2] Router Agent (Gemini Flash → intent/sector/agent classification)
    ↓
[3] Delegation Check (needs multiple agents?)
    ↓  yes → DelegationEngine (parallel dispatch + LLM merge)
    ↓  no  → Single specialist agent
[4] Specialist Agent (legal_affairs | public_services | policy_analysis | general_knowledge)
    ↓
[5] Tool Layer → Knowledge Service HTTP (visibility-enforced)
    ↓
[6] Citation Extraction
[7] Amendment Check (superseded clauses?)
[8] Self-Verification (LLM reviews own answer)
[9] Confidence Scoring (weighted formula)
[10] Escalation Triggers (low confidence, contradictions)
[11] Session Save
    ↓
Response with citations, confidence, amendments, escalation status
```

---

## File Inventory (45 files)

### Root
| File | Purpose |
|---|---|
| `main.py` | FastAPI app, CORS, router registration, startup logging |
| `config.py` | Environment config via python-dotenv |
| `requirements.txt` | Python dependencies |
| `Dockerfile` | Production container (python:3.11-slim) |
| `docker-compose.yml` | Agent + Knowledge services together |
| `.env.example` | Template for all config vars |
| `.gitignore` | Standard Python ignores + data/ |
| `.dockerignore` | Docker build exclusions |

### `api/` — REST Endpoints
| File | Endpoint | Status |
|---|---|---|
| `health.py` | `GET /health` | Registered |
| `query.py` | `POST /query` | Registered |
| `confidence.py` | `GET /confidence/{response_id}` | Registered |
| `delegate.py` | `POST /delegate` | Registered |
| `validate.py` | `POST /validate` | **NOT registered in main.py** |
| `explain.py` | `GET /explain_decision/{response_id}` | **NOT registered in main.py** |

### `core/` — Business Logic
| File | Purpose |
|---|---|
| `llm.py` | GeminiClient wrapper (lazy init, retry, JSON extraction) |
| `router.py` | RouterAgent — LLM-based intent/sector/agent classification |
| `tools.py` | KnowledgeTools — visibility-enforced Knowledge Service calls |
| `citations.py` | CitationExtractor — chunks → structured Citation objects |
| `confidence.py` | ConfidenceScorer — weighted 0-1 score |
| `amendments.py` | AmendmentChecker — detects superseded clauses |
| `verification.py` | SelfVerifier — LLM reviews answer for accuracy |
| `escalation.py` | EscalationEngine — 4 trigger types |
| `delegation.py` | DelegationEngine — parallel dispatch + LLM merge |

### `core/agents/` — Specialist Agents
| File | Agent Name | Search Strategy |
|---|---|---|
| `base.py` | — | BaseAgent ABC, AgentContext, AgentResult, visibility map |
| `__init__.py` | — | AGENT_REGISTRY dict |
| `legal_affairs.py` | `legal_affairs` | `doc_type="regulation"`, focused on laws |
| `public_services.py` | `public_services` | No doc_type filter, citizen-friendly language |
| `policy_analysis.py` | `policy_analysis` | `doc_type="regulation"`, double `top_k` for comparison |
| `general_knowledge.py` | `general_knowledge` | No filters — broadest search, fallback agent |

### `prompts/` — LLM Prompt Templates
| File | Used By |
|---|---|
| `router_prompt.py` | RouterAgent — classifies intent, sector, agent |
| `legal_affairs_prompt.py` | LegalAffairsAgent |
| `public_services_prompt.py` | PublicServicesAgent |
| `policy_analysis_prompt.py` | PolicyAnalysisAgent |
| `general_knowledge_prompt.py` | GeneralKnowledgeAgent |
| `verification_prompt.py` | SelfVerifier |
| `merge_prompt.py` | DelegationEngine |

### `models/`
| File | Purpose |
|---|---|
| `schemas.py` | All Pydantic models: QueryRequest, QueryResponse, Citation, RoutingDecision, SubQuestion, DelegateRequest, ValidateRequest, ValidateResponse, ExplainResponse, HealthResponse |

### `storage/`
| File | Purpose |
|---|---|
| `sessions.py` | SQLite session store for conversation memory (24h TTL, max 20 messages) |

### `client/`
| File | Purpose |
|---|---|
| `knowledge_client.py` | Extended copy of knowledge-service SDK with `sector`, `doc_type`, `visibility` params on `retrieve()` |

---

## What Works (Verified)

- All modules import without errors (tested without API key — lazy init)
- All 4 agents in AGENT_REGISTRY: `legal_affairs`, `public_services`, `policy_analysis`, `general_knowledge`
- Registered routes: `/health`, `/query`, `/confidence/{response_id}`, `/delegate`
- Escalation engine correctly triggers on: user keywords, out_of_scope, low confidence, contradictions
- Session store creates/reads/writes/trims conversations in SQLite
- Confidence scorer computes weighted scores from chunks
- Full `/query` pipeline is wired: route → agent → citations → amendments → verification → confidence → escalation → session save

## What Needs Attention

### 1. Register missing routers in `main.py`

Two API routers (`validate` and `explain`) were created but NOT registered. Add to `main.py`:

```python
from api import health, query, confidence, delegate, validate, explain

# In the Register Routers section:
app.include_router(validate.router)
app.include_router(explain.router)
```

### 2. Create `.env` file

Copy `.env.example` and fill in:

```
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
KNOWLEDGE_SERVICE_URL=http://localhost:8100
HOST=0.0.0.0
PORT=8200
CONFIDENCE_THRESHOLD=0.4
DEFAULT_TOP_K=5
MAX_CONVERSATION_DEPTH=20
SESSION_TTL_HOURS=24
ENABLE_SELF_VERIFICATION=true
```

### 3. End-to-end testing

**NEVER been tested live** — need to:
1. Start Knowledge Service on port 8100 (or via Docker)
2. Ingest test documents (at least 1 original law + 1 amending law + 1 general doc)
3. Start Agent Service on port 8200
4. Test `POST /query` with real Arabic queries
5. Verify security (citizen can't see internal docs)
6. Verify amendment detection works
7. Test multi-turn sessions

### 4. Conversation history not yet passed to LLM prompts

The `conversation_history` field is loaded from SessionStore and set on `AgentContext`, but the specialist agents do NOT currently include it in their LLM prompts. To enable multi-turn awareness, each agent's `process()` method needs to include `context.conversation_history` in the prompt sent to Gemini.

### 5. Storage `__init__.py` is missing

Create an empty `storage/__init__.py` file (the SessionStore import works via direct module path but the package init is needed for clean imports).

---

## API Contracts

### POST /query
```json
// Request
{
  "query": "ما هي شروط التقاعد المبكر في الأردن؟",
  "user_type": "citizen",
  "session_id": "abc-123",
  "sector_hint": null,
  "language": "ar"
}

// Response
{
  "answer": "بحسب قانون الضمان الاجتماعي...",
  "confidence": 0.92,
  "citations": [
    {
      "source_name": "قانون الضمان الاجتماعي لسنة ٢٠١٤",
      "source_id": "b64d97a2",
      "page": 4,
      "document_year": "2014",
      "is_amendment": false,
      "relevance_score": 0.87
    }
  ],
  "agent_used": "legal_affairs",
  "sector": "labor",
  "has_amendments": true,
  "amendment_note": "تنبيه: هذا القانون تم تعديله...",
  "escalated": false,
  "escalation_reason": null,
  "session_id": "abc-123",
  "response_id": "a1b2c3d4"
}
```

### POST /delegate
```json
// Request
{"query": "...", "agent": "legal_affairs", "sector": "labor", "user_type": "citizen", "language": "ar"}

// Response
{"answer": "...", "agent_used": "legal_affairs", "sector": "labor", "citations": [...], "num_chunks": 5}
```

### GET /confidence/{response_id}
Returns confidence breakdown (score, chunk_support, avg_similarity, amendment_factor, sector_match).

### GET /explain_decision/{response_id}
Returns routing decision (intent, sector, agent, sub_questions) + confidence + amendments + verification issues.

### POST /validate
```json
// Request
{"answer": "...", "source_ids": ["abc123"], "query": "..."}
// Response
{"valid": true, "issues": [], "corrected_answer": null}
```

### GET /health
```json
{"status": "healthy", "service": "agent-service", "llm_model": "gemini-2.5-flash", "knowledge_service": "reachable"}
```

---

## Key Design Decisions

| Decision | Choice | Why |
|---|---|---|
| Agent framework | Raw `google-genai` function calling | Consistency with knowledge-service, transparency, no extra deps |
| Router | LLM-based (Gemini Flash) | Arabic morphology requires NLU; rule-based would be brittle |
| Agent pattern | Abstract base + dict registry | Simple, explicit, easy to extend |
| Security | Visibility mapping at tool layer | `citizen→public`, `employee→internal`, `admin→confidential` enforced on EVERY Knowledge Service call |
| Session storage | SQLite | Zero external deps, follows knowledge-service pattern |
| LLM init | Lazy (deferred) | App can import/start without API key set; fails at first LLM call |
| Self-verification | Configurable (`ENABLE_SELF_VERIFICATION`) | 3rd LLM call adds ~200ms; can disable for demos |

---

## Security Model (CRITICAL)

```
citizen  → visibility: "public"      → only public docs
employee → visibility: "internal"    → public + internal docs
admin    → visibility: "confidential" → all docs
```

This mapping is enforced in TWO places:
1. `core/tools.py:KnowledgeTools.search_knowledge()` — ALWAYS maps user_type to visibility
2. `core/agents/base.py:get_visibility()` — utility function used in AgentContext

The Knowledge Service also enforces visibility at SQL level (defense in depth).

**The `user_type` stored per session CANNOT be escalated mid-session** — the session store preserves the original `user_type`.

---

## Query Pipeline (14 steps in `api/query.py`)

```
1.  Early escalation check (user requesting human?)
2.  Router Agent → RoutingDecision (intent, sector, agent, delegation)
3.  Out-of-scope check
4.  Get specialist agent from AGENT_REGISTRY
5.  Load conversation history from SessionStore
5b. Build AgentContext
6.  Process: delegation engine OR single agent
7.  Extract citations from retrieved chunks
8.  Amendment check (cross-reference for superseded clauses)
9.  Self-verification (if enabled, LLM reviews answer)
10. Confidence scoring (weighted formula)
11. Escalation triggers check (low confidence, contradictions)
12. Cache response for /confidence and /explain endpoints
13. Save conversation to session
14. Build and return QueryResponse
```

---

## Confidence Scoring Formula

```
score = (0.25 × chunk_support) + (0.35 × avg_similarity) + (0.15 × amendment_factor) + (0.25 × sector_match)

chunk_support    = min(num_chunks / 3, 1.0)
avg_similarity   = average cosine similarity of top chunks
amendment_factor = 1.0 if no amendments, 0.7 if amendments exist
sector_match     = fraction of chunks matching routed sector

If verification found issues: score -= 0.15
Clamped to [0.0, 1.0]
```

---

## Escalation Triggers

| Type | Trigger | Behavior |
|---|---|---|
| `user_request` | Query contains keywords: "اريد موظف", "تحويل", "human" etc. | Immediate escalation before routing |
| `out_of_scope` | Router classifies intent as `out_of_scope` | Polite rejection message |
| `low_confidence` | Confidence < `CONFIDENCE_THRESHOLD` (default 0.4) | Answer returned with escalation flag |
| `contradiction` | Self-verification found issues | Answer returned with escalation flag |

---

## Dependencies

```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
google-genai>=1.0.0
pydantic>=2.0.0
python-dotenv>=1.0.0
requests>=2.31.0
httpx>=0.27.0
aiosqlite>=0.20.0
```

---

## How to Run

```bash
# 1. Navigate to agent service
cd Knowledge_Management/services/agent-service

# 2. Create .env (copy from .env.example, add GEMINI_API_KEY)
cp .env.example .env
# Edit .env with your key

# 3. Install deps
pip install -r requirements.txt

# 4. Make sure Knowledge Service is running on port 8100
# (In another terminal)
cd ../knowledge-service && python main.py

# 5. Start Agent Service
python main.py
# → Runs on http://localhost:8200

# 6. Test
curl http://localhost:8200/health
curl -X POST http://localhost:8200/query \
  -H "Content-Type: application/json" \
  -d '{"query": "ما هي شروط التقاعد المبكر في الأردن؟", "user_type": "citizen"}'
```

### Docker
```bash
cd Knowledge_Management/services/agent-service
docker compose up --build
# → Knowledge Service on :8100, Agent Service on :8200
```

---

## What Comes Next (Platform Milestones 3-5)

### Milestone 3: Governance Service (port 8300)
- Input guardrails (prompt injection detection)
- Output guardrails (hallucination check)
- Audit logging (every query/response)
- Evaluation framework

### Milestone 4: Workflow Service (port 8400)
- Ticket creation for escalated queries
- Human assignment + resolution workflow
- SLA tracking

### Milestone 5: Frontend App (React)
- Arabic-first chat interface
- Citation viewer + source panel
- Admin console

---

## Reference Documents

| Document | Path | Purpose |
|---|---|---|
| Agent Service Spec | `docs/agent_service_prompt.md` | Full requirements and API contracts |
| Platform Milestones | `docs/platform_milestones.md` | Roadmap and build order |
| Knowledge Engine Ref | `docs/knowledge_engine_complete.md` | Knowledge Service architecture |
| Knowledge Client SDK | `services/knowledge-service/client/knowledge_client.py` | Original client (base for our extended copy) |
| Classifier Pattern | `services/knowledge-service/core/classifier.py` | Pattern used for router (LLM + JSON + validation) |
| Knowledge Schemas | `services/knowledge-service/models/schemas.py` | RetrieveRequest shows all available filter params |

---

## 22 Valid Government Sectors

```
water, health, education, justice, labor, finance, energy, agriculture,
trade, environment, transport, digital, tourism, culture, youth,
investment, interior, planning, social_development, public_works,
foreign_affairs, general
```

## 4 Specialist Agents

```
legal_affairs       — Laws, regulations, instructions, legal provisions
public_services     — Service locations, procedures, fees, documents needed
policy_analysis     — Comparing regulations, timeline analysis, cross-sector
general_knowledge   — Fallback for everything else
```

## 5 Intent Categories

```
legal_inquiry       — Asking about a law or regulation
service_inquiry     — Asking about a government service
policy_comparison   — Comparing or analyzing policies
general_inquiry     — General government question
out_of_scope        — Not related to Jordanian government
```
