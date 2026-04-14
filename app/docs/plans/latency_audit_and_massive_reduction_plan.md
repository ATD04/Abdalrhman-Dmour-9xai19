# JNPI End-to-End Latency Audit and Massive Reduction Plan

Date: 2026-03-23
Scope audited: agent-service, knowledge-service, governance-service, workflow-service, runtime env flags
Goal: reduce median end-to-end response time from ~13-16s to ~4-6s (and p95 to <8s) without reducing answer quality for legal/public-policy queries.

---

## 1) Executive Summary

The current stack is functional, but latency is inflated by architectural duplication and extra synchronous remote calls in the critical path.

From the observed stream request ([4378aa61]):
- Total: 13.343s (internal timing), ~16s wall clock.
- Largest measured components:
  - routing: 2.957s
  - agent_process: 5.586s (retrieval 3.108s + generation 2.477s)
  - amendments: 3.125s

Major finding: request preprocessing work is duplicated in `api/query.py` and `core/agents/orchestrator.py`, causing repeated guardrail/routing costs.

If we remove duplicated steps and move expensive post-processing out of the synchronous path, we can likely cut latency by 50-70%.

---

## 2) How Estimates Were Built

Evidence sources:
- Runtime logs including `STREAMING TIMING` line from request [4378aa61].
- Code-path audit of these key files:
  - `app/services/agent-service/api/query.py`
  - `app/services/agent-service/core/agents/orchestrator.py`
  - `app/services/agent-service/core/router.py`
  - `app/services/agent-service/core/agents/*.py`
  - `app/services/agent-service/core/amendments.py`
  - `app/services/knowledge-service/core/retrieval.py`
  - `app/services/knowledge-service/core/embedding.py`
  - `app/services/knowledge-service/storage/vector_store.py`
  - `app/services/governance-service/core/input_guardrails.py`
  - `app/services/governance-service/core/output_guardrails.py`
  - `app/services/workflow-service/api/cases.py`

Timing model:
- “Measured”: from log line timings.
- “Estimated”: inferred from sequential sync calls and known network/model behavior.

---

## 3) Current Latency Budget (Per Request)

### 3.1 Observed sample budget (request [4378aa61])

| Stage | Time (s) | Notes |
|---|---:|---|
| Input guardrail | 0.014 | Rule-only path, cheap |
| Routing | 2.957 | LLM-based router call |
| Agent process | 5.586 | Includes retrieval + generation |
| Retrieval (inside agent process) | 3.108 | Embed query + vector search + metadata enrich |
| Generation (inside agent process) | 2.477 | LLM generation |
| Amendments | 3.125 | Extra retrieval lookups |
| Confidence + citations | ~0 | Lightweight |
| Total | 13.343 | Internal measured |

### 3.2 Estimated “hidden” time not explicitly broken out

| Hidden stage | Typical range (s) | Why it matters |
|---|---:|---|
| Resolved ticket lookup (`/cases/answered/match`) | 0.03 - 0.30 | Always done before routing in query adapter |
| No-answer semantic judge (LLM) | 0.8 - 2.5 | Triggered in orchestrator near end |
| Duplicate pre-processing in adapter + orchestrator | 1.5 - 4.0 | Same routing/guardrail logic runs twice in current structure |
| Retry/backoff penalty on transient model error | +1.0 / +3.0 / +7.0 | Due to sync retries + exponential sleep |

---

## 4) Full Critical-Path Audit

### 4.1 Agent service adapter duplicates orchestration concerns

In `api/query.py`:
- Performs input guardrail, escalation check, workflow answered-match lookup, routing.
- Then calls `orchestrator.process(...)`, which repeats input guardrail + routing + downstream pipeline.

In stream mode (`/query/stream`), same duplication pattern is present before `orchestrator.process_stream(...)`.

Impact:
- Repeated LLM router invocation and repeated governance checks.
- Adds seconds of avoidable latency.

Severity: Critical.

### 4.2 Expensive amendments step on synchronous response path

`core/amendments.py` does additional retrieval search(es) after main answer generation.
- For each original source, it may call `search_knowledge(...)` again.
- In sample, amendments alone was 3.125s.

Impact:
- Can be as expensive as initial retrieval in many queries.

Severity: Critical for latency.

### 4.3 No-answer semantic classifier uses extra LLM call

