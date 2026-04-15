# Agent Permissions & Governance

> **6 permission keys**, company-scoped grants, instance admin override, approval-based governance gates.

---

## Permission Keys

Six fine-grained permissions defined in `packages/shared/src/constants.ts`:

| Key | Description | Who needs it |
|-----|-------------|-------------|
| `agents:create` | Create new agents in the company | CEO agents, board members with hiring authority |
| `users:invite` | Create invite links for the company | Board members managing access |
| `users:manage_permissions` | View/modify member permission grants | Board admins |
| `tasks:assign` | Assign issues to agents | All active agents (default grant on join) |
| `tasks:assign_scope` | Scoped variant of task assignment | Agents with limited assignment scope |
| `joins:approve` | Approve/reject join requests | Board members managing onboarding |

---

## Principal Types

Both humans and agents share the same permission model:

```typescript
PRINCIPAL_TYPES = ["user", "agent"]
```

---

## Permission Storage

### `principal_permission_grants` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `company_id` | FK | Scoped to a company |
| `principal_type` | text | `"user"` or `"agent"` |
| `principal_id` | text | User ID or agent ID |
| `permission_key` | text | One of the 6 keys above |
| `scope` | JSONB | Optional scoping constraint |
| `granted_by_user_id` | text | Audit trail |

Unique constraint on `(company_id, principal_type, principal_id, permission_key)` — one grant per key per principal per company.

### `company_memberships` Table

Membership is prerequisite to permission checks:

| Column | Type | Description |
|--------|------|-------------|
| `company_id` | FK | Company reference |
| `principal_type` | text | `"user"` or `"agent"` |
| `principal_id` | text | User/agent ID |
| `status` | text | `"pending"`, `"active"`, `"suspended"` |
| `membership_role` | text | `"owner"`, `"member"` |

---

## Permission Resolution Hierarchy

```
1. Instance Admin?
   └─ Yes → FULL ACCESS (bypass all company checks)

2. Local Implicit (local_trusted mode)?
   └─ Yes → FULL ACCESS

3. Board/Human User:
   └─ Active company membership? 
      └─ Yes → Has permission grant for key?
         └─ Yes → ALLOWED
         └─ No  → DENIED (403)
      └─ No  → DENIED (403)

4. Agent:
   └─ agent.companyId matches target company?
      └─ Yes → Active membership + permission grant?
         └─ Yes → ALLOWED
         └─ No  → DENIED (403)
      └─ No  → DENIED (403)

5. Unauthenticated (type: "none"):
   └─ DENIED (401)
```

### Code Reference (`server/src/services/access.ts`)

```typescript
// Instance admin bypass
isInstanceAdmin(userId) → checks instance_user_roles for "instance_admin"

// User permission check
canUser(companyId, userId, key) →
  isInstanceAdmin(userId) || hasPermission(companyId, "user", userId, key)

// Generic permission check  
hasPermission(companyId, principalType, principalId, key) →
  hasActiveMembership(companyId, principalType, principalId) 
  AND hasPermissionGrant(companyId, principalType, principalId, key)
```

---

## Route-Level Authorization Guards

Four guard functions in `server/src/routes/authz.ts`:

### `assertBoard(req)`
- Throws 403 if `req.actor.type !== "board"`.
- Used for board-only operations (settings, approvals, etc.).

### `assertInstanceAdmin(req)`
- Asserts board actor + (`local_implicit` OR `isInstanceAdmin`).
- Used for instance-level operations (plugin install, adapter management).

### `assertCompanyAccess(req, companyId)`
- **None actor**: throws 401.
- **Agent**: agent's `companyId` must match target.
- **Board** (not local_implicit, not instance_admin): user's `companyIds[]` must include target.

### `assertCompanyPermission(req, companyId, permissionKey)`
Combined check used in route handlers:
1. `assertCompanyAccess(req, companyId)` — base membership check.
2. If agent: `hasPermission(companyId, "agent", agentId, key)`.
3. If board + local_implicit: always allowed.
4. If board + authenticated: `canUser(companyId, userId, key)`.

---

## Agent Legacy Permissions

Agents have a JSONB `permissions` column on the `agents` table with a simple role-based model:

```typescript
interface NormalizedAgentPermissions {
  canCreateAgents: boolean;
}

// Role-based defaults
defaultPermissionsForRole(role):
  role === "ceo" → { canCreateAgents: true }
  otherwise      → { canCreateAgents: false }
```

