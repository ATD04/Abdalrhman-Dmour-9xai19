# API Patterns & Conventions

> **Error format**: `{ error: string, details?: unknown }`. **Pagination**: ad-hoc `limit`/`after` query params. **Responses**: bare objects or arrays (no envelope).

---

## Error Handling

### Error Classes

All application errors extend `HttpError` (file: `server/src/errors.ts`):

```typescript
class HttpError extends Error {
  status: number;
  details?: unknown;
}
```

Six factory functions:

| Factory | HTTP Status | Usage |
|---------|-------------|-------|
| `badRequest()` | 400 | Malformed query params, missing required fields |
| `unauthorized()` | 401 | No authentication, actor type is `"none"` |
| `forbidden()` | 403 | Missing permissions (e.g. `tasks:assign`) |
| `notFound()` | 404 | Entity not found by ID |
| `conflict()` | 409 | Checkout race, duplicate shortname |
| `unprocessable()` | 422 | Semantic validation failure (bad adapter type, invalid config) |

### Error Response Shape

```json
{
  "error": "Human-readable error message",
  "details": {}  // optional — structured data for programmatic handling
}
```

### Special Error Cases

**Zod validation errors** (caught by global error handler):
```json
{
  "error": "Validation error",
  "details": [
    { "code": "invalid_type", "path": ["name"], "message": "Required" }
  ]
}
```

**Checkout conflict** (409):
```json
{
  "error": "Issue checkout conflict",
  "details": {
    "issueId": "uuid",
    "status": "in_progress",
    "assigneeAgentId": "uuid",
    "checkoutRunId": "uuid",
    "executionRunId": "uuid"
  }
}
```

**Unhandled errors**: Always return `500 { error: "Internal server error" }`.

### Global Error Handler

Mounted as the last middleware (`server/src/middleware/error-handler.ts`):
1. `HttpError` → respond with error's status + message. 5xx tracked in telemetry.
2. `ZodError` → respond 400 with Zod issues array.
3. All other → respond 500.

---

## Request Validation

### Body Validation Middleware

```typescript
// server/src/middleware/validate.ts
function validate(schema: ZodSchema) {
  return (req, _res, next) => {
    req.body = schema.parse(req.body);  // throws ZodError on failure
    next();
  };
}
```

Applied per-route:
```typescript
router.post("/issues/:id/checkout", validate(checkoutIssueSchema), handler);
router.patch("/issues/:id", validate(updateIssueRouteSchema), handler);
```

Schemas are defined in `@paperclipai/shared` (`packages/shared/src/validators/`).

### Query Parameter Validation

Done **manually** in route handlers (not via `validate` middleware):

| Type | Pattern |
|------|---------|
| Booleans | `parseBooleanQuery(value)` — accepts `true`, `"true"`, `"1"` |
| Dates | `parseDateQuery(value, field)` — wraps `new Date()`, throws 400 on invalid |
| Integers | `Number.parseInt()` with explicit NaN/range checking |
| Enums | Zod `schema.parse()` applied inline |

### Path Parameter Resolution

`router.param("id", ...)` hooks resolve human-readable identifiers (e.g. `PAP-39`) to UUIDs before handlers execute. Applied in issues and agents routes.

---

## Pagination

Pagination is **ad-hoc** — no standardized pattern across all endpoints. Most list endpoints return all matching rows or accept a simple `limit`.

### Common Patterns

**Simple limit** (most list endpoints):
```
GET /api/companies/:companyId/issues?limit=50
```
- Query param: `limit` (positive integer, optional).
- No `offset` or `cursor`.
- Returns a flat array.

**Cursor-based** (issue comments):
```
GET /api/issues/:id/comments?afterCommentId=uuid&order=asc&limit=100
```
- `after` / `afterCommentId` — fetch comments after a given comment ID.
- `order` — `"asc"` or `"desc"` (default: `"desc"`).
- `limit` — capped at 500 (`MAX_ISSUE_COMMENT_LIMIT`).

