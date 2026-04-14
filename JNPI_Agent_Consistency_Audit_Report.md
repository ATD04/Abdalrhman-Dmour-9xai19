# SECTION B — AUDIT FINDINGS

---
FINDING ID: JNPI-AGENT-001
SEVERITY: CRITICAL
DIMENSION: Dimension 8 — Configuration & Environment Variables
COMPONENT A: agent-service/.env & agent-service/config.py
COMPONENT B: app/.env.shared & app/docker-compose.yml
INCONSISTENCY TYPE: Config Gap
DESCRIPTION:
  The `agent-service/.env` file explicitly hardcodes `KNOWLEDGE_SERVICE_URL=http://localhost:8100`. Because `agent-service/config.py` forcibly applies the local `.env` using `override=True` *after* loading `.env.shared`, the agent service will always resolve the hostname to `localhost` instead of the Docker Compose service name `knowledge-service`.
EVIDENCE:
  Agent-Service: file:///Users/shahedalzubi/Downloads/Knowledge/app/services/agent-service/.env#L6
  Other Component: file:///Users/shahedalzubi/Downloads/Knowledge/app/.env.shared#L9
RUNTIME IMPACT:
  Will cause immediate runtime failures in the Docker environment. All calls the agent-service makes to the knowledge-service (for RAG retrieval) will fail with "Connection Refused" because `localhost:8100` refers to the agent-service's own container, not the knowledge-service.
RECOMMENDATION NOTE:
  Remove the `KNOWLEDGE_SERVICE_URL` variable from `agent-service/.env` to allow the value from `.env.shared` (`http://knowledge-service:8100`) to take precedence in containerized environments.
---

---
FINDING ID: JNPI-AGENT-002
SEVERITY: HIGH
DIMENSION: Dimension 10 — CI/CD & DevOps
COMPONENT A: app/services/agent-service (Directory Structure)
COMPONENT B: .github/workflows/ci-python.yml & .github/workflows/docker-build.yml
INCONSISTENCY TYPE: Broken CI/CD Pipeline
DESCRIPTION:
  The GitHub Actions workflows reference missing directory paths (`Knowledge_Management/services/agent-service`) instead of the correct repository structure (`app/services/agent-service`). The pipelines have not been updated to reflect where the agent-service actual source lives.
EVIDENCE:
  Agent-Service: Location is `app/services/agent-service/`
  Other Component: file:///Users/shahedalzubi/Downloads/Knowledge/.github/workflows/ci-python.yml#L25
RUNTIME IMPACT:
  Will cause test and build failures. The GitHub Actions CI/CD workflows will immediately crash upon executing since the directory `Knowledge_Management/services/agent-service` does not exist.
RECOMMENDATION NOTE:
  Modify all paths in `.github/workflows/` files to correctly reference `app/services/` as the working directory context.
---

---
FINDING ID: JNPI-AGENT-003
SEVERITY: MEDIUM
DIMENSION: Dimension 2 — Data Models & Schema Consistency
COMPONENT A: agent-service/models/schemas.py (QueryResponse)
COMPONENT B: frontend-app/src/App.tsx (MessageMeta type)
INCONSISTENCY TYPE: Schema Mismatch
DESCRIPTION:
  The `QueryResponse` model belonging to the new agent-service natively exposes new fields critical to transparency, specifically: `agent_used`, `sector`, `has_amendments`, `amendment_note`, `session_id`, and `response_id`. The frontend's TypeScript definition `MessageMeta` is completely unaware of these fields and will silently ignore them during SSE parsing.
EVIDENCE:
  Agent-Service: file:///Users/shahedalzubi/Downloads/Knowledge/app/services/agent-service/models/schemas.py#L49-L70
  Other Component: file:///Users/shahedalzubi/Downloads/Knowledge/app/frontend/src/App.tsx#L62-L71
RUNTIME IMPACT:
  Will cause degraded behavior or missing features. The frontend will not be able to inform users if a policy amendment exists (`amendment_note`) or which specialist agent answered the query, fundamentally breaking the transparency design of the platform.
