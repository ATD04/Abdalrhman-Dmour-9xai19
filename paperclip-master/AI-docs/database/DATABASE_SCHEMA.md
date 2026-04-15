# Database Schema — Paperclip Data Model

> **ORM**: Drizzle ORM | **Database**: PostgreSQL (embedded PGlite or external) | **Schema files**: `packages/db/src/schema/`

---

## Schema Overview

Paperclip has 50+ tables organized into these domains:

| Domain | Tables | Purpose |
|--------|--------|---------|
| Company | companies, company_logos, company_memberships, company_secrets, company_secret_versions, company_skills | Core multi-tenant entities |
| Agent | agents, agent_api_keys, agent_config_revisions, agent_runtime_state, agent_task_sessions, agent_wakeup_requests | AI agent lifecycle and state |
| Issue | issues, issue_comments, issue_relations, issue_labels, issue_approvals, issue_attachments, issue_documents, issue_work_products, issue_execution_decisions, issue_inbox_archives, issue_read_states | Work items and task management |
| Project | projects, project_workspaces, project_goals, execution_workspaces, workspace_operations, workspace_runtime_services | Work organization and execution environments |
| Routine | routines, routine_triggers, routine_runs | Scheduled recurring tasks |
| Heartbeat | heartbeat_runs, heartbeat_run_events | Agent execution tracking |
| Finance | cost_events, finance_events | Cost and billing tracking |
| Budget | budget_policies, budget_incidents | Spending controls |
| Approval | approvals, approval_comments | Governance workflows |
| Goal | goals | Hierarchical objectives |
| Document | documents, document_revisions | Editable content with history |
| Asset | assets, issue_attachments | File storage metadata |
| Label | labels, issue_labels | Issue categorization |
| Access | invites, join_requests, principal_permission_grants, board_api_keys, cli_auth_challenges, inbox_dismissals | Auth and permissions |
| Auth | user, session, account, verification | Better Auth managed |
| Instance | instance_settings, instance_user_roles | Deployment-level config |
| Plugin | plugins, plugin_config, plugin_company_settings, plugin_state, plugin_entities, plugin_jobs, plugin_job_runs, plugin_webhook_deliveries, plugin_logs | Extension system |
| Activity | activity_log | Mutation audit trail |
| Feedback | feedback_votes, feedback_exports | Run quality tracking |

---

## Key Tables in Detail

### companies

The root entity. All business objects are scoped to a company.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | NOT NULL |
| description | text | nullable |
| status | text | "active" / "paused" / "archived" |
| issue_prefix | text | e.g., "PAP" (unique) |
| issue_counter | integer | Auto-increments for PAP-1, PAP-2, etc. |
| budget_monthly_cents | integer | Company-level budget |
| spent_monthly_cents | integer | Current month spending |
| require_board_approval_for_new_agents | boolean | Hire governance flag |
| brand_color | text | nullable |

### agents

AI workers organized in an org tree.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| company_id | uuid FK | -> companies.id |
| name | text | NOT NULL |
| role | text | "ceo", "engineer", "pm", etc. |
| title | text | nullable display title |
| icon | text | nullable icon name |
| status | text | "idle" / "running" / "paused" / "error" / "pending_approval" / "terminated" |
| reports_to | uuid FK | -> agents.id (self-ref, nullable = root) |
| capabilities | text | Natural language description |
| adapter_type | text | "claude_local", "process", etc. |
| adapter_config | jsonb | Adapter-specific configuration |
| runtime_config | jsonb | Runtime settings |
| budget_monthly_cents | integer | Agent-level budget |
| spent_monthly_cents | integer | Current month spending |
| permissions | jsonb | Permission flags |
| last_heartbeat_at | timestamptz | Last invocation time |
| metadata | jsonb | nullable additional data |

**Indexes**: (company_id, status), (company_id, reports_to)

### issues

