# UI Routes — Complete Route Reference

> **Router**: React Router v6 with custom company-prefix injection. **Data loading**: TanStack Query (no React Router loaders).

---

## How Company-Prefix Routes Work

All board-level routes live under `/:companyPrefix/...` where `companyPrefix` is the company's `issuePrefix` (e.g. `ACME`).

A custom router shim at `ui/src/lib/router.tsx` wraps `Link`, `NavLink`, `Navigate`, and `useNavigate` to **automatically inject** the company prefix. Page code never manually builds prefixed URLs.

```typescript
// Any import from @/lib/router auto-prefixes
import { Link, useNavigate } from "@/lib/router";

<Link to="/dashboard">Dashboard</Link>
// renders: /ACME/dashboard (for company with prefix ACME)
```

### Path Resolution Rules

- **Global roots** (never prefixed): `auth`, `invite`, `board-claim`, `cli-auth`, `docs`, `instance`
- **Board roots** (always prefixed): `dashboard`, `companies`, `company`, `skills`, `org`, `agents`, `projects`, `execution-workspaces`, `issues`, `routines`, `goals`, `approvals`, `costs`, `usage`, `activity`, `inbox`, `design-guide`

### Company Page Memory

On every navigation, the current company-relative path is saved to `localStorage`. When switching companies via the Company Rail, the session navigates to the remembered path for the new company.

---

## Auth Protection

**`CloudAccessGate`** is the single auth gate (defined in `App.tsx`):

1. Queries `/api/health` to determine `deploymentMode`.
2. **`authenticated` mode**: Checks session via `authApi.getSession()`. Redirects to `/auth?next=<path>` if no session. Shows `BootstrapPendingPage` if bootstrap is pending.
3. **`local_trusted` mode**: No auth check — all routes accessible.

---

## Global Routes (No Company Prefix)

| Path | Component | Purpose |
|------|-----------|---------|
| `/auth` | `AuthPage` | Sign-in / sign-up |
| `/board-claim/:token` | `BoardClaimPage` | Board claim via invite token |
| `/cli-auth/:id` | `CliAuthPage` | CLI authentication approval |
| `/invite/:token` | `InviteLandingPage` | Invite landing page |

---

## Root Redirects

| Path | Redirects To | Condition |
|------|-------------|-----------|
| `/` | `/<prefix>/dashboard` | If companies exist |
| `/` | `/onboarding` | If no companies |
| `/onboarding` | `OnboardingRoutePage` | Shows onboarding wizard |
| `/instance` | `/instance/settings/general` | Redirect |
| `/settings`, `/settings/*` | `/instance/settings/general` | Legacy redirect |

---

## Unprefixed Board Redirects

These routes handle backward-compatible URLs lacking a company prefix. They prepend the current company prefix and redirect:

| Unprefixed Path | Redirects To |
|----------------|-------------|
| `/companies` | `/<prefix>/companies` |
| `/issues` | `/<prefix>/issues` |
| `/issues/:issueId` | `/<prefix>/issues/:issueId` |
| `/routines` | `/<prefix>/routines` |
| `/routines/:routineId` | `/<prefix>/routines/:routineId` |
| `/skills/*` | `/<prefix>/skills/...` |
| `/agents` | `/<prefix>/agents` |
| `/agents/new` | `/<prefix>/agents/new` |
| `/agents/:agentId` | `/<prefix>/agents/:agentId` |
| `/agents/:agentId/:tab` | `/<prefix>/agents/:agentId/:tab` |
| `/agents/:agentId/runs/:runId` | `/<prefix>/agents/:agentId/runs/:runId` |
| `/projects` | `/<prefix>/projects` |
| `/projects/:projectId` | `/<prefix>/projects/:projectId` |
| `/projects/:projectId/overview` | `/<prefix>/projects/:projectId/overview` |
| `/projects/:projectId/issues` | `/<prefix>/projects/:projectId/issues` |
| `/projects/:projectId/issues/:filter` | `/<prefix>/projects/:projectId/issues/:filter` |
| `/projects/:projectId/workspaces` | `/<prefix>/projects/:projectId/workspaces` |
| `/projects/:projectId/workspaces/:workspaceId` | `/<prefix>/projects/:projectId/workspaces/:workspaceId` |
| `/projects/:projectId/configuration` | `/<prefix>/projects/:projectId/configuration` |
| `/execution-workspaces/:workspaceId` | `/<prefix>/execution-workspaces/:workspaceId` |
| `/execution-workspaces/:workspaceId/configuration` | `/<prefix>/execution-workspaces/:workspaceId/configuration` |
| `/execution-workspaces/:workspaceId/issues` | `/<prefix>/execution-workspaces/:workspaceId/issues` |

---

## Instance Settings Routes (inside Layout)

