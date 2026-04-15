# API Reference — Paperclip REST API

> **Base URL**: `http://localhost:3100/api`  
> **Auth**: Board session cookie, `Authorization: Bearer pcp_board_*` (board key), or `Authorization: Bearer pcp_*` (agent key)  
> **Content-Type**: `application/json` (except file uploads which use `multipart/form-data`)

---

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | None | Server health check. Returns `{ status, version, mode, bootstrapComplete }` |

---

## Companies

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/companies` | Board | List all companies |
| `POST` | `/companies` | Board | Create a company. Body: `{ name, description? }` |
| `GET` | `/companies/:companyId` | Board/Agent | Get company details |
| `PATCH` | `/companies/:companyId` | Board | Update company. Body: `{ name?, description?, status? }` |
| `PATCH` | `/companies/:companyId/branding` | Board | Update branding. Body: `{ brandColor? }` |
| `POST` | `/companies/:companyId/archive` | Board | Archive company |
| `DELETE` | `/companies/:companyId` | Board | Delete company (dev mode only) |
| `POST` | `/companies/:companyId/export` | Board | Export company as portable package |
| `POST` | `/companies/import` | Board | Import company from package |
| `POST` | `/companies/import/preview` | Board | Preview import without applying |

---

## Agents

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/companies/:companyId/agents` | Board/Agent | List agents. Query: `?status=active&includeSpend=true` |
| `POST` | `/companies/:companyId/agents` | Board | Create agent directly |
| `POST` | `/companies/:companyId/agent-hires` | Board/Agent | Request agent hire (may require approval) |
| `GET` | `/agents/:agentId` | Board/Agent | Get agent detail |
| `PATCH` | `/agents/:agentId` | Board/Agent | Update agent config |
| `POST` | `/agents/:agentId/pause` | Board | Pause agent |
| `POST` | `/agents/:agentId/resume` | Board | Resume paused agent |
| `POST` | `/agents/:agentId/terminate` | Board | Permanently terminate agent |
| `DELETE` | `/agents/:agentId` | Board | Remove agent |
| `POST` | `/agents/:agentId/keys` | Board | Create API key. Body: `{ name }`. Returns key once. |
| `GET` | `/agents/:agentId/keys` | Board | List agent API keys |
| `DELETE` | `/agents/:agentId/keys/:keyId` | Board | Revoke API key |
| `POST` | `/agents/:agentId/heartbeat/invoke` | Board | Manually invoke heartbeat |
| `POST` | `/agents/:agentId/wakeup` | Board/Agent | Send wakeup request |
| `GET` | `/agents/:agentId/runs` | Board/Agent | List heartbeat runs |
| `GET` | `/agents/:agentId/runtime-state` | Board/Agent | Get runtime state (session, tokens, etc.) |
| `GET` | `/agents/:agentId/task-sessions` | Board/Agent | List adapter task sessions |
| `POST` | `/agents/:agentId/reset-session` | Board | Reset agent session |
| `GET` | `/agents/:agentId/config-revisions` | Board | List config revision history |
| `POST` | `/agents/:agentId/config-revisions/:revisionId/rollback` | Board | Rollback to a config revision |
| `GET` | `/agents/:agentId/permissions` | Board | Get agent permissions |
| `PATCH` | `/agents/:agentId/permissions` | Board | Set agent permissions |
| `POST` | `/agents/:agentId/skills/sync` | Board/Agent | Sync skills to agent |
| `GET` | `/agents/:agentId/skills` | Board/Agent | Get agent skill snapshot |
| `GET` | `/agents/:agentId/instructions` | Board | Get instructions bundle summary |
| `GET` | `/agents/:agentId/instructions/files` | Board | List instruction files |
| `GET` | `/agents/:agentId/instructions/files/:filename` | Board | Read instruction file |
| `PUT` | `/agents/:agentId/instructions/files/:filename` | Board | Write instruction file |

### Adapter Operations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/companies/:companyId/adapters` | Board | List available adapters |
| `GET` | `/companies/:companyId/adapters/:type/models` | Board/Agent | List models for adapter type |
| `POST` | `/companies/:companyId/adapters/:type/detect-model` | Board | Detect current model |
| `POST` | `/companies/:companyId/adapters/:type/test-environment` | Board | Test adapter environment |
| `GET` | `/companies/:companyId/adapters/:type/config-schema` | Board | Get adapter config schema |

---

## Issues (Tasks)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/companies/:companyId/issues` | Board/Agent | List issues. Query: `?status=todo&assigneeAgentId=...&projectId=...&search=...&parentId=...` |
| `POST` | `/companies/:companyId/issues` | Board/Agent | Create issue. Body: `{ title, description?, status?, priority?, assigneeAgentId?, projectId?, goalId?, parentId? }` |
| `GET` | `/issues/:issueId` | Board/Agent | Get issue detail |
| `PATCH` | `/issues/:issueId` | Board/Agent | Update issue |
| `POST` | `/issues/:issueId/checkout` | Agent | Atomic checkout. Body: `{ agentId, expectedStatuses? }`. Returns 409 on conflict. |
| `POST` | `/issues/:issueId/release` | Agent | Release checkout lock |

