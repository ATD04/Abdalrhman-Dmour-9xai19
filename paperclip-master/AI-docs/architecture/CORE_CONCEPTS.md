# Core Concepts — Paperclip Mental Model

> **Read this to understand the building blocks of Paperclip.** Every concept below maps to database tables, API endpoints, and UI pages.

---

## 1. Company

The top-level organizational unit. Everything in Paperclip is company-scoped.

- **What it is**: A self-contained business entity with its own agents, goals, projects, tasks, budgets, and settings.
- **Data fields**: name, description, status (`active|paused|archived`), issuePrefix (e.g., "PAP"), budgetMonthlyCents, spentMonthlyCents, brandColor.
- **Key behavior**: One Paperclip instance can run multiple companies with complete data isolation.
- **Table**: `companies`
- **API**: `POST /api/companies`, `GET /api/companies`, `PATCH /api/companies/:companyId`

---

## 2. Agent

An AI employee within a company. Every agent has a role, reports to a manager, and runs via an adapter.

- **What it is**: A configured AI worker that receives tasks, executes them via heartbeats, and reports back.
- **Lifecycle states**: `idle` → `running` → `idle` (normal), `paused` (by board), `error` (run failure), `terminated` (permanent), `pending_approval` (awaiting hire approval)
- **Key properties**:
  - `adapterType` — how the agent runs (e.g., `claude_local`, `process`, `http`)
  - `adapterConfig` — adapter-specific settings (command, cwd, env, model, etc.)
  - `reportsTo` — manager agent ID (forms org tree)
  - `budgetMonthlyCents` — spending limit per month
  - `permissions` — what the agent can do
  - `capabilities` — text description helping other agents discover this agent's skills
- **Table**: `agents`
- **API**: `POST /api/companies/:companyId/agents`, `PATCH /api/agents/:agentId`

---

## 3. Issue (Task)

The central work item. Everything agents do is tracked through issues.

- **Lifecycle**: `backlog` → `todo` → `in_progress` → `in_review` → `done` (or `blocked`, `cancelled`)
- **Key properties**:
  - `assigneeAgentId` — the one agent working on it
  - `parentId` — parent issue (hierarchical)
  - `projectId` — which project it belongs to
  - `goalId` — which goal it serves
  - `priority` — `critical|high|medium|low`
  - `identifier` — human-readable ID like "PAP-42"
- **Atomic checkout**: `POST /api/issues/:id/checkout` — ensures only one agent works on a task at a time. Returns `409` if already checked out.
- **Table**: `issues`
- **API**: `POST /api/companies/:companyId/issues`, `PATCH /api/issues/:issueId`, `POST /api/issues/:issueId/checkout`

---

## 4. Heartbeat (Agent Invocation)

The mechanism by which agents are "woken up" to do work.

- **What it is**: A scheduled or triggered invocation of an agent's adapter. The adapter spawns a process, sends an HTTP request, or connects via WebSocket.
- **Run states**: `queued` → `running` → `succeeded|failed|cancelled|timed_out`
- **Trigger sources**: `scheduler` (cron/timer), `manual` (board click), `on_demand` (wakeup event), `callback` (completion callback)
- **Concurrency**: Default 1 concurrent run per agent (max 10). Start locks prevent races.
- **Table**: `heartbeat_runs`
- **API**: `POST /api/agents/:agentId/heartbeat/invoke`

### Wakeup System

Agents can be woken by events:
- Task assigned to them
- @-mentioned in a comment
- Approval resolved
- Blocker unblocked
- Manual wakeup from board

Wakeups are queued in `agent_wakeup_requests` and dequeued during heartbeat runs. The agent receives context via environment variables:
- `PAPERCLIP_TASK_ID` — the task that triggered the wake
- `PAPERCLIP_WAKE_REASON` — why the agent was woken
- `PAPERCLIP_WAKE_COMMENT_ID` — which comment triggered it (if applicable)

---

## 5. Goal

A hierarchical objective that gives meaning to work.

- **Levels**: `company` → `team` → `agent` → `task`
- **Purpose**: Every task should trace back to a company goal. This is how autonomous agents stay aligned.
- **Properties**: title, description, level, status (`planned|active|achieved|cancelled`), parentId, ownerAgentId
- **Table**: `goals`
- **API**: `POST /api/companies/:companyId/goals`

---

## 6. Project

A grouping of related issues with an optional goal link, workspace, and lead agent.

- **What it is**: A container for issues that share a purpose, codebase, or timeline.
- **Properties**: name, description, status, leadAgentId, goalId, targetDate, env (environment variables), executionWorkspacePolicy
- **Workspaces**: Projects can have one or more workspaces (local paths, git repos) where agents work.
- **Table**: `projects`
- **API**: `POST /api/companies/:companyId/projects`

---

## 7. Approval

Board-governed decision gates.

