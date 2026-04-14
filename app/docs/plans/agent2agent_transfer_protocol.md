# Agent-to-Agent (A2A) Transfer Protocol

## Overview

The A2A Transfer Protocol enables automatic inter-agent query routing within the JNPI platform. When a user sends a query to a specialist agent that falls outside its domain, the protocol detects the mismatch and transparently transfers the query to the correct agent — all within a single request cycle.

The design is inspired by Google's Agent2Agent protocol, adapted for an intra-service architecture where all agents share the same LangGraph pipeline but differ in their retrieval scope.

---

## Architecture

```
User Query (agent_id=LABOR_AGENT)
        │
        ▼
┌─────────────────┐
│ Input Guardrail  │
└────────┬────────┘
         ▼
┌─────────────────┐
│  Handoff Check   │
└────────┬────────┘
         ▼
┌─────────────────────────────────────────┐
│        A2A Transfer Check               │
│                                         │
│  1. classify_query() via fast LLM       │
│  2. Compare result vs current agent_id  │
│  3. If mismatch + confidence ≥ 0.55:    │
│     → Update state.agent_id             │
│     → Emit "transfer" SSE event         │
└────────┬────────────────────────────────┘
         ▼
┌─────────────────┐
│ Embed & Rewrite  │  ← uses updated agent_id
└────────┬────────┘
         ▼
┌─────────────────┐
│    Retrieve      │  ← filters by transferred agent's ministry
└────────┬────────┘
         ▼
      ... (generation, post-gen, etc.)
```

The transfer check sits **after** the input guardrail and handoff detection but **before** embedding and retrieval, ensuring the correct ministry filter is applied from the start.

---

## Components

### 1. Agent Card Registry

Each specialist agent is described by an `AgentCard` dataclass:

| Field | Type | Description |
|-------|------|-------------|
| `agent_id` | `str` | Unique identifier (e.g. `CIVIL_SERVICE_AGENT`) |
| `name_en` / `name_ar` | `str` | Bilingual display name |
| `ministry_name` | `str` | Maps to knowledge-service ministry filter |
| `scope_en` / `scope_ar` | `str` | Detailed scope description for the LLM router |
| `topics_en` / `topics_ar` | `list[str]` | Key topic keywords |

**Registered agents:**

| Agent ID | Ministry Filter | Domain |
|----------|----------------|--------|
| `CIVIL_SERVICE_AGENT` | `civil_service_agent` | Government employment, civil service regulations, salary scales, promotions, pensions |
| `LABOR_AGENT` | `labor_agent` | Private sector labor law, worker rights, contracts, wages, workplace safety, social security |
| `JUSTICE_AGENT` | `justice_agent` | Courts, civil/criminal proceedings, family law, notarisation, legal aid, penal code |
| `CIVIL_STATUS_AGENT` | `civil_status_agent` | Vital records, birth/death certificates, marriage, national ID, family book, citizenship |

### 2. Agent Manual

A compiled text block auto-generated from all agent cards. It is injected into the router's system prompt so the LLM has full awareness of every agent's scope.

### 3. Query Classifier

A fast LLM call (`classify_query()`) using the `FAST_ROUTER_GEMINI_MODEL` (defaults to `gemini-2.0-flash`):

- **Input:** User query + Agent Manual
- **Output:** Structured JSON `{"agent_id": "...", "confidence": 0.0-1.0, "reason": "..."}`
- **Token budget:** 150 tokens max (classification only, no generation)
- **Latency:** Typically 200-400ms

The classifier is instructed to return `"NONE"` if no agent is a clear fit.

### 4. Transfer Decision Engine

`check_transfer()` applies the following logic:

```
IF no agent selected (All Ministries mode):
    → No transfer (no-op)

IF classified_agent == current_agent:
    → No transfer (query matches)

IF classified_agent is None:
    → No transfer (uncertain classification)

IF confidence < 0.55:
    → No transfer (below threshold)

ELSE:
    → TRANSFER: update agent_id to classified_agent
```

**Threshold:** The minimum confidence for a transfer is `0.55` (configurable via `_ROUTER_MIN_CONFIDENCE`).

---

## Data Flow

### State Fields (RAGState)

