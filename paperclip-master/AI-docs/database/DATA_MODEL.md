# Data Model — Entity Relationship Overview

> **50+ tables** organized by domain. Company is the root entity — nearly everything is company-scoped.

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              COMPANY (root)                                     │
│                                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐                  │
│  │  AGENTS  │    │ PROJECTS │    │  GOALS   │    │ ROUTINES │                  │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘                  │
│       │               │               │               │                         │
│       │ reports_to    │ goal_id       │ parent_id     │ project_id              │
│       │ (self-ref)    │ lead_agent_id │ owner_agent_id│ goal_id                 │
│       │               │               │               │ assignee_agent_id       │
│       │               │               │               │ parent_issue_id         │
│       │          ┌────┴────┐     ┌────┴────┐          │                         │
│       │          │ PROJECT │     │ PROJECT │     ┌────┴──────┐                  │
│       │          │  GOALS  │     │  GOALS  │     │ ROUTINE   │                  │
│       │          │(junction)│    │(junction)│    │ TRIGGERS  │                  │
│       │          └─────────┘     └─────────┘    └────┬──────┘                  │
│       │                                              │                          │
│       │                    ┌──────────┐         ┌────┴──────┐                  │
│       ├───────────────────►│  ISSUES  │◄────────│ ROUTINE   │                  │
│       │  assignee_agent_id │          │         │   RUNS    │                  │
│       │  created_by_agent_id└──┬──────┘         └───────────┘                  │
│       │                       │                                                 │
│       │           ┌───────────┼────────────────────────────┐                   │
│       │           │           │                            │                    │
│       │     ┌─────┴──┐  ┌────┴─────┐  ┌──────────┐  ┌────┴─────┐             │
│       │     │COMMENTS│  │DOCUMENTS │  │ LABELS   │  │RELATIONS │             │
│       │     │        │  │(junction)│  │(junction)│  │(junction) │             │
│       │     └────────┘  └──────────┘  └──────────┘  └──────────┘             │
│       │                                                                        │
│  ┌────┴──────────┐                                                             │
│  │  HEARTBEAT    │                                                             │
│  │    RUNS       │                                                             │
│  └────┬──────────┘                                                             │
│       │                                                                        │
│  ┌────┴──────────┐    ┌──────────┐    ┌──────────┐                            │
│  │  RUN EVENTS   │    │  WAKEUP  │    │  AGENT   │                            │
│  │               │    │ REQUESTS │    │ SESSIONS │                            │
│  └───────────────┘    └──────────┘    └──────────┘                            │
│                                                                                │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐                 │
│  │APPROVALS │    │  COSTS   │    │ BUDGETS  │    │ ACTIVITY │                 │
│  │          │    │  EVENTS  │    │ POLICIES │    │   LOG    │                 │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘                 │
│                                                                                │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐                 │
│  │ SECRETS  │    │  ASSETS  │    │ INVITES  │    │  PLUGINS │                 │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘                 │
└─────────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────────────────┐
                    │       AUTH (cross-company)        │
                    │                                   │
                    │  ┌────────┐  ┌──────────────┐    │
                    │  │ USERS  │  │   SESSIONS   │    │
                    │  └───┬────┘  └──────────────┘    │
                    │      │                            │
                    │  ┌───┴─────────┐  ┌───────────┐  │
                    │  │ BOARD API   │  │ INSTANCE  │  │
                    │  │   KEYS      │  │   ROLES   │  │
                    │  └─────────────┘  └───────────┘  │
                    └──────────────────────────────────┘