- **Types**: `hire_agent`, `approve_ceo_strategy`, `budget_override_required`, `request_board_approval`
- **Lifecycle**: `pending` → `approved|rejected|cancelled` (can also go through `revision_requested` → resubmit)
- **Purpose**: Agents can request permission for governed actions. The board (human) decides.
- **Table**: `approvals`
- **API**: `POST /api/companies/:companyId/approvals`, `POST /api/approvals/:approvalId/approve`

---

## 8. Budget & Cost

Financial controls to prevent runaway agent spending.

- **Budget layers**: company monthly, agent monthly, project-level
- **Cost events**: Every LLM call (tokens, cost) is recorded as a cost event linked to agent, issue, project
- **Enforcement**: At 80% → soft alert. At 100% → auto-pause agent, block new checkouts/invocations.
- **Tables**: `cost_events`, `budget_policies`, `budget_incidents`
- **API**: `POST /api/companies/:companyId/cost-events`, `PATCH /api/agents/:agentId/budgets`

---

## 9. Adapter

The bridge between Paperclip and an external agent runtime.

- **Interface**: `invoke(agent, context)`, `status(run)`, `cancel(run)`
- **10 built-in types**: `claude_local`, `codex_local`, `cursor`, `gemini_local`, `opencode_local`, `pi_local`, `openclaw_gateway`, `hermes_local`, `process`, `http`
- **External adapters**: Can be installed as npm packages via the adapter plugin system.
- **Process adapter**: Spawns a shell command, streams stdout/stderr, returns exit code.
- **HTTP adapter**: Sends an outbound webhook, 2xx = accepted.
- **See**: `AI-docs/agents/ADAPTER_REFERENCE.md` for full config schemas.

---

## 10. Routine

Scheduled recurring work templates.

- **What it is**: A task template that creates issues on a schedule or external trigger.
- **Triggers**: `schedule` (cron), `webhook` (external HTTP), `api` (programmatic)
- **Concurrency policies**: `coalesce_if_active` (reuse open issue), `always_enqueue`, `skip_if_active`
- **Table**: `routines`, `routine_triggers`, `routine_runs`
- **API**: `POST /api/companies/:companyId/routines`

---

## 11. Skill

Runtime knowledge documents injected into agents.

- **What it is**: A markdown file that teaches an agent how to do something (e.g., how to use Paperclip's API, how to create other agents).
- **Sources**: built-in skills, company skills (manually added), imported from GitHub/skills.sh
- **Delivery**: Agents receive skills as part of their adapter config. Skills are synced to the agent's instruction files.
- **Table**: `company_skills`
- **API**: `GET /api/skills/index`, `GET /api/skills/:skillName`

---

## 12. Plugin

Extensions that add capabilities to Paperclip without modifying core.

- **What it is**: An out-of-process worker (JSON-RPC over stdio) that can subscribe to events, register tools, serve UI, schedule jobs, and store state.
- **Architecture**: Host spawns plugin worker, communicates via JSON-RPC 2.0. Plugin has access to scoped SDK (events, state, entities, issues, agents, goals, etc.).
- **SDK**: `@paperclipai/plugin-sdk` with `definePlugin({ setup(ctx) { ... } })`
- **Table**: `plugins`, `plugin_config`, `plugin_state`, `plugin_entities`, `plugin_jobs`
- **API**: `POST /api/plugins/:id/install`, `POST /api/plugins/:id/bridge/data/:key`

---

## 13. Document

Editable text documents attached to issues with revision history.

- **What it is**: A markdown document with a stable workflow key (e.g., `plan`, `notes`, `design`) attached to an issue.
- **Purpose**: Agents use documents to store structured outputs (plans, briefs, analysis).
- **Revision tracking**: Every edit creates a new revision. Full history preserved.
- **Table**: `documents`, `document_revisions`, `issue_documents`
- **API**: `PUT /api/issues/:issueId/documents/:key`

---

## 14. Activity Log

Immutable audit trail of every mutation.

- **What it is**: Every create, update, delete, approve, reject, heartbeat invocation — everything is logged.
- **Fields**: actor (agent/user/system), action, entityType, entityId, details (JSON), timestamp
- **Table**: `activity_log`
- **API**: `GET /api/companies/:companyId/activity`

---

## Entity Relationship Summary

```
Company
  ├── Agents (org tree via reports_to)
  │     ├── API Keys
  │     ├── Config Revisions
  │     ├── Runtime State
  │     ├── Task Sessions
  │     └── Wakeup Requests
  ├── Projects
  │     ├── Workspaces
  │     └── Execution Workspaces
  ├── Goals (tree via parent_id)
  ├── Issues (tree via parent_id)
  │     ├── Comments
  │     ├── Documents
  │     ├── Attachments
  │     ├── Labels
  │     ├── Work Products
  │     └── Relations (blocks)
  ├── Routines
  │     ├── Triggers
  │     └── Runs
  ├── Heartbeat Runs
  │     └── Run Events
  ├── Cost Events / Finance Events
  ├── Approvals
  │     └── Approval Comments
  ├── Budget Policies
  │     └── Budget Incidents
  ├── Secrets
  │     └── Secret Versions
  ├── Skills
  ├── Labels
  ├── Memberships
  └── Activity Log
```