**Sequence cursor** (heartbeat run events):
```
GET /heartbeat-runs/:runId/events?afterSeq=42&limit=200
```
- `afterSeq` — sequence-number cursor.
- `limit` — defaults to 200.

**Byte offset** (heartbeat run logs):
```
GET /heartbeat-runs/:runId/log?offset=0&limitBytes=256000
```

**Heartbeat runs list**:
```
GET /api/companies/:companyId/heartbeat-runs?limit=200&agentId=uuid
```
- `limit` — clamped to `[1, 1000]`, defaults to 200.

**No pagination** (activity log):
```
GET /api/companies/:companyId/activity
```
- Returns all matching rows, ordered by `createdAt DESC`.

---

## Filtering

### Issues List — Richest Filtering

`GET /api/companies/:companyId/issues` supports:

| Query Param | Type | Description |
|-------------|------|-------------|
| `status` | string | Comma-separated statuses: `"todo,in_progress,blocked"` |
| `assigneeAgentId` | UUID | Filter by assigned agent |
| `participantAgentId` | UUID | Filter by participant agent |
| `assigneeUserId` | string/`"me"` | Filter by assigned user (`"me"` resolves to current board user) |
| `touchedByUserId` | string/`"me"` | Issues the user has interacted with |
| `inboxArchivedByUserId` | string/`"me"` | Inbox archive filter |
| `unreadForUserId` | string/`"me"` | Unread filter |
| `projectId` | UUID | Scope to a project |
| `executionWorkspaceId` | UUID | Scope to an execution workspace |
| `parentId` | UUID | Filter by parent issue |
| `labelId` | UUID | Filter by label |
| `originKind` | string | Origin kind filter |
| `originId` | string | Origin ID filter |
| `includeRoutineExecutions` | `"true"`/`"1"` | Include routine-generated issues |
| `q` | string | Free-text search |
| `limit` | integer | Max results |

### The `"me"` Alias

Several user-scoped filters accept `"me"` which resolves to the current board user's ID. Returns 403 if used by a non-board actor.

### Activity Filters

```
GET /api/companies/:companyId/activity?agentId=uuid&entityType=issue&entityId=uuid
```

Simple equality filters on `agentId`, `entityType`, `entityId`.

---

## Checkout Semantics

Atomic task reservation — prevents two agents from working on the same issue simultaneously.

### Endpoint

```
POST /api/issues/:id/checkout
```

### Request Body

```typescript
{
  agentId: string;            // UUID — the agent claiming the task
  expectedStatuses: string[]; // non-empty array of valid statuses (e.g. ["todo", "in_progress"])
}
```

### Atomic Operation (Database)

1. **Stale lock cleanup**: `SELECT FOR UPDATE` in a transaction clears `executionRunId` if the referenced heartbeat run is no longer active.

2. **Conditional UPDATE**: Single `UPDATE ... WHERE` applies all preconditions atomically:
   - Issue status must be in `expectedStatuses`.
   - `assigneeAgentId` must be null (unassigned) or match the requesting agent.
   - `executionRunId` must be null or match the requesting `checkoutRunId`.

3. **On success**: Sets `status = "in_progress"`, `assigneeAgentId = agentId`, `checkoutRunId`, `executionRunId`, `startedAt`.

4. **On failure** (no rows updated): Returns **409 Conflict** with diagnostic details.

### Pre-Checkout Guards

- **Project pause check**: 409 if project is paused (budget hard-stop).
- **Closed workspace check**: 409 with workspace details.
- **Agent identity check**: 403 if agent tries to checkout as a different agent.

### Related Endpoints

- `POST /api/issues/:id/release` — reverses the checkout, clears lock fields.
- `assertAgentRunCheckoutOwnership` — enforces that an agent commenting or updating an in-progress issue must hold the checkout lock.

### Idempotency

- **Self-checkout**: If the requesting run already owns the lock, returns current issue without 409.
- **Stale run adoption**: If the same agent holds the issue under a stale `checkoutRunId`, the lock is adopted to the new run.

---

## Activity Logging