RECOMMENDATION NOTE:
  Update the frontend `MessageMeta` TypeScript interface and the fetch/SSE logic to capture and render the new `has_amendments`, `amendment_note`, `sector`, and `agent_used` fields.
---

---
FINDING ID: JNPI-AGENT-004
SEVERITY: MEDIUM
DIMENSION: Dimension 1 — API Contract Integrity
COMPONENT A: agent-service/main.py
COMPONENT B: frontend-app/src/App.tsx
INCONSISTENCY TYPE: Unused Endpoints
DESCRIPTION:
  The new agent-service exposes multiple new API endpoints (`GET /confidence/{id}`, `POST /validate`, `GET /explain_decision/{id}`, `POST /delegate`) that no other service or frontend currently consumes. The frontend application strictly calls `POST /query/stream`. While not breaking locally, this indicates an orphaned feature surface or incomplete frontend integration.
EVIDENCE:
  Agent-Service: file:///Users/shahedalzubi/Downloads/Knowledge/app/services/agent-service/main.py#L69-L74
  Other Component: file:///Users/shahedalzubi/Downloads/Knowledge/app/frontend/src/App.tsx#L668
RUNTIME IMPACT:
  No direct crashes, but the explainability, confidence breakdown, validation, and multi-agent delegation feedback features are completely inaccessible to the end users, degrading the intended system capabilities.
RECOMMENDATION NOTE:
  The frontend UI needs new components or mechanisms to fetch and display confidence details and routing explanations by calling the new agent-service API paths.
---

---
FINDING ID: JNPI-AGENT-005
SEVERITY: LOW
DIMENSION: Dimension 7 — Frontend Contract
COMPONENT A: agent-service/models/schemas.py (Citation)
COMPONENT B: frontend-app/src/App.tsx (Citation type)
INCONSISTENCY TYPE: Type Mismatch
DESCRIPTION:
  The backend `Citation` schema in the agent-service was extended to include `document_year`, `is_amendment`, and `relevance_score`. `App.tsx` retains a basic `Citation` type expecting only `source_id`, `page`, and `source_name`.
EVIDENCE:
  Agent-Service: file:///Users/shahedalzubi/Downloads/Knowledge/app/services/agent-service/models/schemas.py#L40-L47
  Other Component: file:///Users/shahedalzubi/Downloads/Knowledge/app/frontend/src/App.tsx#L56-L60
RUNTIME IMPACT:
  Silently drops metadata. The frontend citation viewer will lack context regarding whether a citation is an amending law or what year it was published.
RECOMMENDATION NOTE:
  Extend the `Citation` type in `App.tsx` and map the new fields to the UI citation renderer.
---


### Summary Table

| Finding ID | Severity | Dimension | Inconsistency Type | Affected Components |
|------------|----------|-----------|--------------------|---------------------|
| JNPI-AGENT-001 | CRITICAL | Dimension 8 — Config | Config Gap | agent-service ↔ docker-compose |
| JNPI-AGENT-002 | HIGH | Dimension 10 — CI/CD | Broken Pipeline | agent-service ↔ GitHub Actions |
| JNPI-AGENT-003 | MEDIUM | Dimension 2 — Data Models | Schema Mismatch | agent-service ↔ frontend-app |
| JNPI-AGENT-004 | MEDIUM | Dimension 1 — API Contract | Unused Endpoints | agent-service ↔ frontend-app |
| JNPI-AGENT-005 | LOW | Dimension 7 — Frontend Contract | Type Mismatch | agent-service ↔ frontend-app |

### Priority Action Matrix

| Priority | Finding IDs | Rationale |
|----------|-------------|-----------|
| 🔴 Fix Before Any Deployment | JNPI-AGENT-001 | Will cause immediate runtime failures (Docker RAG search loop failure). |
| 🟡 Fix Before Integration Testing | JNPI-AGENT-002 | Will cause test failures and stop automated checks in CI. |
| 🟢 Fix Before Production Release | JNPI-AGENT-003, JNPI-AGENT-004, JNPI-AGENT-005 | Will cause degraded behavior, poor traceability, or missing frontend dashboard features. |