The central work item table. Tasks, bugs, features — all are issues.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| company_id | uuid FK | -> companies.id |
| project_id | uuid FK | -> projects.id (nullable) |
| goal_id | uuid FK | -> goals.id (nullable) |
| parent_id | uuid FK | -> issues.id (self-ref, nullable) |
| title | text | NOT NULL |
| description | text | nullable (markdown) |
| status | text | "backlog" / "todo" / "in_progress" / "in_review" / "done" / "blocked" / "cancelled" |
| priority | text | "critical" / "high" / "medium" / "low" |
| assignee_agent_id | uuid FK | -> agents.id (single assignee) |
| issue_number | integer | Sequential within company (e.g., 42) |
| identifier | text | Full identifier (e.g., "PAP-42") unique |
| origin_kind | text | "manual" or "routine_execution" |
| request_depth | integer | Delegation depth counter |
| billing_code | text | Optional cost attribution |
| execution_workspace_id | uuid FK | -> execution_workspaces.id |
| started_at | timestamptz | Set on transition to in_progress |
| completed_at | timestamptz | Set on transition to done |
| cancelled_at | timestamptz | Set on transition to cancelled |

**Indexes**: (company_id, status), (company_id, assignee_agent_id, status), (company_id, parent_id), (company_id, project_id), unique(identifier)  
**GIN indexes**: title, description (trigram search)

### issue_comments

Discussion on issues. Agents and humans post comments.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| company_id | uuid FK | -> companies.id |
| issue_id | uuid FK | -> issues.id |
| author_agent_id | uuid FK | -> agents.id (nullable) |
| author_user_id | text | nullable |
| body | text | Markdown content |

### heartbeat_runs

Tracks every agent invocation.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| company_id | uuid FK | |
| agent_id | uuid FK | -> agents.id |
| invocation_source | text | "scheduler" / "manual" / "on_demand" / "callback" |
| status | text | "queued" / "running" / "succeeded" / "failed" / "cancelled" / "timed_out" |
| started_at | timestamptz | |
| finished_at | timestamptz | |
| error | text | Error message if failed |
| exit_code | integer | Process exit code |
| usage_json | jsonb | Token usage summary |
| session_id_before | text | Session state before run |
| session_id_after | text | Session state after run |
| log_store | text | Log storage backend |
| log_ref | text | Log file reference |

### goals

Hierarchical objectives.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| company_id | uuid FK | |
| title | text | NOT NULL |
| description | text | nullable |
| level | text | "company" / "team" / "agent" / "task" |
| status | text | "planned" / "active" / "achieved" / "cancelled" |
| parent_id | uuid FK | -> goals.id (self-ref) |
| owner_agent_id | uuid FK | -> agents.id |

### projects

Groups related issues with optional workspace and goal links.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| company_id | uuid FK | |
| name | text | NOT NULL |
| description | text | nullable |
| status | text | "backlog" / "planned" / "in_progress" / "completed" / "cancelled" |
| lead_agent_id | uuid FK | -> agents.id |
| goal_id | uuid FK | -> goals.id |
| target_date | date | nullable |
| env | jsonb | Project-level env vars (merged into agent runs) |
| execution_workspace_policy | jsonb | How workspaces are managed |

### approvals

Board governance decisions.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| company_id | uuid FK | |
| type | text | "hire_agent" / "approve_ceo_strategy" / "budget_override_required" / "request_board_approval" |
| requested_by_agent_id | uuid FK | |
| status | text | "pending" / "revision_requested" / "approved" / "rejected" / "cancelled" |
| payload | jsonb | Request details |
| decision_note | text | nullable |
| decided_by_user_id | text | |
| decided_at | timestamptz | |

### cost_events

Token/cost tracking per LLM call.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| company_id | uuid FK | |
| agent_id | uuid FK | -> agents.id |
| issue_id | uuid FK | nullable |
| project_id | uuid FK | nullable |
| heartbeat_run_id | uuid FK | nullable |
| provider | text | e.g., "anthropic", "openai", "google" |
| model | text | e.g., "claude-sonnet-4-6" |
| biller | text | Who to bill |
| input_tokens | integer | |
| output_tokens | integer | |
| cost_cents | integer | Cost in cents |
| occurred_at | timestamptz | |

### routines

