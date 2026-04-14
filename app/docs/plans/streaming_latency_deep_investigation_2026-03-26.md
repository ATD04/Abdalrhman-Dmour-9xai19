# Streaming Latency Deep Investigation (10s Case)

Date: 2026-03-26
Scope: agent-service, knowledge-service, workflow-service
Incident context: streamed legal query completed in about 9.5-10.0s for first full answer.

Implementation status (2026-03-26):

- Completed: Phase A items 1-4.
- Completed: Phase B item 5 (retrieval/fallback stage timing instrumentation).
- Implemented as feature flag: Phase C item 7 via `ENABLE_CONCISE_QUICK_COMPLETE`.
- Remaining: Phase B item 6 (deep connection pooling in workflow-service and knowledge-service internals).

---

## 1) Problem Statement

For a real user query (Arabic constitutional/legal question), the system streamed correctly but total time to complete response was about 10 seconds. This is too high for target UX in concise mode.

Observed timing from orchestrator log:

- total: 9.465s
- input_guardrail: 0.004s
- workflow_lookup: 1.968s
- agent_process: 5.846s
- retrieval: 3.005s
- generation: 2.841s
- no_answer_judge: 1.645s

This document explains where the time is spent, why it happens for this request shape, and how to reduce it with a staged plan.

---

## 2) Evidence Trail (What Happened in This Request)

### 2.1 Request path from logs

1. Input guardrail call completed quickly.
2. Workflow answered-case lookup call took about 2.0s.
3. Router fast-routed to legal_affairs with sector=justice.
4. First retrieval pass returned 0 chunks with sector=justice.
5. Fallback retrieval pass (without sector) returned 5 chunks.
6. LLM stream generation finished in about 2.8s.
7. A second Gemini call happened after generation for no-answer semantic judge.
8. Final complete event sent at about 9.5s total.

### 2.2 Key code-level confirmations

- Workflow lookup is always called before routing in orchestrator:
  - app/services/agent-service/core/agents/orchestrator.py
- Sector-filtered retrieval fallback exists and can trigger a second retrieve call:
  - app/services/agent-service/core/tools.py
- Fast legal routing defaults to justice when sector is general:
  - app/services/agent-service/core/router.py
- No-answer semantic judge performs an additional LLM call when gated conditions are met:
  - app/services/agent-service/core/agents/orchestrator.py
- Query embedding in retrieval is remote (Gemini embed API), usually dominating retrieval wall time:
  - app/services/knowledge-service/core/embedding.py

---

## 3) Root Cause Analysis

## RC1: Extra workflow lookup latency on critical path (~2.0s)

The answered-case lookup is called for every request before retrieval/generation. In this trace, it consumed about 1.97s even though no reusable answer was returned.

Likely reasons:

- Network and database roundtrip to workflow-service for every query.
- Workflow storage path opens DB connections per call (no long-lived pool pattern in current implementation).
- No request-level cache for negative lookup results in orchestrator.

Impact in this trace: high.

## RC2: Retrieval did two passes because of sector mismatch (~3.0s total)

Router chose legal_affairs and sector=justice for a constitutional question. First retrieval pass (sector constrained) returned no chunks, then a fallback unfiltered pass ran.

Why this matters:

- Each pass invokes query embedding and vector search path.
- Even when second pass succeeds, first pass adds avoidable overhead.

Impact in this trace: very high.

## RC3: Post-answer no-answer judge adds another model call (~1.65s)

After main answer generation, orchestrator runs semantic no-answer classification when confidence is below gate or evidence is weak. This query had low confidence, so the judge executed and added 1.65s.

Impact in this trace: high.

## RC4: Main answer generation still costs about 2.8s

This is expected baseline for model generation at current prompt and token settings. It is not the only issue, but it is a significant fixed component.

Impact in this trace: medium-high.

---

## 4) Latency Budget for This Exact Case

Approximate decomposition from measured timings:

- Unavoidable baseline (today):
  - main generation: 2.84s
  - retrieval core (single successful pass): ~1.5-2.2s expected
- Avoidable/optimizable overhead in this trace:
  - workflow lookup: 1.97s
  - sector miss + fallback behavior: about 1.0-1.8s extra
  - no-answer judge: 1.65s

Practical reduction potential for this request pattern:

