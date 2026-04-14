# JNPI Frontend Master Plan

## Objective
Build a production-ready Arabic-first frontend for JNPI that is fast, verifiable, and trusted for citizen, employee, and admin users.

## Principles
- Prioritize core government user journeys over visual polish.
- Every answer must be easy to verify through citations and source viewer.
- Performance and reliability are first-class UX features.
- Keep RTL accessibility and readability as non-negotiable requirements.

## Phase 1 — Core Assistant UX (Current + Hardening)
### Scope
- Stable chat flow for `citizen` and `employee` roles.
- `Fast` / `Detailed` mode toggle with clear behavior labels.
- Strong answer card metadata: confidence, mode, total time, chunks used, citations.
- Clear loading, error, blocked, and retry states.

### Deliverables
- Robust input composer with keyboard shortcuts and disabled states.
- Predictable message rendering for markdown and legal references.
- Suggested follow-up prompts based on query type.

### Acceptance Criteria
- User can always understand current system state.
- No ambiguous empty/error responses.
- No UI regressions in basic ask/retry/citation flows.

## Phase 2 — Evidence & Document Verification Experience
### Scope
- Improve citation usability and source verification.
- Strengthen document viewer controls.

### Deliverables
- Sorted citations by relevance.
- Jump-to-citation behavior in document viewer.
- Viewer controls: zoom in/out, fit width, page navigation, open source in new tab.
- Source quality indicator (`clean text`, `noisy text`, `ocr fallback`).

### Acceptance Criteria
- User can validate a claim in under 10 seconds.
- Source page and citation mapping are visually obvious.

## Phase 3 — Performance UX & Benchmarking
### Scope
- Make latency bottlenecks visible directly in frontend.

### Deliverables
- Timeline breakdown per request (`routing`, `retrieval`, `generation`, `guardrails`, `total`).
- Cache hit/miss badges when available from backend.
- Mode comparison cards (concise vs detailed p50/p95 over last N requests).
- Request history with filters (status/mode/role/query).

### Acceptance Criteria
- Non-technical users can identify where time is spent without logs.
- Performance regressions are visible in UI during testing.

## Phase 4 — Governance Transparency UX
### Scope
- Better blocked/escalated experience.

### Deliverables
- Friendly guardrail block explanations.
- Suggestion text to rephrase blocked queries.
- Escalation markers with clear reason and next step.

### Acceptance Criteria
- Blocked outputs are understandable and actionable.
- Escalation flow does not feel like a system failure.

## Phase 5 — Session & Productivity Features
### Scope
- Improve continuity and operational usage.

### Deliverables
- Conversation history list (rename, pin, archive).
- Saved prompts/templates for common ministry workflows.
- Session context controls (reset/pin topic/use previous answer).

### Acceptance Criteria
- Users can resume work without re-entering context.
- Frequent tasks require fewer repeated inputs.

## Phase 6 — Frontend Architecture & Quality
### Scope
- Keep scaling manageable as features expand.

### Deliverables
- Feature-based folder architecture.
- Typed API client layer for all services.
- Reusable UI primitives and consistent state management patterns.
- Test baseline: unit + integration + visual regression smoke tests.

### Acceptance Criteria
- New features are added without breaking existing flows.
- PR validation catches major regressions before merge.

## Phase 7 — Accessibility & Arabic Excellence
### Scope
- Government-grade accessibility and Arabic quality.

### Deliverables
- Full RTL review (layout, truncation, icon direction, mixed AR/EN text).
- Keyboard navigation for critical actions.
- ARIA labels and screen-reader improvements.
- Contrast/focus compliance checks.

### Acceptance Criteria
- Core journeys are fully keyboard-accessible.
- UI remains readable and consistent for Arabic-first users.

## Future Enhancements
- Claim-level confidence and explainability UI.
- Multi-document comparison view (before/after amendment timelines).
- Notification center for tracked policies and updates.
- Tenant/organization-level branding and feature flags.

## Suggested Delivery Cadence
- Sprint length: 2 weeks.
- Execution order: 1 → 2 → 3 → 4 mandatory, then 5/6/7 in parallel based on team capacity.
- Definition of done per sprint:
  - Feature implementation
  - Telemetry coverage
  - QA screenshots
  - Test pass
  - Product validation sign-off
