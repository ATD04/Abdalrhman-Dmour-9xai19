# API Authentication & Authorization

> **Two modes**: `local_trusted` (dev default — all requests auto-authenticated) and `authenticated` (production — session + API keys required).

---

## Deployment Modes

| Mode | When | Behavior |
|------|------|----------|
| `local_trusted` | Default dev mode | Every request is implicitly a fully-privileged board user. No tokens needed. |
| `authenticated` | Production / shared | Requests must prove identity via session cookie, board API key, agent API key, or agent JWT. |

Set via `PAPERCLIP_DEPLOYMENT_MODE` env var. Default: `local_trusted`.

---

## Actor Model

Every Express request carries `req.actor` — a discriminated union:

```typescript
interface Actor {
  type: "board" | "agent" | "none";
  userId?: string;          // board only
  agentId?: string;         // agent only
  companyId?: string;       // agent only (single company)
  companyIds?: string[];    // board only (multiple companies)
  isInstanceAdmin?: boolean;
  keyId?: string;
  runId?: string;
  source?: "local_implicit" | "session" | "board_key" | "agent_key" | "agent_jwt" | "none";
}
```

| Actor Type | Who | Scope |
|-----------|-----|-------|
| `board` | Human user (UI or CLI) | Multi-company via `companyIds[]` |
| `agent` | AI agent | Single company via `companyId` |
| `none` | Unauthenticated | No access |

---

## Authentication Resolution Pipeline

The `actorMiddleware` (mounted globally on every request) resolves identity in this order:

### 1. No Bearer Token Present

- **`local_trusted` mode**: Actor = privileged local board (`isInstanceAdmin: true`, source: `local_implicit`).
- **`authenticated` mode**: Attempt session resolution via Better Auth cookies (source: `session`).

### 2. Bearer Token Present

Checked in order — first match wins:

#### a. Board API Key
- Token format: `pcp_board_<48 hex chars>`
- SHA-256 hash lookup in `board_api_keys` table.
- Validates: not revoked, not expired.
- Source: `board_key`.

#### b. Agent API Key
- Token format: `pcp_<48 hex chars>`
- SHA-256 hash lookup in `agent_api_keys` table.
- Validates: not revoked, agent exists, agent not `terminated` or `pending_approval`.
- Touches `lastUsedAt` on each use.
- Source: `agent_key`.

#### c. Agent JWT (fallback)
- HS256 JWT signed with `PAPERCLIP_AGENT_JWT_SECRET` or `BETTER_AUTH_SECRET`.
- Validates: signature, expiry, issuer (`paperclip`), audience (`paperclip-api`).
- Verifies agent exists and belongs to claimed company.
- Source: `agent_jwt`.

### 3. Extra Headers

- `X-Paperclip-Run-Id`: Attaches a run ID to the actor context (used for checkout ownership).

---

## Session Auth (Better Auth)

Paperclip integrates the `better-auth` library for email/password authentication with session cookies.

**Key files**: `server/src/auth/better-auth.ts`

- **Email/password** enabled, email verification **not** required.
- Sign-up can be disabled via `config.authDisableSignUp`.
- Secret sourced from `BETTER_AUTH_SECRET` or `PAPERCLIP_AGENT_JWT_SECRET`.
- Secure cookies disabled when public URL uses `http://`.
- Route handler mounted at `/api/auth/{*authPath}`.
- Session resolution: passes Express request headers to Better Auth's internal `api.getSession()`.

### Synthetic Session Endpoint

`GET /api/auth/get-session` returns a session object for the current actor. In `local_trusted` mode, returns `"Local Board"` as user name.

---

## Board API Keys

**Table**: `board_api_keys`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `userId` | string | References Better Auth `user.id` |
| `name` | string | Human label |
| `keyHash` | string | SHA-256 hash of token |
| `lastUsedAt` | timestamp | Updated on each use |
| `revokedAt` | timestamp | Soft-delete for revocation |
| `expiresAt` | timestamp | TTL-based expiration (default: 30 days) |

**Token format**: `pcp_board_<48 hex chars>`

### CLI Auth Challenge Flow

A device-authorization-like flow for CLI tools to obtain board API keys:

1. **CLI creates challenge**: `POST /cli-auth/challenges` → receives `id`, `token`, `boardApiToken`, `approvalUrl`.
2. **User visits approval URL** in browser (must be signed in).
3. **User approves**: `POST /cli-auth/challenges/:id/approve` → board API key activated.
4. **CLI polls**: `GET /cli-auth/challenges/:id?token=...` until status = `approved`.
5. **CLI uses `boardApiToken`** as Bearer token for all subsequent API calls.

**Revocation**: `POST /cli-auth/revoke-current` — a board key holder revokes its own key.

---

## Agent API Keys

**Table**: `agent_api_keys`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `agentId` | string | References `agents.id` |
| `companyId` | string | References `companies.id` |
| `name` | string | Human label |
| `keyHash` | string | SHA-256 hash of token |
| `lastUsedAt` | timestamp | Updated on each use |
| `revokedAt` | timestamp | Soft-delete for revocation |

**Token format**: `pcp_<48 hex chars>`

**Restrictions**: Cannot create keys for agents with status `pending_approval` or `terminated`.