| Field | Type | Description |
|-------|------|-------------|
| `transfer_occurred` | `bool` | Whether a transfer happened |
| `transfer_from` | `str \| None` | Original agent ID |
| `transfer_to` | `str \| None` | Target agent ID |
| `transfer_reason` | `str \| None` | LLM-generated reason for the transfer |
| `transfer_confidence` | `float` | Router classification confidence |

### SSE Events

**`event: transfer`** — Emitted when a transfer occurs (non-terminal; pipeline continues):

```json
{
  "response_id": "abc-123",
  "from_agent": "LABOR_AGENT",
  "to_agent": "JUSTICE_AGENT",
  "reason": "Query about court procedures is in the domain of the Ministry of Justice",
  "confidence": 0.92
}
```

**`event: complete`** — Includes transfer metadata in the final payload:

```json
{
  "agent_used": "JUSTICE_AGENT",
  "transfer": {
    "occurred": true,
    "from_agent": "LABOR_AGENT",
    "to_agent": "JUSTICE_AGENT",
    "reason": "..."
  }
}
```

---

## Frontend Behavior

1. **Agent selector dropdown** in the mode bar lets users pick: All Ministries, Civil Service, Labor, Justice, or Civil Status.
2. When a `transfer` SSE event arrives:
   - The agent dropdown auto-switches to the new agent.
   - A blue banner appears above the answer:
     > 🔄 Query transferred from Ministry of Labor to Ministry of Justice
3. The transfer banner is bilingual (EN/AR) and persists for the lifetime of that message.

---

## File Inventory

| File | Role |
|------|------|
| `core/a2a_protocol.py` | Agent cards, manual builder, classifier, transfer decision engine |
| `agent_graph/state.py` | Transfer state fields on `RAGState` |
| `agent_graph/nodes.py` | `transfer_check_node` graph node |
| `agent_graph/graph.py` | Node registration, edge wiring, streaming pipeline integration |
| `api/query.py` | SSE `transfer` event emission, `complete` payload enrichment |
| `config.py` | `AGENT_MINISTRY_MAP`, `FAST_ROUTER_GEMINI_MODEL` |
| `frontend/src/app/page.tsx` | Agent selector, transfer event handler, transfer banner UI |
| `frontend/src/lib/api.ts` | `agent_id` on `QueryRequest` interface |

---

## Example Scenario

1. User has **LABOR_AGENT** selected and asks: _"ما هي إجراءات رفع دعوى مدنية في الأردن؟"_ (What are the procedures for filing a civil lawsuit in Jordan?)
2. `transfer_check_node` fires → `classify_query()` returns `{agent_id: "JUSTICE_AGENT", confidence: 0.92}`
3. `check_transfer()` detects mismatch (LABOR ≠ JUSTICE) with confidence above threshold → transfer approved
4. `state.agent_id` is updated to `JUSTICE_AGENT`
5. `retrieve_node` now filters by `ministry_name="justice_agent"` → retrieves justice-related documents
6. Frontend receives `event: transfer` → UI updates agent selector + shows banner
7. Answer is generated from Ministry of Justice documents with correct citations

---

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `FAST_ROUTER_GEMINI_MODEL` | `gemini-2.0-flash` | Model used for the router/classifier |
| `ENFORCE_STRICT_SCOPE_FILTERS` | `true` | When `false`, ministry filter is still respected if explicitly set by agent |

**In-code constants:**

| Constant | Value | Location |
|----------|-------|----------|
| `_ROUTER_MIN_CONFIDENCE` | `0.55` | `core/a2a_protocol.py` |
| Router `max_output_tokens` | `150` | `core/a2a_protocol.py` |

---

## Future Work

- **Cross-service A2A:** Extend to transfer queries between entirely different microservices (e.g. governance-service, workflow-service).
- **Transfer history:** Track transfer chains for analytics and auditing.
- **User confirmation mode:** Optional "Ask before transferring" mode for sensitive contexts.
- **Agent capability negotiation:** Agents publish capabilities dynamically; the router fetches agent cards at runtime.
- **Multi-hop transfers:** Allow chained transfers through intermediate agents when queries span 3+ domains.
- **Transfer feedback loop:** Use user satisfaction signals to fine-tune the router's confidence threshold per agent pair.
