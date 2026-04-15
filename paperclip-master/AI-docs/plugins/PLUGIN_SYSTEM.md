# Plugin System — Paperclip Extensions

> **SDK Package**: `@paperclipai/plugin-sdk`  
> **Architecture**: Out-of-process workers communicating via JSON-RPC 2.0 over stdio

---

## What Plugins Can Do

Plugins extend Paperclip without modifying core. They can:

- Subscribe to domain events (issue created, agent status changed, etc.)
- Register scheduled jobs (cron-based)
- Serve custom UI (React components rendered in Paperclip)
- Register launcher entries (sidebar quick actions)
- Store scoped state (per-instance, per-company, per-project, per-agent, etc.)
- Own custom entities
- Perform HTTP requests to external services
- Register tools that agents can use
- Receive webhooks from external systems
- Stream real-time data to their UI via SSE
- Read/write issues, comments, documents, agents, goals

---

## Plugin Structure

```
my-plugin/
├── package.json          # name, version, main entry
├── src/
│   ├── manifest.ts       # Plugin manifest (metadata, capabilities, config schema)
│   ├── worker.ts         # Backend logic (runs as child process)
│   ├── ui/
│   │   └── index.tsx     # React UI component (rendered in Paperclip host)
│   └── index.ts          # Re-exports
├── tsconfig.json
└── vitest.config.ts
```

---

## Defining a Plugin

### Manifest

```typescript
// src/manifest.ts
import type { PaperclipPluginManifestV1 } from '@paperclipai/plugin-sdk';

export const manifest: PaperclipPluginManifestV1 = {
  apiVersion: 1,
  name: 'My Plugin',
  description: 'Does something useful',
  version: '1.0.0',
  categories: ['automation'],
  capabilities: [
    'events:subscribe',
    'state:read', 'state:write',
    'issues:read', 'issues:write',
    'data:register', 'actions:register',
    'ui:launchers', 'ui:render',
  ],
  configSchema: {
    type: 'object',
    properties: {
      apiKey: { type: 'string', description: 'External service API key' },
      enabled: { type: 'boolean', default: true }
    }
  }
};
```

### Worker

```typescript
// src/worker.ts
import { definePlugin, runWorker } from '@paperclipai/plugin-sdk';

const plugin = definePlugin({
  async setup(ctx) {
    // Subscribe to events
    ctx.events.on('issue.created', async (event) => {
      ctx.logger.info('New issue:', event.data.title);
      // Store state
      await ctx.state.set('instance', 'last_issue', event.data.id);
    });

    // Register data handler (for UI)
    ctx.data.register('summary', async (params) => {
      const issues = await ctx.issues.list(params.companyId);
      return { total: issues.length };
    });

    // Register action handler (for UI)
    ctx.actions.register('doSomething', async (params) => {
      await ctx.issues.createComment(params.issueId, {
        body: 'Plugin did something!'
      });
      return { success: true };
    });

    // Register scheduled job
    ctx.jobs.register('daily-report', async (run) => {
      ctx.logger.info('Running daily report...');
    });

    // Register launcher
    ctx.launchers.register({
      key: 'open-plugin',
      label: 'My Plugin',
      icon: 'sparkles'
    });
  },

  async onHealth() {
    return { status: 'ok' };
  },

  async onConfigChanged(newConfig) {
    // Handle hot config reload
  },

  async onShutdown() {
    // Cleanup
  },

  async onWebhook(input) {
    // Handle inbound webhook
    return { status: 200 };
  }
});

runWorker(plugin);
```

### UI Component

```tsx
// src/ui/index.tsx
import { usePluginData, usePluginAction, useHostContext } from '@paperclipai/plugin-sdk/ui';

export default function MyPluginUI() {
  const { companyId } = useHostContext();
  const { data, loading } = usePluginData('summary', { companyId });
  const doSomething = usePluginAction('doSomething');

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Total Issues: {data?.total}</h2>
      <button onClick={() => doSomething.mutate({ issueId: '...' })}>
        Do Something
      </button>
    </div>
  );
}
```

---

## Plugin SDK Context API (`ctx`)

| Client | Methods | Capability Required |
|--------|---------|-------------------|
| `ctx.config` | `get()` | — |
| `ctx.events` | `on(pattern, handler)`, `emit(type, data)` | `events:subscribe` |
| `ctx.jobs` | `register(key, handler)` | `jobs:schedule` |
| `ctx.launchers` | `register(declaration)` | `ui:launchers` |
| `ctx.http` | `fetch(url, options)` | `http:outbound` |
| `ctx.secrets` | `resolve(ref)` | `secrets:resolve` |
| `ctx.activity` | `log(entry)` | `activity:write` |
| `ctx.state` | `get/set/delete(scope, key)` | `state:read`, `state:write` |
| `ctx.entities` | `create/update/delete/list/find` | `entities:manage` |
| `ctx.projects` | `list/get/workspaces` | `projects:read` |
| `ctx.companies` | `list/get` | `companies:read` |
| `ctx.issues` | `create/update/list/get/createComment/createDocument` | `issues:read`, `issues:write` |
| `ctx.agents` | `list/get/invoke/createSession/sendMessage` | `agents:read`, `agents:invoke` |
| `ctx.goals` | `list/get/create/update` | `goals:read`, `goals:write` |
| `ctx.data` | `register(key, handler)` | `data:register` |
| `ctx.actions` | `register(key, handler)` | `actions:register` |
| `ctx.streams` | `push(channel, event)` | `streams:push` |
| `ctx.tools` | `register(tool)` | `tools:register` |
| `ctx.metrics` | `write(metric)` | `metrics:write` |
| `ctx.logger` | `info/warn/error/debug` | — |

---

## Event Types

| Event Pattern | When Fired |
|--------------|------------|
| `issue.created` | New issue created |
| `issue.updated` | Issue fields changed |
| `issue.status_changed` | Issue status transition |
| `issue.assigned` | Issue assigned to agent |
| `issue.comment_added` | Comment posted on issue |
| `agent.status_changed` | Agent status transition |
| `agent.created` | New agent created |
| `heartbeat.run.started` | Heartbeat run begins |
| `heartbeat.run.completed` | Heartbeat run finishes |
| `approval.created` | Approval request submitted |
| `approval.resolved` | Approval approved/rejected |
| `cost.recorded` | Cost event logged |

---

## Installation

```bash
# From npm
POST /api/plugins/install { "source": "npm", "packageName": "@my/plugin" }

# From local path
POST /api/plugins/install { "source": "local", "path": "/path/to/plugin" }
```

---

## Plugin State Scopes

State can be scoped to different levels:

| Scope | When to Use |
|-------|-------------|
| `instance` | Global state shared across all companies |
| `company` | Per-company state |
| `project` | Per-project state |
| `agent` | Per-agent state |
| `issue` | Per-issue state |
| `goal` | Per-goal state |
| `run` | Per-heartbeat-run state |
