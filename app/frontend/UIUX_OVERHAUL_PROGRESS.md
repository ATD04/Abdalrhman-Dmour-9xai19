# Frontend UI/UX Overhaul Progress

Date: 2026-03-24
Scope: app/frontend

## What Was Implemented

### 1) Backend-First API alignment
- Hardened the API layer to tolerate backend response-shape variations.
- Added configurable service URL accessor to remove hardcoded localhost coupling.
- Updated workflow answered-match call to use backend-supported query parameters (`query`, optional `user_id`, `session_id`).
- Updated case resolution payload to use `actor` (backend contract).
- Added safer JSON parsing for empty/204 responses.

### 2) UI navigation cleanup (backend parity)
- Trimmed primary navigation to backend-backed surfaces:
  - User: AI Assistant, My Requests
  - Admin: Control Tower, Knowledge Hub, Case Operations, AI Assistant
  - Executive: Overview, Analytics
- Removed unsupported/admin-local nav entries that did not map to real backend capabilities.

### 3) Critical frontend wiring fixes
- Chat (`/`) now uses configured service base URLs instead of hardcoded endpoints.
- Chat request payload now sends `user_type: citizen` (backend-supported enum).
- Chat source viewer now loads file/page preview from configured knowledge-service URL.
- Upload page now uses configured knowledge-service URL and supports backend-supported file formats (PDF, DOCX, TXT, HTML, images).
- Expert ticket queue now uses configured workflow-service URL.
- Removed dead expert details route action and kept actionable in-place workflow.

## Files Changed

- `src/lib/api.ts`
- `src/components/AppShell.tsx`
- `src/components/CaseResolutionModal.tsx`
- `src/app/page.tsx`
- `src/app/knowledge/upload/page.tsx`
- `src/app/expert/page.tsx`
- `src/app/expert/tickets/page.tsx`

## Validation Run

- Type check: PASSED (`npm run typecheck`)
- Smoke tests: FAILED because backend services were unreachable from frontend at run time (all service fetch checks failed)
- Lint: existing repository-wide lint issues are present outside this change set (tests and several existing pages)

## Implementation Guide

### Prerequisites
1. Ensure backend services are running and reachable.
2. In `app/frontend`, install dependencies:
   - `npm install`

### Environment configuration
Create/update `.env.local` in `app/frontend`:

```env
NEXT_PUBLIC_AGENT_URL=http://localhost:9200
NEXT_PUBLIC_KNOWLEDGE_URL=http://localhost:9100
NEXT_PUBLIC_GOVERNANCE_URL=http://localhost:9300
NEXT_PUBLIC_WORKFLOW_URL=http://localhost:9400
```

### Run frontend
```bash
cd app/frontend
npm run dev
```

### Verify integration quickly
```bash
npm run typecheck
npm run test:smoke
```

### Recommended usage flow
1. Use `/knowledge/upload` to ingest documents.
2. Verify source availability in `/knowledge`.
3. Ask questions in `/` and validate citations/source preview.
4. If escalated, resolve cases via `/expert` and monitor user-facing status in `/my-tickets`.
5. Monitor health and KPIs from `/admin` and `/executive`.

## Notes
- Smoke test failures in this run were environmental (service connectivity), not TypeScript contract errors.
- Additional modernization can continue in a second phase (consolidating duplicate route variants and replacing remaining hardcoded fetch calls in secondary pages).