### Core Function

`logActivity()` in `server/src/services/activity-log.ts`:

```typescript
interface LogActivityInput {
  companyId: string;
  actorType: "agent" | "user" | "system";
  actorId: string;
  action: string;          // dot-separated: "entity.verb"
  entityType: string;
  entityId: string;
  agentId?: string | null;
  runId?: string | null;
  details?: Record<string, unknown> | null;
}
```

### Pipeline

1. Sanitize `details` via `sanitizeRecord` (redacts secrets/PII).
2. Apply username censoring if enabled.
3. Insert into `activityLog` table.
4. Publish `"activity.logged"` live event (WebSocket broadcast).
5. If known plugin event type, emit to plugin event bus.

### Action Naming Convention

Dot-separated `entity.verb` format:

| Entity | Actions |
|--------|---------|
| `issue` | `created`, `updated`, `checked_out`, `released`, `deleted`, `comment_added`, `attachment_added`, `document_created`, `blockers_updated`, `reviewers_updated`, `feedback_vote_saved`, `work_product_created` |
| `agent` | `created`, `updated`, `paused`, `resumed`, `terminated`, `hire_created`, `skills_synced`, `permissions_updated`, `instructions_path_updated` |
| `heartbeat` | `invoked`, `cancelled` |
| `label` | `created`, `deleted` |
| `approval` | `created` |

### Details Object Pattern

```json
{
  "changedTopLevelKeys": ["status", "priority"],
  "changedAdapterConfigKeys": ["model"],
  "_previous": { "status": "todo", "priority": "medium" },
  "commentId": "uuid",
  "bodySnippet": "First 120 chars of comment..."
}
```

### Actor Resolution

`getActorInfo(req)` in `server/src/routes/authz.ts` extracts `actorType`, `actorId`, `agentId`, and `runId` from `req.actor`.

---

## Response Shapes

### Single Object

Entity CRUD returns the object directly:
```
GET  /issues/:id       → Issue
POST /companies/:id/issues → 201 Issue
PATCH /issues/:id      → Issue
```

### Array

List endpoints return flat JSON arrays (no wrapper):
```
GET /companies/:id/issues    → Issue[]
GET /issues/:id/comments     → Comment[]
GET /companies/:id/agents    → Agent[]
```

### Enriched Object

Some endpoints return composed responses:
```json
// GET /issues/:id
{
  ...issue,
  "goalId": "...",
  "ancestors": [...],
  "blockedBy": [...],
  "blocks": [...],
  "project": {...},
  "goal": {...},
  "currentExecutionWorkspace": {...},
  "workProducts": [...]
}

// PATCH /issues/:id (when inline comment provided)
{ ...issue, "comment": {...} }
```

### Delete Success

```json
{ "ok": true }
```

### Deferred Operations

Return `202 Accepted`:
```json
{ "status": "skipped", "reason": "issue_execution_deferred", "message": "..." }
```

### HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Default (GET, PATCH, DELETE, idempotent) |
| 201 | Resource creation (POST that creates) |
| 202 | Accepted but deferred (wakeup, heartbeat invoke) |
| 400 | Bad request / validation error |
| 401 | Unauthenticated |
| 403 | Forbidden / insufficient permissions |
| 404 | Not found |
| 409 | Conflict (checkout, duplicate) |
| 422 | Unprocessable entity |
| 500 | Internal server error |

---

## Middleware Pipeline

Assembled in `server/src/app.ts`:

1. `express.json({ limit: "10mb" })` — Body parsing
2. `httpLogger` — Request logging (pino)
3. `privateHostnameGuard` — Blocks untrusted hostnames
4. `actorMiddleware` — Authentication (resolves `req.actor`)
5. `boardMutationGuard` — CSRF protection for browser sessions
6. Per-route `validate(schema)` — Zod body validation
7. Per-route authorization — `assertCompanyAccess()`, `assertBoard()`, `assertInstanceAdmin()`
8. `errorHandler` — Global error handler (catches HttpError, ZodError, unhandled)