| Path | Component | Purpose |
|------|-----------|---------|
| `/instance/settings` | → `/instance/settings/general` | Redirect |
| `/instance/settings/general` | `InstanceGeneralSettings` | Instance config |
| `/instance/settings/heartbeats` | `InstanceSettings` | Heartbeat monitoring |
| `/instance/settings/experimental` | `InstanceExperimentalSettings` | Feature flags |
| `/instance/settings/plugins` | `PluginManager` | Plugin list |
| `/instance/settings/plugins/:pluginId` | `PluginSettings` | Plugin config |
| `/instance/settings/adapters` | `AdapterManager` | Adapter management |

---

## Board Routes (`/:companyPrefix/...`)

All routes below are relative to `/:companyPrefix`. Rendered inside the `Layout` shell.

### Dashboard & Company

| Path | Component | Purpose |
|------|-----------|---------|
| `/` | → `/dashboard` | Auto-redirect |
| `/dashboard` | `Dashboard` | Company overview + live run count |
| `/onboarding` | `OnboardingRoutePage` | Per-company onboarding |
| `/companies` | `Companies` | Company list / switcher |
| `/company/settings` | `CompanySettings` | Company settings |
| `/company/export/*` | `CompanyExport` | Data export |
| `/company/import` | `CompanyImport` | Data import |

### Skills

| Path | Component | Purpose |
|------|-----------|---------|
| `/skills/*` | `CompanySkills` | Skill library management |

### Org Chart

| Path | Component | Purpose |
|------|-----------|---------|
| `/org` | `OrgChart` | D3 organizational hierarchy |

### Agents

| Path | Component | Params | Purpose |
|------|-----------|--------|---------|
| `/agents` | → `/agents/all` | — | Redirect |
| `/agents/all` | `Agents` | — | All agents |
| `/agents/active` | `Agents` | — | Active filter |
| `/agents/paused` | `Agents` | — | Paused filter |
| `/agents/error` | `Agents` | — | Error filter |
| `/agents/new` | `NewAgent` | — | Create agent |
| `/agents/:agentId` | `AgentDetail` | `agentId` | Agent detail (default tab) |
| `/agents/:agentId/:tab` | `AgentDetail` | `agentId`, `tab` | Agent detail with tab |
| `/agents/:agentId/runs/:runId` | `AgentDetail` | `agentId`, `runId` | Run detail |

### Projects

| Path | Component | Params | Purpose |
|------|-----------|--------|---------|
| `/projects` | `Projects` | — | Project list |
| `/projects/:projectId` | `ProjectDetail` | `projectId` | Project detail |
| `/projects/:projectId/overview` | `ProjectDetail` | `projectId` | Overview tab |
| `/projects/:projectId/issues` | `ProjectDetail` | `projectId` | Issues tab |
| `/projects/:projectId/issues/:filter` | `ProjectDetail` | `projectId`, `filter` | Issues with filter |
| `/projects/:projectId/workspaces` | `ProjectDetail` | `projectId` | Workspaces tab |
| `/projects/:projectId/workspaces/:workspaceId` | `ProjectWorkspaceDetail` | `projectId`, `workspaceId` | Workspace detail |
| `/projects/:projectId/configuration` | `ProjectDetail` | `projectId` | Config tab |
| `/projects/:projectId/budget` | `ProjectDetail` | `projectId` | Budget tab |

### Issues

| Path | Component | Params | Purpose |
|------|-----------|--------|---------|
| `/issues` | `Issues` | — | Issue list (kanban/table) |
| `/issues/all` | → `/issues` | — | Legacy redirect |
| `/issues/active` | → `/issues` | — | Legacy redirect |
| `/issues/backlog` | → `/issues` | — | Legacy redirect |
| `/issues/done` | → `/issues` | — | Legacy redirect |
| `/issues/recent` | → `/issues` | — | Legacy redirect |
| `/issues/:issueId` | `IssueDetail` | `issueId` | Issue detail |

### Routines

| Path | Component | Params | Purpose |
|------|-----------|--------|---------|
| `/routines` | `Routines` | — | Routine list |
| `/routines/:routineId` | `RoutineDetail` | `routineId` | Routine detail |

### Execution Workspaces

| Path | Component | Params | Purpose |
|------|-----------|--------|---------|
| `/execution-workspaces/:workspaceId` | `ExecutionWorkspaceDetail` | `workspaceId` | Workspace detail |
| `/execution-workspaces/:workspaceId/configuration` | `ExecutionWorkspaceDetail` | `workspaceId` | Config tab |
| `/execution-workspaces/:workspaceId/issues` | `ExecutionWorkspaceDetail` | `workspaceId` | Issues tab |

### Goals

| Path | Component | Params | Purpose |
|------|-----------|--------|---------|
| `/goals` | `Goals` | — | Goal tree |
| `/goals/:goalId` | `GoalDetail` | `goalId` | Goal detail |