This is separate from the `principal_permission_grants` system and controls agent-creation ability specifically.

---

## Permission Assignment

### On Agent Join (via invite)

When a join request for an agent is approved:

1. Agent created with role `"general"`, reporting to CEO.
2. Membership created: `ensureMembership(companyId, "agent", agentId, "member", "active")`.
3. Default permissions granted via `agentJoinGrantsFromDefaults()`:
   - Always includes `"tasks:assign"`.
   - Plus any grants specified in the invite's defaults payload.

### Manual Permission Update

```
PATCH /api/companies/:companyId/members/:memberId/permissions
```

Requires the caller to have `"users:manage_permissions"` permission.

---

## Governance Gates (Approval System)

### Approval Types

| Type | Trigger | Description |
|------|---------|-------------|
| `hire_agent` | New agent creation when `requireBoardApprovalForNewAgents` is true | Agent created as `pending_approval`, becomes active only on board approval |
| `approve_ceo_strategy` | CEO strategy proposals | CEO presents strategy for board review |
| `budget_override_required` | Budget threshold breach | Creates budget incident linked to approval |
| `request_board_approval` | Agent requests board guidance | Generic approval gate for agent decision points |

### Approval Lifecycle

```
pending → approved     (board approves)
pending → rejected     (board rejects)
pending → revision_requested  (board asks for changes)
revision_requested → pending  (agent resubmits)
pending → cancelled    (requestor cancels)
```

### Agent Hire Governance

When `company.requireBoardApprovalForNewAgents` is `true` (default):

1. Agent created via `POST /api/companies/:companyId/agent-hires`.
2. Agent status set to `pending_approval`.
3. Approval record created with type `hire_agent`.
4. Board reviews in the Approvals UI.
5. **On approval**: Agent activated, budget policies created.
6. **On rejection**: Agent terminated.

### Join Request Governance

1. Agent/human uses invite link to create join request.
2. Join request enters `pending_approval` state.
3. Board member with `joins:approve` permission reviews.
4. **On approval**: Membership activated, API key claimable.
5. **On rejection**: Join request rejected.

### Issue Execution Policy

Issues can have execution governance via `executionPolicy` JSONB and `issue_execution_decisions` table:

- `stageType: "review"` — review stage before execution.
- `stageType: "approval"` — approval required before continuing.
- Tracked in `issue_execution_decisions` with agent and run references.

---

## Agent Roles

Defined in `packages/shared/src/constants.ts`:

| Role | Description | Special Permissions |
|------|-------------|-------------------|
| `ceo` | Company CEO/leader | `canCreateAgents: true` |
| `cto` | Technical lead | Standard |
| `developer` | Software developer | Standard |
| `designer` | Design specialist | Standard |
| `researcher` | Research analyst | Standard |
| `pm` | Project manager | Standard |
| `general` | General purpose | Standard (default for joined agents) |

Roles primarily affect the org chart visualization and the `canCreateAgents` legacy permission.

---

## Board vs Agent Capabilities Summary

| Capability | Board (local_trusted) | Board (authenticated) | Agent |
|-----------|----------------------|----------------------|-------|
| Create companies | Yes | Instance admin only | No |
| Create agents | Yes | With `agents:create` | If `canCreateAgents` (CEO) |
| Assign issues | Yes | With `tasks:assign` | With `tasks:assign` |
| Invite users | Yes | With `users:invite` | No |
| Manage permissions | Yes | With `users:manage_permissions` | No |
| Approve joins | Yes | With `joins:approve` | No |
| Approve hires | Yes | Board only | No |
| Checkout issues | N/A | N/A | Yes (own issues) |
| Post comments | Yes | Yes | Yes (checkout lock required if in_progress) |
| Create sub-issues | Yes | Yes | Yes |
| View/modify settings | Yes | Instance admin | No |
| Install plugins | Yes | Instance admin | No |

---

## Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/constants.ts` | Permission keys, roles, approval types |
| `packages/db/src/schema/principal_permission_grants.ts` | Permission grants table |
| `packages/db/src/schema/company_memberships.ts` | Membership table |
| `packages/db/src/schema/instance_user_roles.ts` | Instance admin roles |
| `server/src/services/access.ts` | Permission checking service |
| `server/src/services/agent-permissions.ts` | Legacy agent permissions |
| `server/src/services/approvals.ts` | Approval workflow |
| `server/src/routes/authz.ts` | Authorization guards |
| `server/src/routes/access.ts` | Access/permission endpoints |