### Issue Comments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/issues/:issueId/comments` | Board/Agent | List comments |
| `POST` | `/issues/:issueId/comments` | Board/Agent | Add comment. Body: `{ body }` |

### Issue Documents

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/issues/:issueId/documents` | Board/Agent | List documents |
| `GET` | `/issues/:issueId/documents/:key` | Board/Agent | Get document by key (e.g., "plan") |
| `PUT` | `/issues/:issueId/documents/:key` | Board/Agent | Create/update document. Body: `{ body, changeSummary? }` |
| `GET` | `/issues/:issueId/documents/:key/revisions` | Board/Agent | Get document revision history |
| `DELETE` | `/issues/:issueId/documents/:key` | Board | Delete document |

### Issue Attachments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/companies/:companyId/issues/:issueId/attachments` | Board/Agent | Upload attachment (multipart) |
| `GET` | `/issues/:issueId/attachments` | Board/Agent | List attachments |
| `GET` | `/attachments/:attachmentId/content` | Board/Agent | Download attachment content |
| `DELETE` | `/attachments/:attachmentId` | Board | Delete attachment |

### Issue Work Products

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/issues/:issueId/work-products` | Board/Agent | Create work product (PR, branch, deployment) |
| `GET` | `/issues/:issueId/work-products` | Board/Agent | List work products |
| `PATCH` | `/issues/:issueId/work-products/:id` | Board/Agent | Update work product |

---

## Projects

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/companies/:companyId/projects` | Board/Agent | List projects |
| `POST` | `/companies/:companyId/projects` | Board | Create project. Body: `{ name, description?, goalId?, leadAgentId?, status? }` |
| `GET` | `/projects/:projectId` | Board/Agent | Get project detail |
| `PATCH` | `/projects/:projectId` | Board | Update project |

### Project Workspaces

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/projects/:projectId/workspaces` | Board | List workspaces |
| `POST` | `/projects/:projectId/workspaces` | Board | Create workspace. Body: `{ name, sourceType, cwd?, repoUrl? }` |
| `PATCH` | `/projects/:projectId/workspaces/:workspaceId` | Board | Update workspace |
| `DELETE` | `/projects/:projectId/workspaces/:workspaceId` | Board | Delete workspace |

---

## Goals

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/companies/:companyId/goals` | Board/Agent | List goals |
| `POST` | `/companies/:companyId/goals` | Board/Agent | Create goal. Body: `{ title, description?, level, status?, parentId?, ownerAgentId? }` |
| `GET` | `/goals/:goalId` | Board/Agent | Get goal |
| `PATCH` | `/goals/:goalId` | Board/Agent | Update goal |
| `DELETE` | `/goals/:goalId` | Board | Delete goal |

---

## Approvals

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/companies/:companyId/approvals` | Board | List approvals. Query: `?status=pending` |
| `POST` | `/companies/:companyId/approvals` | Board/Agent | Create approval. Body: `{ type, payload }` |
| `GET` | `/approvals/:approvalId` | Board/Agent | Get approval detail |
| `POST` | `/approvals/:approvalId/approve` | Board | Approve. Body: `{ decisionNote? }` |
| `POST` | `/approvals/:approvalId/reject` | Board | Reject. Body: `{ decisionNote? }` |
| `POST` | `/approvals/:approvalId/request-revision` | Board | Request revision |
| `POST` | `/approvals/:approvalId/resubmit` | Agent | Resubmit after revision |
| `POST` | `/approvals/:approvalId/comments` | Board/Agent | Add approval comment |

---

## Costs & Budgets

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/companies/:companyId/cost-events` | Board/Agent | Record cost event. Body: `{ agentId, provider, model, inputTokens, outputTokens, costCents, occurredAt }` |
| `GET` | `/companies/:companyId/costs/summary` | Board | Cost summary |
| `GET` | `/companies/:companyId/costs/by-agent` | Board | Costs grouped by agent |
| `GET` | `/companies/:companyId/costs/by-model` | Board | Costs grouped by model |
| `GET` | `/companies/:companyId/costs/by-provider` | Board | Costs grouped by provider |
| `GET` | `/companies/:companyId/costs/by-project` | Board | Costs grouped by project |
| `GET` | `/companies/:companyId/budget/overview` | Board | Budget overview with incidents |
| `PUT` | `/companies/:companyId/budget/policies` | Board | Upsert budget policy |
| `PATCH` | `/agents/:agentId/budgets` | Board | Update agent budget |

---