```

---

## Foreign Key Reference

### Core Entities

#### `companies`
- **Root entity** — no foreign keys.
- Referenced by nearly every other table.

#### `agents`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | RESTRICT |
| `reports_to` | `agents.id` (self) | NO ACTION |

#### `projects`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | RESTRICT |
| `goal_id` | `goals.id` | NO ACTION |
| `lead_agent_id` | `agents.id` | NO ACTION |

#### `goals`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | RESTRICT |
| `parent_id` | `goals.id` (self) | NO ACTION |
| `owner_agent_id` | `agents.id` | NO ACTION |

#### `issues`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | RESTRICT |
| `project_id` | `projects.id` | NO ACTION |
| `project_workspace_id` | `project_workspaces.id` | SET NULL |
| `goal_id` | `goals.id` | NO ACTION |
| `parent_id` | `issues.id` (self) | NO ACTION |
| `assignee_agent_id` | `agents.id` | NO ACTION |
| `checkout_run_id` | `heartbeat_runs.id` | SET NULL |
| `execution_run_id` | `heartbeat_runs.id` | SET NULL |
| `created_by_agent_id` | `agents.id` | NO ACTION |
| `execution_workspace_id` | `execution_workspaces.id` | SET NULL |

#### `documents`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | RESTRICT |
| `created_by_agent_id` | `agents.id` | SET NULL |
| `updated_by_agent_id` | `agents.id` | SET NULL |

---

### Junction Tables

#### `project_goals` — Projects ↔ Goals
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `project_id` | `projects.id` | CASCADE |
| `goal_id` | `goals.id` | CASCADE |
| `company_id` | `companies.id` | RESTRICT |
- Composite PK: `(project_id, goal_id)`

#### `issue_labels` — Issues ↔ Labels
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `issue_id` | `issues.id` | CASCADE |
| `label_id` | `labels.id` | CASCADE |
| `company_id` | `companies.id` | CASCADE |
- Composite PK: `(issue_id, label_id)`

#### `issue_approvals` — Issues ↔ Approvals
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `issue_id` | `issues.id` | CASCADE |
| `approval_id` | `approvals.id` | CASCADE |
| `company_id` | `companies.id` | RESTRICT |
| `linked_by_agent_id` | `agents.id` | SET NULL |
- Composite PK: `(issue_id, approval_id)`

#### `issue_documents` — Issues ↔ Documents
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `issue_id` | `issues.id` | CASCADE |
| `document_id` | `documents.id` | CASCADE |
| `company_id` | `companies.id` | RESTRICT |

#### `issue_relations` — Issues ↔ Issues (blocking)
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `issue_id` | `issues.id` | CASCADE |
| `related_issue_id` | `issues.id` | CASCADE |
| `company_id` | `companies.id` | RESTRICT |
| `created_by_agent_id` | `agents.id` | SET NULL |

#### `issue_attachments` — Issues ↔ Assets
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `issue_id` | `issues.id` | CASCADE |
| `asset_id` | `assets.id` | CASCADE |
| `company_id` | `companies.id` | RESTRICT |
| `issue_comment_id` | `issue_comments.id` | SET NULL |

---

### Detail Tables

#### `issue_comments`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | RESTRICT |
| `issue_id` | `issues.id` | RESTRICT |
| `author_agent_id` | `agents.id` | NO ACTION |
| `created_by_run_id` | `heartbeat_runs.id` | SET NULL |

#### `labels`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | CASCADE |

#### `document_revisions`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | RESTRICT |
| `document_id` | `documents.id` | CASCADE |
| `created_by_agent_id` | `agents.id` | SET NULL |
| `created_by_run_id` | `heartbeat_runs.id` | SET NULL |

---

### Runtime / Execution

#### `heartbeat_runs`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | RESTRICT |
| `agent_id` | `agents.id` | RESTRICT |
| `wakeup_request_id` | `agent_wakeup_requests.id` | NO ACTION |
| `retry_of_run_id` | `heartbeat_runs.id` (self) | SET NULL |

#### `heartbeat_run_events`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | RESTRICT |
| `run_id` | `heartbeat_runs.id` | RESTRICT |
| `agent_id` | `agents.id` | RESTRICT |

#### `agent_wakeup_requests`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | RESTRICT |
| `agent_id` | `agents.id` | RESTRICT |

#### `agent_task_sessions`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | RESTRICT |
| `agent_id` | `agents.id` | RESTRICT |
| `last_run_id` | `heartbeat_runs.id` | NO ACTION |

#### `agent_api_keys`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `agent_id` | `agents.id` | RESTRICT |
| `company_id` | `companies.id` | RESTRICT |

---

### Workspace System

#### `project_workspaces`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | RESTRICT |
| `project_id` | `projects.id` | CASCADE |

#### `execution_workspaces`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | RESTRICT |
| `project_id` | `projects.id` | CASCADE |
| `project_workspace_id` | `project_workspaces.id` | SET NULL |
| `source_issue_id` | `issues.id` | SET NULL |
| `derived_from_execution_workspace_id` | `execution_workspaces.id` (self) | SET NULL |

#### `workspace_runtime_services`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | RESTRICT |
| `project_id` | `projects.id` | SET NULL |
| `project_workspace_id` | `project_workspaces.id` | SET NULL |
| `execution_workspace_id` | `execution_workspaces.id` | SET NULL |
| `issue_id` | `issues.id` | SET NULL |
| `owner_agent_id` | `agents.id` | SET NULL |
| `started_by_run_id` | `heartbeat_runs.id` | SET NULL |

---

### Routine System

#### `routines`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | CASCADE |
| `project_id` | `projects.id` | CASCADE |
| `goal_id` | `goals.id` | SET NULL |
| `parent_issue_id` | `issues.id` | SET NULL |
| `assignee_agent_id` | `agents.id` | NO ACTION |
| `created_by_agent_id` | `agents.id` | SET NULL |
| `updated_by_agent_id` | `agents.id` | SET NULL |

#### `routine_triggers`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | CASCADE |
| `routine_id` | `routines.id` | CASCADE |
| `secret_id` | `company_secrets.id` | SET NULL |

#### `routine_runs`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | CASCADE |
| `routine_id` | `routines.id` | CASCADE |
| `trigger_id` | `routine_triggers.id` | SET NULL |
| `linked_issue_id` | `issues.id` | SET NULL |

---

### Cost / Finance

#### `cost_events`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | RESTRICT |
| `agent_id` | `agents.id` | NO ACTION |
| `issue_id` | `issues.id` | NO ACTION |
| `project_id` | `projects.id` | NO ACTION |
| `goal_id` | `goals.id` | NO ACTION |
| `heartbeat_run_id` | `heartbeat_runs.id` | NO ACTION |

#### `budget_policies`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | RESTRICT |

#### `budget_incidents`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | RESTRICT |
| `policy_id` | `budget_policies.id` | NO ACTION |
| `approval_id` | `approvals.id` | NO ACTION |

---

### Approval System

#### `approvals`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | RESTRICT |
| `requested_by_agent_id` | `agents.id` | NO ACTION |

#### `approval_comments`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | RESTRICT |
| `approval_id` | `approvals.id` | RESTRICT |
| `author_agent_id` | `agents.id` | NO ACTION |

---

### Access Control / Auth

#### `company_memberships`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | RESTRICT |

#### `board_api_keys`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `user_id` | `user.id` | CASCADE |

#### `session` (Better Auth)
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `user_id` | `user.id` | CASCADE |

#### `account` (Better Auth)
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `user_id` | `user.id` | CASCADE |

---

### Secrets

#### `company_secrets`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `company_id` | `companies.id` | RESTRICT |
| `created_by_agent_id` | `agents.id` | SET NULL |

#### `company_secret_versions`
| FK Column | References | Cascade |
|-----------|-----------|---------|
| `secret_id` | `company_secrets.id` | CASCADE |
| `created_by_agent_id` | `agents.id` | SET NULL |

---

## Cascade Behavior Summary

| Behavior | When Used |
|----------|-----------|
| **CASCADE** | Junction table FKs (delete junction row when parent deleted), auth sessions/accounts, labels, routines |
| **SET NULL** | Optional references (checkout_run_id, execution_workspace_id, created_by_agent_id, etc.) |
| **RESTRICT/NO ACTION** | Core entity references (company_id on agents/issues/projects — prevents orphaning) |

---

## Self-Referencing Tables

| Table | Column | Purpose |
|-------|--------|---------|
| `agents` | `reports_to` | Org chart hierarchy |
| `issues` | `parent_id` | Sub-issue tree |
| `goals` | `parent_id` | Goal hierarchy |
| `heartbeat_runs` | `retry_of_run_id` | Run retry chain |
| `execution_workspaces` | `derived_from_execution_workspace_id` | Workspace derivation |

---

## Key Design Patterns

1. **Company scoping**: Nearly every table has a `company_id` column. Multi-tenant by design.
2. **Soft deletes**: Agent API keys use `revokedAt`, board API keys use `revokedAt` + `expiresAt`.
3. **Junction tables with metadata**: `issue_approvals` carries `linked_by_agent_id`, `issue_attachments` carries `issue_comment_id`.
4. **Audit columns**: Most tables have `createdAt`, `updatedAt`, and often `created_by_agent_id`.
5. **JSONB for flexibility**: `adapterConfig`, `permissions`, `executionPolicy`, `scope`, `details` use JSONB.