`OrchestratorAgent._is_no_answer_response(...)` invokes `llm.generate_json(...)` on each uncached response.
- This is post-generation but still before completion event.
- Not clearly represented as its own timing metric in output.

Impact:
- Adds ~1-2.5s commonly.

Severity: High.

### 4.4 Blocking sync calls inside async request handlers

Multiple async methods call sync clients directly:
- `agent-service/core/llm.py`: sync Gemini SDK methods inside async wrappers.
- `agent-service/client/knowledge_client.py`: `requests` calls from async request path.

Impact:
- Event loop blocking harms concurrency and tail latency under load.
- Even if single-request latency seems acceptable, p95/p99 will degrade sharply.

Severity: High.

### 4.5 Recreating HTTP clients per call

`GovernanceClient` and `WorkflowClient` use `async with httpx.AsyncClient(...)` for each call.
- No connection pooling reuse.

Impact:
- Adds handshake/setup overhead repeatedly.

Severity: Medium.

### 4.6 Router cost remains high in concise mode for non-rule hits

`RouterAgent` has fast keyword rules, but many real queries still route through LLM classification (~3s observed).

Impact:
- Large fixed cost before retrieval/generation.

Severity: High for concise mode UX.

### 4.7 Retrieval is healthy but still a large fixed chunk

Knowledge retrieval path (`embed -> vector search -> enrich`) is ~3s in sample.
- Includes remote embedding API call.
- If storage fallback is file-based, performance worsens significantly.

Severity: Medium to High depending on data volume and deployment mode.

---

## 5) Priority Optimization Backlog (Massive Reduction)

### P0: Do Immediately (highest ROI, lowest architecture risk)

1. Single owner for pipeline (adapter should be thin)
- Change: remove duplicated guardrail/routing/escalation pre-processing from `api/query.py`; let `orchestrator` be sole authority.
- Expected gain: 1.5-4.0s.
- Risk: low if response contracts are preserved.

2. Move amendments out of blocking path
- Change: in concise mode, make amendments optional async enrichment (or gated by explicit user request).
- Keep synchronous only for detailed mode/legal strict mode.
- Expected gain: 2.0-3.5s.
- Risk: medium (policy/legal UX expectations).

3. Gate no-answer LLM judge
- Change: run cheap heuristic first; only call LLM judge when confidence is low OR answer/chunk evidence is weak.
- Expected gain: 0.8-2.0s.
- Risk: medium (escalation precision).

4. Stop creating new HTTP clients for every governance/workflow call
- Change: persistent shared AsyncClient with keep-alive.
- Expected gain: 0.05-0.25s per remote call, plus lower p95.
- Risk: low.

5. Add explicit per-stage timing for hidden steps
- Change: add timings for `workflow_lookup`, `no_answer_judge`, and each amendment subquery.
- Expected gain: observability, no direct speedup.
- Risk: low.

### P1: Next Wave (concurrency/tail latency)

6. Remove event-loop blocking sync calls
- Change: use async-compatible clients where possible, or offload sync SDK calls to executor.
- Affected: agent LLM wrappers, knowledge client retrieval.
- Expected gain: major p95/p99 and throughput improvement; median may also improve under concurrent users.
- Risk: medium.

7. Smarter routing strategy for concise mode
- Change: expand deterministic/rule router; route to LLM only on ambiguity.
- Add query-shape classifier with confidence threshold.
- Expected gain: 1.0-2.5s on many requests.
- Risk: medium (misroutes if rules are weak).

8. Tighten concise token budgets
- Change: reduce concise max output from 2048 to 768-1024; keep detailed unchanged.
- Expected gain: 0.2-1.0s generation improvement and lower costs.
- Risk: low-medium (answer completeness).

### P2: Structural Improvements

9. Result cache for retrieval and answer skeleton
- Change: semantic cache keyed by normalized query + user role + sector + KB version hash.
- Expected gain: 2-8s on repeat traffic.
- Risk: medium (cache invalidation).

10. Precomputed amendment graph
- Change: build amendment relation index at ingest time to avoid runtime amendment retrieval loops.
- Expected gain: 1.0-3.0s for legal queries.
- Risk: medium-high (ingestion schema changes).

11. Hybrid retrieval strategy
- Change: lexical pre-filter before embedding call for clear statute references; embed only when needed.
- Expected gain: 0.5-2.0s for exact-law queries.
- Risk: medium.

