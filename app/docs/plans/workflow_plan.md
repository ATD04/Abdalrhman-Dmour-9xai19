# Workflow Service Plan (MVP → Production)

## Objective
Build the Workflow Service as the operational layer that closes the loop between AI answers and real government handling (tickets, assignments, follow-up, resolution).

## Critical Policy Constraints (Must-Have)
- Out-of-scope queries must be blocked by guardrails (example: cooking questions) and must NOT create tickets.
- Only in-scope queries with insufficient answer quality should escalate to workflow.
- Escalation trigger for MVP: low confidence and/or no usable grounded answer despite in-scope routing.
- Workflow is for human assistance and automation support, not for handling irrelevant requests.

## Why Now
- Assistant and governance layers are usable.
- Escalations need a real lifecycle, not just flags.
- Workflow is required for production value in ministry operations.

## MVP Scope (Phase W1)
### Core Use Cases
1. Create ticket only from in-scope failed responses (not out-of-scope blocked queries).
2. Route ticket to admin/agent queue with sector label.
3. Let admin answer and resolve the ticket.
4. Return resolved answer back to the same end user in a user ticket section.
5. Track full lifecycle and timeline.
6. Reuse high-quality resolved tickets as FAQ candidates.

### MVP Flow (Exact)
1. User asks question in assistant.
2. Guardrails check query:
	- If out-of-scope: blocked (no ticket).
	- If in-scope: continue.
3. Agent attempts grounded answer.
4. If answer quality is insufficient (confidence trigger / no usable evidence), create escalated ticket.
5. Admin sees escalated ticket in admin queue, reviews context, and writes official resolution.
6. Ticket status updates and resolved answer is visible in user ticket section.
7. User can track `open`, `pending`, `closed` and read final answer.
8. Resolved tickets are candidates for FAQ indexing and future answer reuse.

### Data Model (Minimum)
- `case_id`
- `request_id` (linked to agent response)
- `session_id`
- `user_id` (or anonymous/session identity for MVP)
- `query`
- `query_hash` (for duplicate/similar detection later)
- `user_type`
- `sector_primary`
- `sector_labels[]` (MVP supports one primary + optional secondary labels)
- `priority` (`low|medium|high|urgent`)
- `status` (`open|pending|closed` for MVP UI; internal mapping allowed)
- `assigned_to`
- `created_at`, `updated_at`, `resolved_at`
- `resolution_note`
- `resolution_answer`
- `escalation_reason` (`low_confidence|no_grounded_answer|manual_escalation`)
- `is_faq_candidate` (bool)
- `timeline[]` (event type, actor, timestamp, note)

### API Endpoints (MVP)
- `POST /cases` — create case
- `GET /cases` — list with filters (`status`, `sector`, `priority`, `assignee`, date range)
- `GET /cases/{id}` — case details
- `PATCH /cases/{id}` — update status/priority/assignee
- `POST /cases/{id}/notes` — add timeline note
- `POST /cases/{id}/resolve` — resolve case
- `GET /users/{user_id}/cases` — user ticket inbox
- `POST /cases/{id}/faq_candidate` — mark resolved case for FAQ pipeline

### Frontend Sections (MVP)
- User section: `My Tickets`
	- Tabs/filters: `open`, `pending`, `closed`
	- Ticket card: question, status, created_at, latest update, resolved answer (if closed)
- Admin section: `Escalated Tickets`
	- Filters: sector, status, priority, assignment
	- Actions: assign, set priority, add note, resolve

## Phase W2 — Frontend Workflow UX Integration
### Scope
- Integrate workflow views into current frontend.

### Deliverables
- User ticket inbox and details (`open/pending/closed`).
- Admin queue with assignment and sector filters.
- Case details with timeline + source context + response trace.
- "Escalate to workflow" action from assistant answers.
- Basic assignment + resolve UI.

### Acceptance Criteria
- Any in-scope failed answer can be converted into a trackable case.
- Out-of-scope blocked queries do not enter workflow.
- User sees returned final answer in ticket section after admin resolution.
- Case owner can complete assignment→resolution without leaving JNPI frontend.

## Phase W3 — Rules & Automation
### Scope
- Reduce manual handling load.

### Deliverables
- Auto-priority rules (confidence threshold, sector sensitivity, guardrail category).
- Auto-assignment rules by sector/team.
- SLA fields and breach detection.
- Reminder/notification events.
- Ticket auto-labeling with multi-sector support (one primary + related sectors).
- Similar-case detection for duplicate reduction.
- FAQ auto-suggestion from resolved high-quality tickets.

### Acceptance Criteria
- High-risk cases are auto-prioritized.
- Assignment latency decreases significantly.

## Phase W4 — Audit & Governance Integration
### Scope
- Make workflow fully auditable and compliance-ready.

### Deliverables
- Immutable timeline events for key state changes.
- Link case timeline to governance audit records.
- Export case logs for reviews and reporting.

### Acceptance Criteria
- Every case transition has actor/time/reason metadata.
- Compliance teams can trace case history end-to-end.

## Phase W5 — Advanced Operations
### Scope
- Scale for ministry-wide adoption.

### Deliverables
- Team inboxes and workload dashboards.
- Bulk actions and queue operations.
- Escalation chains and approvals.
- Re-open logic and duplicate case detection.
- Advanced cross-sector tickets (split/merge/sub-case handling).
- End-to-end automation policies to reduce manual effort.
- FAQ feedback loop (approved answers reused in assistant pipeline).

### Acceptance Criteria
- Teams can handle high volume with predictable throughput.
- Managers can monitor SLA and bottlenecks from dashboard.

## Non-Functional Requirements
- Strong validation for all state transitions.
- Role-based authorization for case actions.
- Pagination and indexing for list endpoints.
- Idempotent create/update behavior where applicable.
- Full observability: latency, error rate, queue depth.

## Suggested Backend Architecture
- FastAPI service with explicit domain layer.
- Storage: relational DB (PostgreSQL preferred for production).
- Event/timeline table for append-only tracking.
- Optional async task worker for notifications/automation.

## Rollout Strategy
1. Build W1 API + DB schema.
2. Integrate minimal frontend screens (W2).
3. Add automation/rules (W3).
4. Add audit-grade exports and dashboards (W4/W5).

## Success Metrics
- Mean time to first assignment.
- Mean time to resolution.
- SLA breach rate.
- Escalation-to-resolution conversion rate.
- Reopen rate (quality signal).
- Out-of-scope false escalation rate (target: near zero).
- FAQ reuse hit rate (resolved-ticket answers reused successfully).