### Approvals

| Path | Component | Params | Purpose |
|------|-----------|--------|---------|
| `/approvals` | → `/approvals/pending` | — | Redirect |
| `/approvals/pending` | `Approvals` | — | Pending approvals |
| `/approvals/all` | `Approvals` | — | All approvals |
| `/approvals/:approvalId` | `ApprovalDetail` | `approvalId` | Approval detail |

### Costs & Activity

| Path | Component | Purpose |
|------|-----------|---------|
| `/costs` | `Costs` | Cost tracking |
| `/activity` | `Activity` | Activity log |

### Inbox

| Path | Component | Purpose |
|------|-----------|---------|
| `/inbox` | `InboxRootRedirect` | Redirects to last-used tab |
| `/inbox/mine` | `Inbox` | My items |
| `/inbox/recent` | `Inbox` | Recent items |
| `/inbox/unread` | `Inbox` | Unread items |
| `/inbox/all` | `Inbox` | All items |
| `/inbox/new` | → `/inbox/mine` | Legacy redirect |

### Plugins

| Path | Component | Params | Purpose |
|------|-----------|--------|---------|
| `/plugins/:pluginId` | `PluginPage` | `pluginId` | Plugin UI surface |
| `/:pluginRoutePath` | `PluginPage` | `pluginRoutePath` | Dynamic plugin routes |

### Dev / Testing

| Path | Component | Purpose |
|------|-----------|---------|
| `/design-guide` | `DesignGuide` | UI design guide |
| `/tests/ux/chat` | `IssueChatUxLab` | Chat UX experiment |
| `/tests/ux/runs` | `RunTranscriptUxLab` | Run transcript experiment |

### 404

| Path | Component | Purpose |
|------|-----------|---------|
| `/*` | `NotFoundPage` | Board-level 404 |

---

## Layout Structure

```
Layout.tsx
├── CompanyRail           (left icon strip — company switching, drag-reorder)
├── Sidebar / InstanceSidebar  (main navigation — switches based on path)
├── BreadcrumbBar         (top bar — breadcrumbs + mobile menu)
├── <Outlet />            (page content)
├── PropertiesPanel       (right side panel)
├── CommandPalette        (Cmd+K)
├── NewIssueDialog
├── NewProjectDialog
├── NewGoalDialog
├── NewAgentDialog
├── KeyboardShortcutsCheatsheet
├── MobileBottomNav       (mobile: Home, Issues, Create, Agents, Inbox)
└── ToastViewport
```

**Sidebar selection**: Instance sidebar for `/instance/*` paths, company sidebar for everything else.

---

## Desktop Sidebar Sections

1. **Top**: Company name + search button (Command Palette)
2. **New Issue** button
3. **Dashboard** — with live agent run count badge
4. **Inbox** — with unread badge (danger tone for failed runs)
5. **Plugin sidebar slots** (dynamic)
6. **Work**: Issues, Routines, Goals
7. **Projects** (dynamic project list)
8. **Agents** (dynamic agent list)
9. **Company**: Org, Skills, Costs, Activity, Settings
10. **Plugin sidebar panels** (dynamic)

---

## Dynamic Route Parameters

| Parameter | Used In | Type |
|-----------|---------|------|
| `:companyPrefix` | `/:companyPrefix/*` | Company issuePrefix (e.g. `ACME`) |
| `:agentId` | Agent routes | Agent UUID |
| `:tab` | `/agents/:agentId/:tab` | Tab name string |
| `:runId` | `/agents/:agentId/runs/:runId` | Run UUID |
| `:projectId` | Project routes | Project UUID |
| `:workspaceId` | Workspace routes | Workspace UUID |
| `:filter` | `/projects/:projectId/issues/:filter` | Filter string |
| `:issueId` | `/issues/:issueId` | Issue identifier (e.g. `ACME-42`) |
| `:routineId` | `/routines/:routineId` | Routine UUID |
| `:goalId` | `/goals/:goalId` | Goal UUID |
| `:approvalId` | `/approvals/:approvalId` | Approval UUID |
| `:pluginId` | Plugin routes | Plugin ID |
| `:pluginRoutePath` | Dynamic plugin catch-all | Plugin route path |
| `:token` | Auth routes | Auth/invite token |
| `:id` | `/cli-auth/:id` | CLI auth session ID |

---

## Key Files

| File | Purpose |
|------|---------|
| `ui/src/App.tsx` | Master route tree |
| `ui/src/main.tsx` | App entrypoint, context providers |
| `ui/src/lib/router.tsx` | Custom router with company prefix injection |
| `ui/src/lib/company-routes.ts` | Path algebra for company prefixes |
| `ui/src/components/Layout.tsx` | Layout shell (sidebar + panel + content) |
| `ui/src/hooks/useCompanyPageMemory.ts` | Per-company page memory |