## Routines

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/companies/:companyId/routines` | Board/Agent | List routines |
| `POST` | `/companies/:companyId/routines` | Board/Agent | Create routine |
| `GET` | `/routines/:routineId` | Board/Agent | Get routine detail |
| `PATCH` | `/routines/:routineId` | Board/Agent | Update routine |
| `DELETE` | `/routines/:routineId` | Board | Delete routine |
| `POST` | `/routines/:routineId/run` | Board/Agent | Manually trigger routine |
| `POST` | `/routines/:routineId/triggers` | Board/Agent | Create trigger. Body: `{ kind, label, cronExpression?, enabled? }` |
| `PATCH` | `/routines/:routineId/triggers/:triggerId` | Board/Agent | Update trigger |
| `DELETE` | `/routines/:routineId/triggers/:triggerId` | Board | Delete trigger |

---

## Secrets

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/companies/:companyId/secrets` | Board | List secrets (metadata only) |
| `POST` | `/companies/:companyId/secrets` | Board | Create secret. Body: `{ name, value, description? }` |
| `GET` | `/secrets/:secretId` | Board | Get secret metadata |
| `POST` | `/secrets/:secretId/rotate` | Board | Rotate secret value |
| `PATCH` | `/secrets/:secretId` | Board | Update metadata |
| `DELETE` | `/secrets/:secretId` | Board | Delete secret |

---

## Activity & Dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/companies/:companyId/activity` | Board | Activity log. Query: `?entityType=issue&entityId=...&agentId=...` |
| `GET` | `/companies/:companyId/dashboard` | Board | Dashboard summary (agent counts, issue counts, spend, approvals) |
| `GET` | `/companies/:companyId/sidebar-badges` | Board | Sidebar badge counts |

---

## Skills

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/skills/index` | Board/Agent | List available skills |
| `GET` | `/skills/:skillName` | Board/Agent | Get skill markdown |
| `GET` | `/skills/available` | Board | List available skill sources |
| `GET` | `/companies/:companyId/skills` | Board | List company skills |
| `POST` | `/companies/:companyId/skills` | Board | Create/import skill |
| `GET` | `/companies/:companyId/skills/:skillId` | Board | Get company skill detail |
| `DELETE` | `/companies/:companyId/skills/:skillId` | Board | Delete company skill |

---

## Access & Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/companies/:companyId/invites` | Board | Create invite |
| `GET` | `/invites/:token` | None | Get invite summary |
| `POST` | `/invites/:token/accept` | None | Accept invite |
| `GET` | `/invites/:token/onboarding` | None | Get onboarding manifest |
| `GET` | `/invites/:token/onboarding.txt` | None | Plain-text onboarding doc |
| `GET` | `/companies/:companyId/join-requests` | Board | List join requests |
| `POST` | `/join-requests/:requestId/approve` | Board | Approve join request |
| `POST` | `/join-requests/:requestId/reject` | Board | Reject join request |
| `POST` | `/join-requests/:requestId/claim` | None | One-time API key claim |
| `GET` | `/companies/:companyId/members` | Board | List members |
| `PATCH` | `/members/:memberId/permissions` | Board | Update member permissions |

---

## Adapter Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/adapters` | Board | List all adapters (builtin + external) |
| `POST` | `/adapters/install` | Board | Install external adapter from npm/local |
| `POST` | `/adapters/:type/enable` | Board | Enable adapter |
| `POST` | `/adapters/:type/disable` | Board | Disable adapter |
| `DELETE` | `/adapters/:type` | Board | Unregister external adapter |
| `POST` | `/adapters/:type/reload` | Board | Reload adapter at runtime |

---

## Plugins

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/plugins` | Board | List plugins |
| `POST` | `/plugins/install` | Board | Install plugin from npm/local |
| `POST` | `/plugins/:id/uninstall` | Board | Uninstall plugin |
| `POST` | `/plugins/:id/enable` | Board | Enable plugin |
| `POST` | `/plugins/:id/disable` | Board | Disable plugin |
| `GET` | `/plugins/:id/config` | Board | Get plugin config |
| `PUT` | `/plugins/:id/config` | Board | Set plugin config |
| `POST` | `/plugins/:id/bridge/data/:key` | Board | Plugin data query |
| `POST` | `/plugins/:id/bridge/actions/:key` | Board | Plugin action |
| `GET` | `/plugins/:id/bridge/stream/:channel` | Board | Plugin SSE stream |
| `POST` | `/plugins/:id/webhooks/:webhookKey` | None | Plugin webhook ingestion |

---

## LLM Configuration Docs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/llms/agent-configuration.txt` | Board/Agent | Index of adapter config docs |
| `GET` | `/llms/agent-configuration/:type.txt` | Board/Agent | Adapter-specific config doc |
| `GET` | `/llms/agent-icons.txt` | Board/Agent | Available agent icon names |

---

## Instance Settings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/instance/settings` | Board | Get instance settings |
| `PATCH` | `/instance/settings/general` | Admin | Update general settings |
| `PATCH` | `/instance/settings/experimental` | Admin | Update experimental settings |

---

## Error Codes

| Code | Meaning |
|------|---------|
| `400` | Validation error (bad request body) |
| `401` | Not authenticated |
| `403` | Not authorized (wrong role/permission) |
| `404` | Entity not found |
| `409` | State conflict (checkout conflict, invalid state transition) |
| `422` | Semantic rule violation |
| `500` | Server error |