Scheduled recurring task templates.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| company_id | uuid FK | |
| title | text | Issue title template |
| description | text | Issue description template |
| assignee_agent_id | uuid FK | Who runs the routine |
| project_id | uuid FK | nullable |
| status | text | "active" / "paused" / "archived" |
| concurrency_policy | text | "coalesce_if_active" / "always_enqueue" / "skip_if_active" |
| variables | jsonb | Template variables |

### routine_triggers

What triggers a routine.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| routine_id | uuid FK | |
| kind | text | "schedule" / "webhook" / "api" |
| cron_expression | text | Cron schedule (if schedule trigger) |
| enabled | boolean | |
| public_id | text | Public webhook ID |
| signing_mode | text | Webhook signature verification |

### activity_log

Immutable audit trail.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| company_id | uuid FK | |
| actor_type | text | "agent" / "user" / "system" |
| actor_id | text | UUID of the actor |
| action | text | e.g., "issue.created", "agent.paused" |
| entity_type | text | e.g., "issue", "agent" |
| entity_id | text | UUID of the affected entity |
| details | jsonb | Additional context |
| created_at | timestamptz | |

---

## Entity Relationship Diagram

```
                    ┌─────────────┐
                    │  companies  │
                    └──────┬──────┘
          ┌────────────────┼────────────────────────────────┐
          │                │                                │
     ┌────▼────┐     ┌────▼─────┐     ┌─────▼──────┐  ┌───▼────┐
     │ agents  │     │ projects │     │   goals    │  │ labels │
     └────┬────┘     └────┬─────┘     └─────┬──────┘  └────────┘
          │               │                 │
     ┌────▼─────────┐    │           (parent_id self-ref)
     │ agent tree   │    │
     │ (reports_to) │    │
     └──────────────┘    │
          │          ┌────▼──────────┐
          │          │ project_      │
          │          │ workspaces    │
          │          └───────────────┘
          │
     ┌────▼────────────────────────────────┐
     │              issues                  │
     │  assignee_agent_id -> agents         │
     │  project_id -> projects              │
     │  goal_id -> goals                    │
     │  parent_id -> issues (self-ref)      │
     └────┬────────────────────────────────┘
          │
    ┌─────┼──────────────┬──────────────┐
    │     │              │              │
┌───▼──┐ ┌▼──────────┐ ┌▼──────────┐ ┌▼──────────────┐
│comm- │ │ documents │ │ attach-   │ │ work_products │
│ents  │ │           │ │ ments     │ │               │
└──────┘ └───────────┘ └───────────┘ └───────────────┘
```

---

## Status Enums Reference

```
COMPANY_STATUSES:    active | paused | archived
AGENT_STATUSES:      active | paused | idle | running | error | pending_approval | terminated
ISSUE_STATUSES:      backlog | todo | in_progress | in_review | done | blocked | cancelled
ISSUE_PRIORITIES:    critical | high | medium | low
PROJECT_STATUSES:    backlog | planned | in_progress | completed | cancelled
GOAL_LEVELS:         company | team | agent | task
GOAL_STATUSES:       planned | active | achieved | cancelled
APPROVAL_TYPES:      hire_agent | approve_ceo_strategy | budget_override_required | request_board_approval
APPROVAL_STATUSES:   pending | revision_requested | approved | rejected | cancelled
RUN_STATUSES:        queued | running | succeeded | failed | cancelled | timed_out
ROUTINE_STATUSES:    active | paused | archived
TRIGGER_KINDS:       schedule | webhook | api
```

---

## Connection Setup

```typescript
// packages/db/src/client.ts
import postgres from 'postgres';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import * as schema from './schema/index.js';

export function createDb(url: string) {
  const sql = postgres(url);
  return drizzlePg(sql, { schema });
}
```

**Modes**:
- No `DATABASE_URL` → embedded PGlite at `~/.paperclip/instances/default/db/`
- `DATABASE_URL` set → external PostgreSQL
- Drizzle migrations in `packages/db/src/migrations/`
- Generate migration: `pnpm db:generate`
- Apply migration: `pnpm db:migrate`
