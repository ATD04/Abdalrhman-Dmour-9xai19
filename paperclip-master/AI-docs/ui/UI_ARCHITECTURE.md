# UI Architecture — Paperclip Board App

> **Stack**: React 18 + Vite + TanStack Query + React Router + WebSocket  
> **Served**: By the API server at the same origin (dev middleware mode)

---

## Route Map

### Unauthenticated Routes
| Route | Component | Purpose |
|-------|-----------|---------|
| `/auth` | AuthPage | Login page |
| `/board-claim/:token` | BoardClaimPage | Invite claim |
| `/cli-auth/:id` | CliAuthPage | CLI authentication approval |
| `/invite/:token` | InviteLandingPage | Agent/human invite landing |

### Instance Routes
| Route | Component | Purpose |
|-------|-----------|---------|
| `/onboarding` | OnboardingWizard | First-run setup |
| `/instance/settings/general` | InstanceGeneralSettings | Instance config |
| `/instance/settings/heartbeats` | InstanceSettings | Heartbeat settings |
| `/instance/settings/experimental` | InstanceExperimentalSettings | Experimental flags |
| `/instance/settings/plugins` | PluginManager | Install/manage plugins |
| `/instance/settings/plugins/:pluginId` | PluginSettings | Plugin config |
| `/instance/settings/adapters` | AdapterManager | Install/manage adapters |

### Company-Scoped Routes (`:companyPrefix/*`)
| Route | Component | Purpose |
|-------|-----------|---------|
| `dashboard` | Dashboard | Company overview (agents, tasks, spend, approvals) |
| `org` | OrgChart | Visual org tree |
| `agents/all\|active\|paused\|error` | Agents | Filtered agent list |
| `agents/new` | NewAgent | Create new agent |
| `agents/:agentId` | AgentDetail | Agent detail + config |
| `agents/:agentId/:tab` | AgentDetail | Agent sub-tabs (runs, config, budget) |
| `agents/:agentId/runs/:runId` | AgentRunDetail | Heartbeat run logs/transcript |
| `projects` | Projects | Project list |
| `projects/:projectId` | ProjectDetail | Project overview, issues, workspaces |
| `issues` | Issues | Issue list (kanban/table) |
| `issues/:issueId` | IssueDetail | Issue detail, comments, docs |
| `routines` | Routines | Routine list |
| `routines/:routineId` | RoutineDetail | Routine config + runs |
| `goals` | Goals | Goal tree |
| `goals/:goalId` | GoalDetail | Goal detail |
| `approvals/pending\|all` | Approvals | Approval queue |
| `approvals/:approvalId` | ApprovalDetail | Approval detail + actions |
| `costs` | Costs | Cost dashboard (by agent, model, project) |
| `activity` | Activity | Audit log |
| `inbox/mine\|recent\|unread\|all` | Inbox | Board inbox |
| `company/settings` | CompanySettings | Company config |
| `company/export/*` | CompanyExport | Export company package |
| `company/import` | CompanyImport | Import company package |
| `skills/*` | CompanySkills | Skill library |
| `companies` | Companies | Multi-company management |
| `plugins/:pluginId` | PluginPage | Plugin UI surface |

---

## State Management

**Primary**: TanStack Query (React Query)
- API responses cached with 30s stale time
- Auto-refetch on window focus
- Query keys organized in `ui/src/lib/queryKeys.ts`

**Context Providers** (nested order):
1. **QueryClientProvider** — React Query cache
2. **ThemeProvider** — Dark/light theme
3. **BrowserRouter** — Routing
4. **CompanyProvider** — Current company selection, company list
5. **LiveUpdatesProvider** — WebSocket real-time updates
6. **DialogProvider** — Modal management
7. **PanelProvider** — Right panel state
8. **SidebarProvider** — Sidebar state
9. **BreadcrumbProvider** — Navigation breadcrumbs
10. **PluginLauncherProvider** — Plugin launcher rendering

---

## API Client

All API calls go through `ui/src/api/client.ts`:

```typescript
const api = {
  get(path, options?),
  post(path, body?, options?),
  postForm(path, formData, options?),
  put(path, body?, options?),
  patch(path, body?, options?),
  delete(path, options?)
};
```

- Prefixes all paths with `/api`
- Includes `credentials: "include"` for session cookies
- Throws `ApiError` on non-OK responses

Domain modules: `companiesApi`, `agentsApi`, `issuesApi`, `projectsApi`, `goalsApi`, `approvalsApi`, `costsApi`, `activityApi`, `dashboardApi`, `routinesApi`, `pluginsApi`, `adaptersApi`, etc.

---

## Real-Time Updates (WebSocket)

`LiveUpdatesProvider` connects to `/api/companies/:companyId/events/ws` and handles:

| Event | Effect |
|-------|--------|
| `heartbeat.run.status` | Invalidates run queries, shows toast |
| `agent.status` | Updates agent status in dashboard |
| `activity.logged` | Invalidates activity queries |
| `issue.updated` | Refreshes issue data |
| `approval.resolved` | Updates approval badges |

---

## Adapter UI System

Each adapter type has a UI module with:
- **ConfigFields** — React component for adapter-specific config form
- **parseStdoutLine** — Parser for live run transcript display
- **buildAdapterConfig** — Builds config object from form values

10 built-in adapter UIs registered on load. External adapters can be dynamically loaded.

The adapter registry at `ui/src/adapters/registry.ts` supports:
- `registerUIAdapter(adapter)` — add adapter
- `findUIAdapter(type)` — lookup by type
- `listUIAdapters()` — list all registered
- `syncExternalAdapters()` — sync from server
- `onAdapterChange(callback)` — observe changes

---

## Key Components

| Component | Purpose |
|-----------|---------|
| `AgentConfigForm` | Agent creation/edit form with adapter-specific fields |
| `CommentThread` | Issue comment thread with markdown rendering |
| `IssueChatThread` | Chat-style issue interaction |
| `OrgChart` | D3-based organizational hierarchy visualization |
| `GoalTree` | Hierarchical goal tree |
| `CompanySwitcher` | Company selection dropdown |
| `CommandPalette` | Keyboard shortcut command palette |
| `EnvVarEditor` | Environment variable key-value editor |
| `ScheduleEditor` | Cron expression editor |
| `MarkdownEditor` | MDX-based markdown editing |
| `BudgetPolicyCard` | Budget policy display and editing |
| `ActiveAgentsPanel` | Live agent status panel |

---

## Plugin UI Integration

Plugins can contribute UI via the bridge system:

```typescript
// Plugin UI hooks (available to plugin React components)
usePluginData(key, params)    // Fetch data from plugin worker
usePluginAction(key)          // Execute action on plugin worker
useHostContext()              // Get company/project/user context
usePluginToast()              // Show toast notifications
usePluginStream(channel)      // Subscribe to SSE events from plugin
```

Plugin UIs are rendered at `/:companyPrefix/plugins/:pluginId` and also in sidebar launchers, tool panels, and UI slots.
