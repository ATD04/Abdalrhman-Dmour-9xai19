# Agent Service — Full Audit Report

**Service:** `app/services/agent-service`
**Date:** April 5, 2026
**Auditor:** GitHub Copilot (Claude Sonnet 4.6)
**Branch:** `enhancing-+-analysis`

---

## Table of Contents

1. [Service Overview](#1-service-overview)
2. [Directory Structure](#2-directory-structure)
3. [Component Breakdown & Code Explanation](#3-component-breakdown--code-explanation)
4. [End-to-End Request Flow](#4-end-to-end-request-flow)
5. [Architecture Diagram (Text)](#5-architecture-diagram-text)
6. [Bottlenecks Identified](#6-bottlenecks-identified)
7. [Issues & Bugs](#7-issues--bugs)
8. [Security Observations](#8-security-observations)
9. [Code Quality Notes](#9-code-quality-notes)
10. [Summary & Recommendations](#10-summary--recommendations)

---

## 1. Service Overview

The **Agent Service** (`port 8200`) is the AI brain of the Jordan National Policy Intelligence Platform (JNPI). It exposes a streaming HTTP API that accepts natural language queries in Arabic or English, retrieves relevant policy/law documents from the Knowledge Service, and produces grounded answers with citations, confidence scores, escalation logic, and governance guardrails.

**Runtime mode:** `v2` (the only allowed runtime — enforced at startup). The active runtime is `UnifiedRAGAgent`, a single-model retrieval-augmented generation (RAG) pipeline that has replaced an earlier multi-agent orchestration model.

**Technology Stack:**
- Python 3.11 / FastAPI / Uvicorn
- Google Gemini API (`google-genai` SDK) — generation and embedding
- Redis — routing cache, retrieval cache, session state, rate limiting
- SQLite / Supabase Postgres — durable session storage (`storage/sessions.py`)
- httpx — async HTTP client to Knowledge Service and Governance Service
- Pydantic v2 — all request/response models

---

## 2. Directory Structure

```
agent-service/
├── main.py                  # FastAPI app factory, startup/shutdown hooks
├── config.py                # All configuration via env vars (50+ settings)
├── cache.py                 # Shared Redis client (singleton, fail-soft)
├── session_manager.py       # Redis-backed session read/write (TTL = 30 min)
│
├── api/                     # HTTP route handlers (thin adapters)
│   ├── query.py             # POST /query/stream — main entry point
│   ├── confidence.py        # GET /confidence/{id}
│   ├── delegate.py          # POST /delegate — internal specialist dispatch
│   ├── explain.py           # GET /explain_decision/{id}
│   ├── health.py            # GET /health
│   └── validate.py          # POST /validate
│
├── core/                    # All business logic
│   ├── llm.py               # GeminiClient — generate, stream, embed, JSON
│   ├── router.py            # RouterAgent — LLM-based semantic routing (unused in v2)
│   ├── tools.py             # KnowledgeTools — retrieval + caching layer
│   ├── citations.py         # CitationExtractor — chunk → Citation objects
│   ├── confidence.py        # ConfidenceScorer — weighted multi-signal score
│   ├── review.py            # SemanticReviewEngine — post-answer LLM quality check
│   ├── escalation.py        # EscalationEngine — rule-based escalation decisions
│   ├── amendments.py        # AmendmentChecker — detect superseded citations
│   ├── verification.py      # SelfVerifier — LLM contradiction check
│   ├── delegation.py        # DelegationEngine — fan-out to multiple agents
│   └── agents/
│       ├── base.py          # AgentContext, AgentResult, OrchestratorResult, BaseAgent
│       ├── unified_rag.py   # UnifiedRAGAgent — ACTIVE RUNTIME (v2)
│       ├── orchestrator_v2.py # run_post_generation_pipeline + OrchestratorAgentV2
│       ├── orchestrator.py  # Legacy Father orchestrator (unused in v2)
│       ├── orchestrator_fastpath.py  # Legacy fast-path (unused in v2)
│       ├── general_knowledge.py  # Specialist agents (registered but unused in v2)
│       ├── legal_affairs.py
│       ├── ministry_agents.py
│       ├── policy_analysis.py
│       ├── public_services.py
│       └── ...
│
├── client/                  # External service SDK wrappers
│   ├── knowledge_client.py  # HTTP client to Knowledge Service (port 8100)
│   ├── governance_client.py # HTTP client to Governance Service (port 8300)
│   └── workflow_client.py   # HTTP client to Workflow Service (port 8400)
│
├── models/
│   └── schemas.py           # All Pydantic models: QueryRequest, QueryResponse, etc.
│
├── prompts/                 # Prompt templates for each agent/stage
│   ├── unified_rag_prompt.py
│   ├── router_prompt.py
│   ├── verification_prompt.py
│   └── ...
│
├── storage/
│   └── sessions.py          # SQLite/Postgres durable session store (unused by default)
│
├── static/                  # Embedded React/HTML test UI
├── data/                    # SQLite database file location
├── tests/                   # Unit tests for semantic retrieval
└── scripts/                 # Empty (placeholder)
```

---

## 3. Component Breakdown & Code Explanation

### 3.1 `main.py` — Application Bootstrap

- Creates the FastAPI app and registers all routers.
- On startup: validates `ORCHESTRATOR_RUNTIME == "v2"` (hard-fail otherwise), initialises the shared `httpx.AsyncClient` for the Knowledge Service, and optionally pre-warms the router.
- On shutdown: closes all shared HTTP clients.
- CORS is set to `allow_origins=["*"]` — intentional for development, flagged below.
- Mounts a static UI at `/`.

---

### 3.2 `config.py` — Configuration

Over **50 environment variables** loaded from three layers:
1. Docker Compose runtime env (always wins)
2. `agent-service/.env` (local dev)
3. `.env.shared` (platform-wide defaults)

Key settings include model names, service URLs, confidence threshold (default `0.4`), token budgets, TTLs, feature flags for every optional pipeline stage, and semantic review thresholds.

**Notable config flags:**
| Flag | Default | Effect |
|---|---|---|
| `ORCHESTRATOR_RUNTIME` | `v2` | Only `v2` allowed |
| `ENABLE_ROUTER_EMBEDDING_FAST_PATH` | `true` | Skip LLM routing if embedding score ≥ 0.88 |
| `ENABLE_V2_OUTPUT_GUARDRAIL` | `true` | Run post-generation governance check |
| `ENABLE_LLM_SEMANTIC_REVIEW_IN_CONCISE` | `false` | LLM review disabled in fast mode |
| `ENABLE_V2_AMENDMENT_LOOKUP` | `false` | Amendment lookup disabled by default |
| `CONFIDENCE_THRESHOLD` | `0.4` | Below this → escalation |
| `CONCISE_MAX_OUTPUT_TOKENS` | `768` | Token budget for concise mode |
| `DETAILED_MAX_OUTPUT_TOKENS` | `8192` | Token budget for detailed mode |

---

### 3.3 `api/query.py` — Main HTTP Adapter

The **only active entry-point** for query processing is `POST /query/stream`. The legacy `POST /query` returns HTTP `410 Gone`.

This module handles:
- **Rate limiting** via Redis (`30 req/min per IP`). Falls back to allowing all if Redis is down.
- **Session ID assignment** (generated if not provided).
- **Pending escalation confirmation** — an in-process `dict` (`_pending_no_answer_escalations`) tracks sessions that need user confirmation before creating a workflow ticket.
- **Streaming SSE** — wraps the `UnifiedRAGAgent.process_stream()` async generator into Server-Sent Events.
- **Session history** — saves turns (last 10 messages) to Redis after each non-escalated response.
- **Response cache** — stores confidence/routing data in `api/confidence.response_cache` (an in-process Python dict) for the `/confidence/{id}` endpoint.
- **Background audit log** — dispatches audit to Governance Service via FastAPI `BackgroundTasks`.

---

### 3.4 `core/agents/unified_rag.py` — Active Runtime (UnifiedRAGAgent)

This is the primary intelligence of the service. It executes a linear pipeline:

```
1. Input Guardrail    → governance_client.check_input()       [cached for concise]
2. Human Handoff?     → keyword/regex heuristic               [immediate exit]
3. Build Retrieval Query → expand query with history context
4. Embed Query        → gemini-embedding-2-preview             [cached per query]
5. Answered Match?    → workflow_client.answered_match()       [non-blocking in stream]
6. Retrieve Chunks    → KnowledgeTools.search_knowledge_async() [Redis cached]
7. Generate Answer    → LLM streaming (Gemini)
8. Completion Retry?  → if stream appears truncated
9. Extractive Fallback? → if still incomplete after retry
10. Stabilise Tail    → clean trailing artefacts
11. Output Guardrail  → governance_client.check_output()       [if ENABLE_V2_OUTPUT_GUARDRAIL]
12. Post-Generation Pipeline (parallel):
    ├── citations     → CitationExtractor
    ├── amendments    → AmendmentChecker
    ├── review        → SemanticReviewEngine
    └── (sequential) confidence → ConfidenceScorer
                     escalation → EscalationEngine
13. Yield: complete event + escalation confirmation check
```

---

### 3.5 `core/agents/orchestrator_v2.py` — Post-Generation Pipeline

`run_post_generation_pipeline()` runs **citations, amendments, and review** in parallel using `asyncio.gather`, then runs **confidence** and **escalation** sequentially (because each depends on the prior result).

A configurable `timeout_seconds` gates the entire parallel block. After timeout, partial results are used and cancelled tasks are collected automatically.

`_critical_path_bottleneck_flags()` identifies which post-gen stage is the slowest on each request — logged for observability.

---

### 3.6 `core/llm.py` — GeminiClient

Wraps the `google-genai` SDK:
- `generate()` — blocking call wrapped in `asyncio.to_thread()` with exponential-backoff retry (3 attempts, 2^n sleep).
- `generate_stream()` — sync iterator run in a `ThreadPoolExecutor` thread that feeds chunks into an `asyncio.Queue`, consumed by the async generator caller.
- `generate_json()` — structured output using Gemini's native JSON schema enforcement.
- `embed()` — single vector embedding.
- `embed_batch()` — batch embeddings.

The streaming implementation uses a thread + queue bridge pattern because `google-genai` does not expose a native async streaming API.

---

### 3.7 `core/router.py` — RouterAgent (present but bypassed)

Implements full semantic LLM-based routing with:
- Redis cache (4-hour TTL) keyed on query + user_type + sector_hint + embedding fingerprint.
- Embedding fast-path (cosine similarity to agent profile embeddings, score ≥ 0.88).
- Heuristic keyword-prior fallback.
- Deterministic forced routing when `ROUTER_EXECUTION_MODE = "deterministic"`.

**In the current v2 runtime this router is never called.** `UnifiedRAGAgent` bypasses it entirely and always uses `"general"` sector with no scope filters.

---

### 3.8 `core/tools.py` — KnowledgeTools

The retrieval abstraction layer:
- Enforces `user_type → visibility` mapping (`citizen → public`, `employee → internal`, `admin → confidential`).
- Redis cache for search results (keyed on query + filters + embedding fingerprint).
- `_semantic_rank_chunks()`, `_evidence_concentration()`, `_mean_top_score()`, `_prefer_text_chunks()` — helper methods for chunk quality analysis.
- Provides both sync `search_knowledge()` and async `search_knowledge_async()` variants.
- When `ENFORCE_STRICT_SCOPE_FILTERS = false` (default), sector and ministry filters are **not applied**, meaning every query hits all documents regardless of sector.

---

### 3.9 `core/confidence.py` — ConfidenceScorer

Multi-signal weighted scoring:

| Signal | Weight |
|---|---|
| Evidence quality (avg similarity + chunk count) | 45% |
| Evidence concentration (top-1 / top-4 ratio) | 15% |
| Metadata alignment (sector match fraction) | 20% |
| Routing confidence | 10% |
| Review outcome | 10% |

Hard caps: `weak` support → max `0.39`, `unsupported` → max `0.25`, `0 chunks` → max `0.25`. Severe sector mismatch multiplies by `0.65`.

---

### 3.10 `core/review.py` — SemanticReviewEngine

Post-answer LLM quality review using `generate_json()` with structured output schema. Outputs:
- `status`: passed / warning / corrected / escalate
- `support_quality`: strong / moderate / weak / unsupported
- `contradiction_risk`: 0–1
- `no_answer`, `escalation_recommended`, `issues`, `review_warning`, `correction`, `confidence_penalty`

In concise mode, `use_llm=false` by default (falls back to heuristic rule check using chunk count and verification issues).

---

### 3.11 `core/escalation.py` — EscalationEngine

Pure rule-based, sequentially checks:
1. `wants_human_handoff` → escalate
2. `intent == "out_of_scope"` → escalate
3. `review.no_answer` → escalate
4. `review.contradiction_risk >= 0.8` → escalate
5. `review.escalation_recommended` → escalate
6. `confidence < threshold (0.4)` → escalate

Escalation triggers a "pending confirmation" flow — the answer is returned to the user first, and a workflow ticket is only created after the user confirms.

---

### 3.12 `core/amendments.py` — AmendmentChecker

Detects if returned citations are superseded by amendments:
1. First checks if any retrieved chunks are already amendment documents.
2. If not, and if `allow_lookup=True`, makes additional Knowledge Service calls per original source.
3. Each additional lookup is a full semantic search against the citation's source name — not a direct relationship lookup.

**Note:** `ENABLE_V2_AMENDMENT_LOOKUP` defaults to `false`, disabling step 2.

---

### 3.13 `client/` — External Clients

- **`KnowledgeClient`**: Stateful singleton `httpx.AsyncClient` (100 connections, 20 keepalive). Handles `/ingest`, `/retrieve`, `/sources` endpoints. Timeout: configurable (default 300s).
- **`GovernanceClient`**: Per-instance `httpx.AsyncClient`. Timeout: 5 seconds. Graceful degradation — returns `passed=True` if unreachable.
- **`WorkflowClient`**: Handles answered-match lookups and ticket creation. Timeout: 350ms for lookups.

---

### 3.14 `session_manager.py` vs `storage/sessions.py`

There are **two separate session persistence mechanisms**:

| Module | Backend | TTL | Used By |
|---|---|---|---|
| `session_manager.py` | Redis | 30 min | `api/query.py` (active) |
| `storage/sessions.py` | SQLite or Postgres | 24 hr | Not called anywhere in the active path |

`storage/sessions.py` (`SessionStore`) is fully implemented but **dead code** — it is never instantiated in `main.py` or any API route.

---

## 4. End-to-End Request Flow

```
Client → POST /query/stream
           │
           ├─ Rate limit check (Redis 30r/60s)
           ├─ Assign response_id + session_id
           ├─ Yield SSE: metadata event
           │
           ├─ Pending escalation confirmation? ────────────────→ handle confirm/decline → return
           │
           ├─ Load session history from Redis
           │
           └─ UnifiedRAGAgent.process_stream()
                  │
                  ├─ 1. Input guardrail (GovernanceClient.check_input)
                  │       └─ Blocked? → yield chunk + complete → return
                  │
                  ├─ 2. Human handoff heuristic check
                  │       └─ Match? → yield chunk + complete → return
                  │
                  ├─ 3. Build retrieval query (history rewriting)
                  ├─ 4. Embed query (Gemini embedding model, cached)
                  ├─ 5. Check workflow answered-match (WorkflowClient, non-blocking)
                  │       └─ Match? → yield resolved answer → return
                  │
                  ├─ 6. Retrieve chunks (KnowledgeTools → KnowledgeClient, Redis cached)
                  │
                  ├─ 7. Build prompt + stream Gemini LLM
                  │       └─ yield "chunk" events as tokens arrive
                  │
                  ├─ 8. Completion retry (if stream looks truncated)
                  ├─ 9. Extractive fallback (if still incomplete)
                  ├─ 10. Stabilise answer tail
                  ├─ 11. Output guardrail (GovernanceClient.check_output)
                  │
                  └─ 12. run_post_generation_pipeline() [asyncio, parallel]
                              ├─ (parallel) citations extraction
                              ├─ (parallel) amendment check
                              ├─ (parallel) semantic review (LLM in detailed, heuristic in concise)
                              ├─ (sequential) confidence scoring
                              └─ (sequential) escalation evaluation
                                    │
                                    ├─ review_warning? → yield "review_warning" event
                                    └─ yield "complete" event (full metadata)
           │
           ├─ Save session history to Redis (if not escalation required)
           ├─ Cache response metadata (in-process dict)
           └─ Background: dispatch audit log to GovernanceClient
```

---

## 5. Architecture Diagram (Text)

```
┌────────────────────────────────────────────────────────────────┐
│                         Agent Service                          │
│                         (port 8200)                            │
│                                                                │
│  FastAPI ──── /query/stream ──── UnifiedRAGAgent               │
│                │                      │                        │
│                │       ┌──────────────┼──────────────┐         │
│                │       ▼              ▼               ▼        │
│                │  GeminiClient   KnowledgeTools   In-Process   │
│                │  (embeddings,   (retrieval,      Cache        │
│                │   generation,   Redis cache)     (dicts)      │
│                │   streaming)                                  │
│                │                                               │
│                │    Post-Gen Pipeline (parallel)               │
│                │    ┌──────────────────────────────┐           │
│                │    │ citations │ amendments │ review│          │
│                │    │    → confidence → escalation  │           │
│                │    └──────────────────────────────┘           │
└────────────────────────────────────────────────────────────────┘
         │                     │                     │
         ▼                     ▼                     ▼
Knowledge Service       Governance Service     Workflow Service
  (port 8100)             (port 8300)            (port 8400)
  Retrieval API           Guardrail +            Ticket creation +
  Embeddings              Audit log              Answered-match
```

---

## 6. Bottlenecks Identified

### B-1. **Double Embedding Per Request** (Critical)
In `process_stream()`, when the retrieval query is rewritten (history expansion), `_embed_query()` is called **twice** — once for the original query and once for the retrieval query. Both calls hit the Gemini API synchronously (via `asyncio.to_thread`). The embedding model is remote and has variable latency (~100–400ms each). This adds up to ~800ms extra latency on multi-turn conversations.

**Location:** `core/agents/unified_rag.py` lines ~336–346 (process_stream) and mirrored in `process()`.

---

### B-2. **Post-Generation Pipeline Adds Latency After Stream Ends** (High Impact)
The entire post-generation pipeline (`citations`, `amendments`, `review`, `confidence`, `escalation`) runs **after** the last answer token is streamed. In detailed mode, the timeout is 4 seconds; in concise mode, 1.2 seconds. During this window, the client is waiting for the `complete` event. In practice:
- `review` in detailed mode is an LLM call (384 tokens) — can be 1–3 seconds alone.
- `amendments` performs additional Knowledge Service lookups per citation source.
- The `complete` event is held until all stages finish or timeout.

Users experience a **visible pause** (1–4s) at the end of every streamed response.

---

### B-3. **In-Process `_pending_no_answer_escalations` Dict** (Scalability)
The pending escalation state lives in a **module-level Python dict** in `api/query.py`. This is process-local — it is lost on any pod restart, and it does not work in a multi-replica deployment. With more than one Uvicorn worker or more than one container, the user's confirmation message will hit a different instance and the escalation will not be found.

**Location:** `api/query.py`, `_pending_no_answer_escalations: dict[str, dict] = {}`.

---

### B-4. **RouterAgent Is Imported and Instantiated But Never Used** (Dead Code + Startup Cost)
`OrchestratorAgentV2` (in `orchestrator_v2.py`) instantiates `RouterAgent`, `CitationExtractor`, `ConfidenceScorer`, `AmendmentChecker`, `SelfVerifier`, and `SemanticReviewEngine` in its `__init__`. However, `OrchestratorAgentV2` itself is **never instantiated** — only `UnifiedRAGAgent` is. But the module is still imported by `unified_rag.py` at the top level for `run_post_generation_pipeline`. This means the router is never started, but the import chain still pulls in the entire router module on every cold start.

---

### B-5. **Redis Cache Not Used for Output Guardrail** (Latency)
The input guardrail result is cached in `_input_guardrail_cache` (in-process dict, TTL 60s). The output guardrail is called via `GovernanceClient.check_output()` on **every single request** with no caching, even for near-identical answers. The GovernanceClient timeout is 5 seconds — any slowness here stalls the complete event.

---

### B-6. **Amendment Lookup Sequential Per Source** (Latency on Detailed Mode)
In `AmendmentChecker.check()`, when `allow_lookup=True`, the code iterates over `original_sources` and awaits each `_find_amendments_for()` call **sequentially** in a `for` loop. If a detailed response cites 3 sources, this is 3 sequential Knowledge Service calls before the `complete` event can be sent.

**Location:** `core/amendments.py` lines ~80–96.

---

### B-7. **No Retry or Backoff in KnowledgeClient** (Reliability)
`KnowledgeClient.retrieve()` makes a single `resp.raise_for_status()` call with no retry logic. A transient 503 or network blip from the Knowledge Service will immediately fail the entire retrieval and return an empty chunk list, causing the LLM to produce a "no evidence" fallback answer.

---

### B-8. **`asyncio.to_thread` Wrapping a Blocking Sync Call for Every LLM Generation** (Thread Contention)
All non-streaming LLM calls in `GeminiClient.generate()` use `await asyncio.to_thread(self.client.models.generate_content, ...)`. Under concurrent load, this saturates the default thread pool (`min(32, os.cpu_count() + 4)` threads). At high QPS the event loop will queue tasks waiting for thread availability, adding hidden queuing latency.

---

### B-9. **Response Cache (`response_cache`) Is an Unbounded In-Process Dict** (Memory Leak)
`api/confidence.py` defines `response_cache: dict[str, dict] = {}` which is populated by `api/query.py` for every response. This dict is **never evicted** and **never expired**. In long-running deployments it will grow unboundedly. It is also not shared across workers/replicas, making `/confidence/{id}` unreliable in multi-instance deployments.

---

### B-10. **Embedding Cache in UnifiedRAGAgent Is Per-Instance, Non-Persistent** (Effectiveness)
`_embedding_cache`, `_input_guardrail_cache`, `_output_guardrail_cache`, `_workflow_answered_match_cache` are all Python dicts on the `UnifiedRAGAgent` instance. Their TTL is checked against `time.time()` on each access. But on container restart, all cached data is lost. Redis is used for routing and retrieval caches but NOT for these per-request in-process caches. The benefit is limited to repeated calls within a single process lifetime.

---

## 7. Issues & Bugs

### I-1. **Session Storage Is Split Between Two Implementations With No Reconciliation** (Bug / Confusion)
`session_manager.py` (Redis, 30-minute TTL) is the active session layer. `storage/sessions.py` (`SessionStore`, SQLite/Postgres, 24-hour TTL) is fully implemented but never used — no code calls `SessionStore.get_session()` or `SessionStore.save_session()`. The intent was likely to provide durable persistence for cross-session memory, but only the volatile Redis layer is wired up. Sessions are lost at 30-minute idle timeout with no recovery.

---

### I-2. **`CONCISE_EVIDENCE_CHAR_LIMIT = 0` Sends Full Text to LLM Every Time**
Both `CONCISE_EVIDENCE_CHAR_LIMIT` and `DETAILED_EVIDENCE_CHAR_LIMIT` default to `0` (meaning no truncation). In `_format_evidence()`, full chunk text is included in the prompt. For a detailed query with 8 chunks of multi-page documents, this can push the prompt to 100,000+ characters, significantly increasing Gemini API cost and latency.

---

### I-3. **`SelfVerifier` Is Instantiated in OrchestratorAgentV2 But `ENABLE_SELF_VERIFICATION` Defaults to False**
`SelfVerifier` adds another LLM call. It exists in `orchestrator_v2.py` as `self.self_verifier`, but `ENABLE_SELF_VERIFICATION = false` (default) means it is never called. The class, import, and instance exist purely as dead weight in the active path.

---

### I-4. **`typo in config.py`: `databse_url`**
```python
DATABASE_URL = os.getenv("DATABASE_URL", os.getenv("databse_url", ""))
```
The fallback env var is `databse_url` (misspelling of `database_url`). This is intentional (preserved for backward compatibility with a typo in a deployed `.env`), but the comment should document this explicitly, as it is a source of confusion.

---

### I-5. **`OrchestratorAgentV2` Has Methods That Reference Unused Son Agents**
`_dispatch_single_son()` and `_dispatch_multiple_sons()` in `orchestrator_v2.py` reference `SON_REGISTRY` which is distinct from `AGENT_REGISTRY`. The registry wiring is inconsistent — the same agents appear in multiple registries, and it is no longer clear which registry is authoritative. This is a maintenance hazard.

---

### I-6. **`_pending_no_answer_escalations` Has No Maximum Size**
The dict grows unboundedly — one entry per session that triggered a no-answer escalation. If users abandon sessions without confirming, these entries accumulate. There is no cleanup on session expiry or scheduled purge.

---

### I-7. **`GeminiClient.generate_stream()` Uses `loop.call_soon_threadsafe` Without Loop Lifetime Management**
The captured `loop = asyncio.get_event_loop()` reference is stored at call time and passed to the thread. If the event loop is replaced or the call outlives its originating task, the `call_soon_threadsafe` calls will silently drop or raise. This is an async correctness issue in high-concurrency scenarios.

---

### I-8. **`WorkflowClient` Timeout (350ms) Is Very Tight**
`WORKFLOW_LOOKUP_TIMEOUT_MS = 350` ms is aggressively short for an inter-service HTTP call, especially in a Docker network under load. A transient spike will cause answered-match to silently fail (no retry), meaning a previously resolved ticket's answer will not be served from cache — forcing a full RAG generation instead.

---

### I-9. **`_build_retrieval_query` Rewriting Is Done Even When History Is Empty**
`_build_retrieval_query()` in `unified_rag.py` appears to always process the conversation history to rewrite the query. If history is empty (first message), this still calls `_normalize_query_for_cache` comparison, but the path diverges. The check `if self._normalize_query_for_cache(retrieval_query) != self._normalize_query_for_cache(request.query)` conditionally re-embeds — checking this condition requires normalization on both strings every request, a minor repeated cost.

---

### I-10. **No Input Length Validation on `request.query`**
`QueryRequest.query` in `schemas.py` has no `max_length` constraint. An adversarial client can submit a 100,000-character query, which would be embedded (one embedding call), then prepended to the full evidence in the prompt, exhausting Gemini context limits and causing a confusing API error rather than a clean 422 validation error.

---

## 8. Security Observations

### S-1. **CORS Allows All Origins** (Medium)
```python
CORSMiddleware(allow_origins=["*"], allow_credentials=True, ...)
```
`allow_credentials=True` combined with `allow_origins=["*"]` violates the CORS spec and will be rejected by browsers for credentialed requests. More importantly, in production this should be locked to specific frontend origins.

### S-2. **Rate Limiting Falls Back to Unrestricted on Redis Failure** (Medium)
`check_rate_limit()` returns `True` (allow) when Redis is unavailable. This is correct for availability but means a Redis outage removes all rate limiting, leaving the Gemini API (and its cost) unprotected.

### S-3. **`response_id` and `session_id` Are Short UUIDs** (Low)
`response_id = str(uuid.uuid4())[:8]` — 8 hex characters = 4 bytes = ~4 billion possibilities. Under brute-force enumeration, an attacker could guess a valid `response_id` and read another user's confidence/routing data from the response cache. The response cache does not contain sensitive PII but does leak the query intent and confidence score.

### S-4. **Audit Log Sent as Best-Effort Background Task** (Low/Accepted)
The audit log to Governance Service is fire-and-forget via `BackgroundTasks`. If the service shuts down or the task fails, the audit record is silently lost. For a government platform with compliance requirements, this should be persisted locally first (write-ahead log pattern) and retried.

### S-5. **`user_type` Is Client-Supplied With No Authentication** (High Concern)
The `user_type` field in `QueryRequest` determines visibility level (`citizen → public`, `employee → internal`, `admin → confidential`). It is set by the client with no authentication token validation in this service. The service trusts the frontend/gateway to pass the correct `user_type`. If this service is ever exposed directly (e.g. in a misconfigured Docker Compose without the gateway), any client can claim `user_type: "admin"` and retrieve confidential documents.

---

## 9. Code Quality Notes

### Q-1. **Massive Code Duplication: `process()` and `process_stream()`**
`UnifiedRAGAgent` contains two methods — `process()` and `process_stream()` — that share ~80% of their logic (guardrail checks, handoff detection, query rewriting, embedding, retrieval, post-gen pipeline). They differ only in how they emit output (return vs. yield). This duplication means any bug fix or feature change must be applied in two places.

### Q-2. **53 Feature Flags in `config.py`**
The service has accumulated over 50 boolean feature flags. Many control mutually exclusive paths that coexist as dead code (e.g. `ENABLE_SINGLE_MODEL_RAG`, `V2_SINGLE_AGENT_ONLY`, `ORCHESTRATOR_RUNTIME`). This makes it very difficult to reason about the active execution path without reading all flags simultaneously.

### Q-3. **Legacy Code Not Removed After v2 Migration**
`orchestrator.py`, `orchestrator_fastpath.py`, specialist agents (`general_knowledge.py`, `legal_affairs.py`, `ministry_agents.py`, etc.), `DelegationEngine` (`delegation.py`), and the `RouterAgent` are all dead code in the current v2 runtime. They add ~2,000+ lines to the codebase, confuse new readers, and silently import on startup.

### Q-4. **`getattr(config, "SETTING", default)` Pattern Throughout**
Multiple places use `getattr(config, "ENABLE_V2_AMENDMENT_LOOKUP", False)` instead of accessing `config.ENABLE_V2_AMENDMENT_LOOKUP` directly. This is a workaround that hints at a historical fragility where config variables were not consistently defined. All values exist in config now, so this should be cleaned up.

### Q-5. **Inconsistent Error Handling Philosophy**
Some errors are silently swallowed (Redis errors, governance errors), some cause full failures (LLM API errors in verify), and some produce fallback answers. There is no central error taxonomy or decision log explaining which failures are fatal vs. degraded.

---

## 10. Summary & Recommendations

### Priority Matrix

| Severity | Issue | Fix Effort |
|---|---|---|
| 🔴 Critical | B-3: In-process escalation dict (multi-replica broken) | Medium |
| 🔴 Critical | S-5: `user_type` not authenticated | Medium |
| 🔴 High | B-9: Unbounded `response_cache` dict (memory leak) | Low |
| 🔴 High | I-6: Unbounded `_pending_no_answer_escalations` | Low |
| 🟠 High | B-1: Double embedding on history rewrite | Low |
| 🟠 High | B-2: Post-gen pipeline stalls `complete` event | Medium |
| 🟠 High | I-1: Dead session store (`storage/sessions.py`) | Low (remove or wire up) |
| 🟠 High | I-10: No query length validation | Low |
| 🟡 Medium | B-5: No caching for output guardrail | Low |
| 🟡 Medium | B-6: Sequential amendment lookups | Low (parallelize) |
| 🟡 Medium | B-7: No retry in KnowledgeClient | Low |
| 🟡 Medium | S-1: CORS wildcard in production | Low |
| 🟡 Medium | S-2: Rate limit disabled when Redis is down | Medium |
| 🟡 Medium | S-3: Short response IDs in cache | Low |
| 🟢 Low | Q-1: Duplication between process/process_stream | High (refactor) |
| 🟢 Low | Q-3: Dead legacy agent code | Low (delete) |
| 🟢 Low | Q-2: 53 feature flags | High (cleanup) |
| 🟢 Low | I-4: Typo `databse_url` | Trivial (document) |

---

### Top Recommendations

1. **Move `_pending_no_answer_escalations` to Redis** with a TTL equal to `SESSION_TTL`. Use `r.setex(f"pending_escalation:{session_id}", TTL, json.dumps(payload))`. This is a one-hour fix with immediate multi-replica correctness.

2. **Move `response_cache` to Redis** with a 1-hour TTL. Same pattern as above. This also fixes `/confidence/{id}` in multi-instance deployments.

3. **Add `max_length=4096` to `QueryRequest.query`** in `schemas.py`. One-line fix that prevents unbounded prompt injection and runaway API costs.

4. **Parallelize amendment lookups** in `AmendmentChecker.check()` using `asyncio.gather(*[self._find_amendments_for(...) for ...])`. The current sequential loop is unnecessary.

5. **Remove or deactivate legacy agent files** (`orchestrator.py`, `orchestrator_fastpath.py`, all specialist agent modules) once the team confirms v2 is permanent. This reduces cognitive overhead and import time.

6. **Wire `SessionStore`** (the durable SQLite/Postgres layer) alongside Redis for long-term session persistence, or clearly remove it if it is not needed. The split between two session implementations is a source of future bugs.

7. **Add `max_length` constraint to `CORS allow_origins`** in production deployment (env-var driven list of permitted origins).

8. **Consider starting the post-generation pipeline concurrently with the LLM stream** (start citations/review as non-blocking background tasks while streaming, finalize before the `complete` event). This can hide 1–2 seconds of post-gen latency inside the generation window.

---

*End of Report*
