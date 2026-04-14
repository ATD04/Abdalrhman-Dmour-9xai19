# Universal Implementation Prompt: Clickable Source Evidence Viewer

Use this prompt with any engineering team or coding assistant to implement a "click source to open exact evidence page" experience in a safe, scalable, department-agnostic way.

## Copy-Paste Prompt

You are a senior full-stack architect. Design and implement a reusable evidence-traceability feature for an AI assistant product.

### Objective
Implement a user experience where:
1. The AI answer includes clickable source citations.
2. Clicking a citation opens the exact referenced evidence page or snippet.
3. The solution is reusable across departments (legal, health, education, transport, finance, etc.) and across multiple projects.

### Non-Negotiable Principles
1. Evidence-first: every citation must map to real retrieved content, never fabricated links.
2. Deterministic resolution: citation key must reliably resolve to one displayable evidence item.
3. Separation of concerns:
- AI/orchestrator generates answer + structured citations.
- Knowledge service stores content and serves evidence assets.
- Frontend only renders and resolves citation references.
4. Security and governance: enforce access control and auditability on evidence endpoints.
5. Department portability: no hardcoded ministry, domain, policy, or product assumptions.

### Required Architecture
Implement three layers.

1. Frontend layer
- Render citation chips beneath each AI answer.
- On click, open an evidence panel/modal/side pane.
- Load the evidence asset using citation fields (do not infer or guess URLs from text).
- Support desktop and mobile layouts.

2. Agent/Orchestration layer
- Return a typed response with:
- answer
- confidence
- citations[]
- optional metadata (timings, chunks_used, escalation flags)
- Build citations from retrieved chunks only.
- Deduplicate citations by stable key.
- Include all fields needed by frontend resolver.

3. Knowledge/Evidence service layer
- Provide endpoint(s) to serve a specific evidence page/snippet by stable IDs.
- Provide endpoint(s) to list available pages/snippets for a source.
- During ingestion, persist renderable evidence artifacts (page images or snippet projections).

### Standard Citation Contract (Language-Agnostic)
Use this minimum schema in all projects:

```json
{
  "source_id": "string",
  "source_name": "string",
  "locator": {
    "type": "page|section|paragraph|timestamp|cell",
    "value": "string_or_number"
  },
  "relevance_score": 0.0,
  "document_version": "string_optional",
  "extra": {}
}
```

For page-based documents, locator example:

```json
"locator": { "type": "page", "value": 12 }
```

### Evidence URL Resolution Rule
Implement a resolver function:
- Input: citation object
- Output: canonical evidence endpoint URL
- Must not parse answer text.
- Must support multiple locator types (page, section, timestamp).

Example pattern:
- `/sources/{source_id}/page/{page_num}` for PDFs/images
- `/sources/{source_id}/snippet/{snippet_id}` for text chunks
- `/sources/{source_id}/time/{seconds}` for media

### Ingestion and Retrieval Requirements
1. Ingestion pipeline must:
- Extract content
- Generate renderable evidence artifacts (page images/snippet map)
- Store source metadata and version
- Link each retrievable chunk to its source and locator

2. Retrieval pipeline must return chunks with:
- source_id
- source_name
- locator metadata (page/section/etc.)
- score

3. Citation extraction must:
- Map retrieved chunks to citation objects
- Deduplicate by `(source_id + locator)`
- Preserve ranking signal (score)

### API Contracts
Define explicit typed contracts.

1. Query API response
```json
{
  "answer": "string",
  "confidence": 0.0,
  "citations": [],
  "chunks_used": 0,
  "timings": {}
}
```

2. Evidence page API
- `GET /sources/{source_id}/page/{page_num}` -> image/pdf fragment/HTML render

3. Evidence index API
- `GET /sources/{source_id}/pages` -> list of available page artifacts

### Access Control and Governance
Implement:
1. Authorization check on evidence endpoints (role + department visibility).
2. Source visibility model (`public`, `internal`, `restricted`, `classified`).
3. Immutable audit logs for:
- query id
- user id
- response id
- cited source ids
- opened evidence endpoints
4. Optional redaction layer for sensitive fields.

### Multi-Department Generalization Rules
Design for configurability using metadata and policy files.

1. Department profile config
- department_id
- taxonomy
- default visibility
- compliance tags
- retention policy

2. No hardcoded domain terms in core services.
3. Department-specific behavior should be plugin/config-driven.
4. Use shared citation schema across all departments.

### UI/UX Requirements
1. Citation chips show source title + locator label (for example: "Budget Law - p.12").
2. On click, open inline evidence viewer without leaving chat context.
3. Show loading, empty, and access-denied states.
4. Provide "open full document" fallback when page/snippet rendering is unavailable.
5. Ensure keyboard accessibility and mobile responsiveness.

### Reliability and Performance
1. Cache evidence artifact URLs and source metadata.
2. Set SLO target for citation-open latency (for example p95 < 800ms internal network).
3. Add retries and graceful fallback for missing artifacts.
4. Surface non-breaking UI warnings when evidence fails to load.

### Observability
Add metrics and logs.

Metrics:
- citation_render_count
- citation_click_count
- evidence_load_success_rate
- evidence_load_latency_ms
- missing_artifact_rate
- access_denied_rate

Logs/trace correlation:
- request_id
- response_id
- source_id
- locator
- user_role
- department_id

### Test Plan (Must Include)
1. Unit tests
- Citation extraction from retrieved chunks
- URL resolver by locator type

2. Integration tests
- Query returns citations
- Clicking citation loads correct evidence artifact
- Unauthorized user cannot access restricted source

3. E2E tests
- Ask question -> receive citations -> click -> correct page/snippet opens
- Mobile viewport behavior

4. Negative tests
- Missing page artifact
- Stale source version
- Invalid source_id or locator

### Rollout Plan
1. Phase 1: single department pilot with telemetry.
2. Phase 2: enable department configuration and policy plugins.
3. Phase 3: cross-project shared package for citation contract + resolver.
4. Phase 4: enforce organization-wide evidence traceability standard.

### Deliverables
Provide:
1. Architecture diagram (frontend, orchestrator, knowledge service).
2. API spec (OpenAPI/typed schemas).
3. Data model for source, chunk, citation, artifact.
4. Security model and audit strategy.
5. Implementation plan with milestones.
6. Production readiness checklist.

### Acceptance Criteria
The implementation is complete only if:
1. Every citation click opens the exact referenced evidence unit.
2. Citation data is derived from retrieval output, not generated from answer prose.
3. The same core implementation works for at least 3 different departments by configuration only.
4. Security controls and audit logs are active on all evidence endpoints.
5. Automated tests cover happy path and failure path.

---

## Optional Short Prompt (Executive Version)

Design and implement a reusable evidence-traceability feature for an AI assistant: answers must include structured citations; citation clicks must open exact referenced evidence (page/snippet/timestamp) through stable APIs. Build this with strict schema contracts, role-based access control, audit logging, and configuration-driven department customization so the same core can run across multiple departments and projects without code forks. Include architecture, APIs, tests, observability, rollout, and acceptance criteria.