- Conservative: 2.5-3.5s saved
- Aggressive: 4.0-5.0s saved
- Expected total after fixes: about 4.5-6.5s

---

## 5) Recommended Mitigation Plan

## Phase A (Immediate, low risk, high ROI)

1. Put a strict timeout budget on workflow lookup
- Target: 250-400ms timeout, fail open when exceeded.
- Behavior: if timeout, continue normal route/retrieval without blocking.
- Expected gain: up to 1.5-1.8s on slow lookup calls.

2. Add negative cache for workflow answered-match
- Key: hash(query + user_id/session_id).
- TTL: 60-180 seconds for not-found responses.
- Expected gain: repeated query latency drops by up to ~2s.

3. Tighten no-answer judge gate
- Run semantic judge only when confidence is very low and evidence is weak.
- Suggested gate: confidence < 0.35 and citations == 0.
- Keep existing heuristic fallback safety.
- Expected gain: 1.0-1.8s on many legal responses.

4. Add constitution-aware routing override
- If query contains constitutional terms, avoid forcing sector=justice by default.
- Route sector to general (or dedicated constitutional sector if introduced).
- Expected gain: avoids failed first retrieval pass for this common pattern.

## Phase B (Short-term engineering)

5. Add timed sub-metrics inside retrieval path
- Measure separately:
  - source filter resolve
  - embedding call
  - vector search
  - enrich pass
  - fallback pass
- Outcome: precise hotspot ownership for future optimization.

6. Reuse DB/HTTP connections in workflow-service and knowledge-service
- Introduce connection pooling or long-lived client reuse where missing.
- Outcome: lower tail latency and fewer 1-2s spikes.

## Phase C (Quality-preserving speed mode)

7. Two-stage completion strategy for concise mode
- Stage 1: quick completion event without no-answer semantic judge.
- Stage 2: optional async enrichment/escalation update if needed.
- Outcome: faster perceived completion while preserving safety checks.

---

## 6) Proposed Experiments and Success Criteria

## Experiment 1: Disable no-answer judge temporarily
- Change: ENABLE_NO_ANSWER_LLM_JUDGE=false (staging only).
- Measure: p50/p95 total and escalation precision deltas.
- Success: >= 1s p50 gain with acceptable escalation quality.

## Experiment 2: Workflow lookup timeout + fail-open
- Add 300ms timeout in workflow client call path.
- Measure: workflow_lookup timing distribution and total p95.
- Success: p95 drop >= 0.8s without major regression in answered-match hit-rate value.

## Experiment 3: Constitution routing override
- Add rule keyword set for constitutional queries.
- Measure:
  - first-pass retrieval hit-rate
  - fallback-retrieval frequency
  - retrieval stage median
- Success: fallback frequency reduced by >= 50% for legal constitution-like queries.

---

## 7) Operational Guidance (Runbook)

When a query exceeds 8 seconds total, check in order:

1. workflow_lookup timing
2. retrieval fallback occurrence (sector miss)
3. no_answer_judge timing
4. generation timing

If workflow_lookup > 800ms frequently:

- reduce timeout
- add negative cache
- inspect workflow DB connection setup

If retrieval fallback happens often for legal queries:

- tune routing sector defaults
- improve sector tags for constitutional sources

If no_answer_judge dominates:

- tighten gate
- run judge only under stricter uncertainty conditions

---

## 8) Concrete Backlog Items

P0 backlog:

1. Workflow lookup timeout and fail-open path in orchestrator/client.
2. Workflow answered-match negative cache.
3. Constitution-aware fast route sector selection.
4. No-answer judge stricter gate for concise mode.
5. Retrieval stage sub-metrics and fallback counters in logs.

P1 backlog:

6. Workflow-service DB connection pooling.
7. Knowledge-service DB/client connection reuse review.
8. Add dashboard panels: fallback rate, no-answer judge rate, workflow timeout rate.

---

## 9) Expected Outcome

For the same query family as this incident:

- Current: about 9.5-10.0s
- After Phase A: about 6.0-7.0s
- After Phase B: about 5.0-6.0s

Target SLO after implementation:

- concise mode p50 <= 5.5s
- concise mode p95 <= 8.0s
- first token <= 1.5-2.0s for warm path