---

## 6) Target State Latency Model

### 6.1 Current vs target (concise legal query)

| Stage | Current (s) | Target (s) | How |
|---|---:|---:|---|
| Input guardrail | 0.01-0.20 | 0.01-0.08 | keep rule-only default |
| Workflow lookup | 0.03-0.30 | 0.00-0.10 | conditional/parallelized |
| Routing | 1.5-3.0 | 0.1-1.0 | deterministic first, less LLM routing |
| Retrieval | 2.0-4.0 | 1.2-2.2 | cache + optimization + pooling |
| Generation | 1.8-3.5 | 1.2-2.2 | smaller concise budget + prompt shaping |
| Amendments | 2.0-4.0 | 0.0-0.8 | async/deferred/gated |
| No-answer judge | 0.8-2.5 | 0.0-0.5 | conditional only |
| Total | 10-17 | 4-7 | cumulative |

### 6.2 SLO proposal

- p50 total: <= 5.5s
- p95 total: <= 8.0s
- first token (stream): <= 1.5s for concise mode
- duplicate-stage budget violation alerts if same-stage call appears twice per request_id

---

## 7) Implementation Plan (Phased)

### Phase 1 (1-2 days): De-dup + instrumentation

Deliverables:
- Thin `api/query.py` adapter delegating to orchestrator only.
- Remove duplicate route/guardrail pass in streaming path.
- Add stage timings: `workflow_lookup`, `no_answer_judge`, `amendment_lookup_total`, `amendment_lookup_count`.

Success criteria:
- Immediate 20-35% median latency reduction.
- No behavior regressions in existing API responses.

### Phase 2 (2-4 days): Remove heavy synchronous blockers

Deliverables:
- Shared persistent AsyncClient instances.
- Non-blocking execution strategy for sync SDK calls.
- Conditional no-answer judge.
- Amendments deferred for concise mode.

Success criteria:
- Additional 25-40% reduction in median.
- p95 reduction visible under concurrent load.

### Phase 3 (1-2 weeks): Retrieval/cache architecture

Deliverables:
- Retrieval + response semantic cache with invalidation on knowledge version changes.
- Optional amendment graph precompute.
- Router confidence gate and expanded deterministic route map.

Success criteria:
- Stable p50 ~4-6s, p95 <8s.

---

## 8) Risk and Quality Controls

- Legal correctness risk (from amendment deferral):
  - Mitigation: keep detailed mode strict path fully synchronous.
  - Mitigation: mark answers with “amendment check pending” only when deferred.

- Routing correctness risk (from deterministic router):
  - Mitigation: fallback to LLM router on low confidence or unknown patterns.

- Escalation precision risk (from no-answer gating):
  - Mitigation: combine confidence threshold + low evidence checks before skipping LLM judge.

---

## 9) Concrete Next Actions (Recommended Order)

1. Refactor query adapters to remove duplicated guardrail/routing/orchestration logic.
2. Add hidden timing metrics and dashboard them by request_id.
3. Move amendment check out of concise critical path.
4. Gate no-answer LLM classifier by low-confidence/evidence only.
5. Introduce shared reusable AsyncClient instances.
6. Run load test before/after and publish p50/p95 deltas.

---

## 10) Appendix: Key Code Hotspots

- Adapter duplication:
  - `app/services/agent-service/api/query.py`
  - `app/services/agent-service/core/agents/orchestrator.py`

- Heavy post-processing:
  - `app/services/agent-service/core/amendments.py`
  - `app/services/agent-service/core/agents/orchestrator.py` (`_is_no_answer_response`)

- Blocking client patterns:
  - `app/services/agent-service/core/llm.py`
  - `app/services/agent-service/client/knowledge_client.py`

- Retrieval core:
  - `app/services/knowledge-service/core/retrieval.py`
  - `app/services/knowledge-service/core/embedding.py`

- Guardrails:
  - `app/services/governance-service/core/input_guardrails.py`
  - `app/services/governance-service/core/output_guardrails.py`

---

## 11) Optional Stretch Goal (If you want “massive” speed immediately)

Introduce a two-lane response mode:
- Lane A (fast preview, <=2s): deterministic routing + compact retrieval + short generation.
- Lane B (authoritative completion, <=6s): full checks, amendments, and confidence enrichment.

This preserves trust while drastically improving perceived responsiveness.