**Creation paths**:
1. Join request claim flow: `POST /api/join-requests/:requestId/claim-api-key`
2. Direct creation by board users: `POST /api/agents/:agentId/keys`

---

## Agent JWT Tokens

**File**: `server/src/agent-auth-jwt.ts`

Custom minimal HS256 JWT implementation (no external JWT library).

### JWT Claims

| Claim | Description |
|-------|-------------|
| `sub` | Agent ID |
| `company_id` | Company the agent belongs to |
| `adapter_type` | Agent's adapter type |
| `run_id` | Heartbeat run ID |
| `iat` | Issued-at timestamp |
| `exp` | Expiration (default: 48 hours) |
| `iss` | Issuer (default: `"paperclip"`) |
| `aud` | Audience (default: `"paperclip-api"`) |
| `jti` | Optional JWT ID |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PAPERCLIP_AGENT_JWT_SECRET` | (from `BETTER_AUTH_SECRET`) | HMAC signing key |
| `PAPERCLIP_AGENT_JWT_TTL_SECONDS` | `172800` (48h) | Token lifetime |
| `PAPERCLIP_AGENT_JWT_ISSUER` | `"paperclip"` | JWT issuer |
| `PAPERCLIP_AGENT_JWT_AUDIENCE` | `"paperclip-api"` | JWT audience |

Agent JWTs provide short-lived, run-scoped credentials used by the adapter framework during heartbeat runs.

---

## Board Claim (Instance Bootstrapping)

When the server starts in `authenticated` mode with only the default `local-board` admin:

1. Server generates a one-time claim token + code (24-hour TTL).
2. Warning URL displayed in startup banner.
3. User visits URL, signs in, calls `POST /board-claim/:token/claim`.
4. Claiming user promoted to `instance_admin`, `local-board` removed.
5. User gets `owner` membership in all existing companies.

---

## Permission System

### Instance-Level Roles

**Table**: `instance_user_roles`

Only one role: `instance_admin` — global superuser that bypasses all company-level permission checks.

### Company Memberships

**Table**: `company_memberships`

| Column | Description |
|--------|-------------|
| `companyId` | FK to companies |
| `principalType` | `"user"` or `"agent"` |
| `principalId` | User ID or agent ID |
| `status` | `"pending"`, `"active"`, `"suspended"` |
| `membershipRole` | e.g., `"owner"`, `"member"` |

### Permission Keys

Six fine-grained permissions stored in `principal_permission_grants`:

| Key | Description |
|-----|-------------|
| `agents:create` | Create new agents in the company |
| `users:invite` | Create invite links |
| `users:manage_permissions` | View/modify member permission grants |
| `tasks:assign` | Assign issues to agents |
| `tasks:assign_scope` | Scoped variant of task assignment |
| `joins:approve` | Approve/reject join requests |

### Permission Resolution

```
isInstanceAdmin(userId)?       → full access
  ↓ no
canUser(companyId, userId, key)?
  = hasActiveMembership(companyId, userId) AND hasPermissionGrant(companyId, userId, key)
```

For agents:
```
agent.companyId === targetCompanyId?  → company access
  + hasPermission(companyId, "agent", agentId, key)?  → operation access
```

### Agent Legacy Permissions

Agents have a JSONB `permissions` column on the `agents` table:

```typescript
{ canCreateAgents: boolean }  // true for CEO agents, false for others
```

---

## Authorization Guards

Four route-level guard functions in `server/src/routes/authz.ts`:

| Guard | Checks |
|-------|--------|
| `assertBoard(req)` | Actor type must be `board` |
| `assertInstanceAdmin(req)` | Board + instance_admin or local_implicit |
| `assertCompanyAccess(req, companyId)` | Agent: same company. Board: companyIds includes target. None: 401. |
| `getActorInfo(req)` | Extracts standardized actor metadata for activity logging |

### CSRF Protection

`boardMutationGuard` middleware protects non-safe HTTP methods (POST/PUT/PATCH/DELETE):

- Skips for non-board actors and non-browser contexts (board_key, local_implicit).
- For session-based board users: validates `Origin`/`Referer` against trusted origins.
- Returns 403 on untrusted origins.

### WebSocket Authentication

WebSocket connections to `/api/companies/:companyId/events/ws`:

1. Accept Bearer token from `Authorization` header or `?token=` query param.
2. No token: `local_trusted` → allow as board; `authenticated` → resolve session from cookies.
3. Token present: look up in `agent_api_keys`, validate company match.
4. Reject upgrade if auth fails.

---

## Key Files

| File | Purpose |
|------|---------|
| `server/src/middleware/auth.ts` | Core actor resolution middleware |
| `server/src/auth/better-auth.ts` | Better Auth integration |
| `server/src/agent-auth-jwt.ts` | Agent JWT creation/verification |
| `server/src/routes/authz.ts` | Authorization guard functions |
| `server/src/services/board-auth.ts` | Board API keys, CLI auth challenge |
| `server/src/services/access.ts` | Permission checking service |
| `server/src/services/agent-permissions.ts` | Legacy agent role-based permissions |
| `server/src/board-claim.ts` | Instance bootstrapping |
| `server/src/middleware/board-mutation-guard.ts` | CSRF protection |
| `server/src/routes/access.ts` | Access/invite/join/permission endpoints |
| `server/src/realtime/live-events-ws.ts` | WebSocket auth |
