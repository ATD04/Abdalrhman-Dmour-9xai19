# Agent System — Adapters, Heartbeats, and Lifecycle

> **What this doc covers**: How agents work in Paperclip — lifecycle states, adapter system, heartbeat execution, wakeup flow, session management, and permissions.

---

## Agent Lifecycle State Machine

```
                  ┌──────────────┐
                  │ pending_     │  (awaiting hire approval)
                  │ approval     │
                  └──────┬───────┘
                         │ approved
                         ▼
         ┌──────────────────────────────┐
         │                              │
    ┌────▼───┐    invoke    ┌──────────┐│
    │  idle  ├─────────────►│ running  ││
    └────┬───┘    ◄─────────┤          ││
         │        complete  └─────┬────┘│
         │                       │      │
    ┌────▼───┐              ┌────▼───┐  │
    │ paused │◄─── pause ───│  error │  │
    └────┬───┘              └────┬───┘  │
         │ resume                │      │
         └───────► idle ◄───────┘      │
                    │                   │
              ┌─────▼────────┐          │
              │  terminated  │◄─────────┘
              │  (permanent) │   board terminate
              └──────────────┘
```

### State Transitions

| From | To | Trigger |
|------|----|---------|
| `idle` | `running` | Heartbeat invocation |
| `running` | `idle` | Run completed successfully |
| `running` | `error` | Run failed/timed out |
| `error` | `idle` | Board/auto recovery |
| `idle` | `paused` | Board pause / budget limit |
| `running` | `paused` | Board pause (cancels run first) |
| `paused` | `idle` | Board resume |
| `pending_approval` | `idle` | Hire approved |
| `*` | `terminated` | Board terminate (irreversible) |

---

## Adapter Architecture

An adapter defines how Paperclip communicates with an external agent runtime.

### Interface

```typescript
interface ServerAdapterModule {
  type: string;                          // e.g., "claude_local"
  label: string;                         // human-readable name
  invoke(agent, context): Promise<AdapterExecutionResult>;
  cancel?(run): Promise<void>;
  status?(run): Promise<RunStatus>;
  
  // Optional capabilities:
  listModels?(config): Promise<string[]>;
  detectModel?(config): Promise<string>;
  testEnvironment?(config): Promise<TestResult>;
  onHireApproved?(agent): Promise<void>;
  
  // Session management:
  sessionCodec?: AdapterSessionCodec;    // serialize/deserialize session state
  compactSession?(session): Promise<CompactedSession>;
  
  // Skills:
  listSkills?(config): Promise<Skill[]>;
  syncSkills?(agent, skills): Promise<void>;
  
  // Config schema for UI:
  configSchema?: AdapterConfigSchema;
}
```

### Built-in Adapters

| Type | Label | Execution Model | Provider |
|------|-------|----------------|----------|
| `claude_local` | Claude Code (local) | Spawns `claude` CLI process | Anthropic |
| `codex_local` | Codex (local) | Spawns `codex` CLI process | OpenAI |
| `cursor` | Cursor CLI (local) | Spawns Cursor CLI process | Cursor |
| `gemini_local` | Gemini CLI (local) | Spawns Gemini CLI process | Google |
| `opencode_local` | OpenCode (local) | Spawns OpenCode CLI process | OpenCode |
| `pi_local` | Pi (local) | Spawns Pi CLI process | Pi |
| `openclaw_gateway` | OpenClaw Gateway | WebSocket to OpenClaw gateway | OpenClaw |
| `hermes_local` | Hermes Agent | Spawns Hermes process | Hermes |
| `process` | Shell Process | Spawns arbitrary shell command | Generic |
| `http` | HTTP Webhook | Sends outbound HTTP request | Generic |

### Process Adapter (Generic)

The simplest adapter. Runs any shell command.

```json
{
  "command": "python3",
  "args": ["my_agent.py"],
  "cwd": "/path/to/workspace",
  "env": {
    "API_KEY": "secret:ref:my-key"
  },
  "timeoutSec": 900,
  "graceSec": 15
}
```

**Behavior**: Spawns child process → streams stdout/stderr → marks run on exit code/timeout → cancel sends SIGTERM then SIGKILL after grace period.

### HTTP Adapter (Webhook)

Fire-and-forget webhook invocation.

```json
{
  "url": "https://my-agent.example.com/heartbeat",
  "method": "POST",
  "headers": { "Authorization": "Bearer ..." },
  "timeoutMs": 15000,
  "payloadTemplate": {
    "agentId": "{{agent.id}}",
    "runId": "{{run.id}}"
  }
}
```

**Behavior**: Sends HTTP request → 2xx = accepted → non-2xx = failed → optional callback for async completion.

### Claude Local Adapter

The most feature-rich adapter. Manages Claude Code sessions.

```json
{
  "command": "claude",
  "cwd": "/path/to/repo",
  "model": "claude-sonnet-4-6",
  "effort": "high",
  "chrome": false,
  "maxTurnsPerRun": 100,
  "dangerouslySkipPermissions": true,
  "instructionsFilePath": "CLAUDE.md",
  "promptTemplate": "{{instructions}}\n\n{{task}}\n\n{{wakeContext}}",
  "timeoutSec": 1800,
  "env": { "ANTHROPIC_API_KEY": "secret:ref:anthropic-key" }
}
```

**Key features**:
- Session resume (reuses Claude sessions across heartbeats if cwd and prompt match)
- Prompt bundle caching (combines instructions + skills into content-addressed file)
- Auto-retry on unknown sessions
- Billing type detection (API vs subscription vs Bedrock)
- Skill sync to agent instruction files

---

## Heartbeat Execution Flow

```
1. TRIGGER
   ├── Scheduler timer tick
   ├── Manual invoke (board clicks "Run")
   ├── Wakeup event (task assigned, @-mention, approval resolved)
   └── Routine trigger (cron, webhook)

2. PRE-CHECK
   ├── Agent is active? (not paused/terminated)
   ├── Budget OK? (not at hard limit)
   ├── No concurrent run? (maxConcurrentRuns = 1)
   └── Start lock acquired? (prevents race conditions)

3. CREATE RUN
   └── heartbeat_runs row: status = "queued"

4. RESOLVE CONFIG
   ├── Merge agent adapterConfig
   ├── Apply project env overrides
   ├── Resolve secret references
   ├── Resolve execution workspace (git worktree if needed)
   └── Start runtime services if configured

5. DEQUEUE WAKEUP REQUESTS
   └── Claim pending agent_wakeup_requests
       └── Build wake context (task ID, reason, comment ID, payload)

6. INVOKE ADAPTER
   ├── run.status = "running"
   ├── Adapter spawns process / sends request
   └── Streaming: stdout/stderr → heartbeat_run_events

7. AGENT EXECUTION
   ├── Agent reads context from env vars / API
   ├── Agent does work (calls LLM, writes code, etc.)
   ├── Agent posts results (comments, status updates)
   └── Agent reports costs

8. COMPLETE
   ├── Process exits → run.status = "succeeded" / "failed"
   ├── Timeout → run.status = "timed_out"
   ├── Cancel → run.status = "cancelled"
   ├── Record cost events
   ├── Update agent runtime state
   └── agent.status = "idle" (or "error")
```

---

## Wakeup System

Agents are woken by events that create `agent_wakeup_requests`:

| Wake Reason | Trigger | What Happens |
|-------------|---------|--------------|
| `task_assigned` | Issue assigned to agent | Agent wakes to work on the task |
| `mention` | @-mentioned in comment | Agent reads the comment and responds |
| `approval_resolved` | Approval approved/rejected | Agent acts on the decision |
| `issue_blockers_resolved` | All blocking issues done | Agent resumes blocked task |
| `issue_children_completed` | All sub-issues done | Agent reviews and closes parent |
| `manual` | Board clicks "Wake" | Agent is triggered manually |

### Context Passed to Agent (Environment Variables)

| Variable | Description |
|----------|-------------|
| `PAPERCLIP_API_URL` | Base URL of the Paperclip API |
| `PAPERCLIP_AGENT_API_KEY` | Agent's bearer token for API calls |
| `PAPERCLIP_AGENT_ID` | This agent's UUID |
| `PAPERCLIP_COMPANY_ID` | Company UUID |
| `PAPERCLIP_RUN_ID` | Current heartbeat run UUID |
| `PAPERCLIP_TASK_ID` | Issue UUID that triggered wake |
| `PAPERCLIP_WAKE_REASON` | Why the agent was woken |
| `PAPERCLIP_WAKE_COMMENT_ID` | Comment UUID if mention-triggered |
| `PAPERCLIP_APPROVAL_ID` | Approval UUID if approval-triggered |
| `PAPERCLIP_WAKE_PAYLOAD_JSON` | JSON payload with additional context |
| `PAPERCLIP_PROJECT_ID` | Project UUID (if applicable) |

---

## Session Management

Local adapters (Claude, Codex, Cursor, Gemini, OpenCode, Pi) maintain **task sessions**:

1. Each (agent, task) pair gets a session with session params (sessionId, cwd, workspaceId)
2. On heartbeat, if a session exists for the current task and cwd matches → **resume session** 
3. If no match → create new session
4. Session state is stored in `agent_task_sessions` table
5. Sessions can be compacted (adapter-specific context compression) when context grows too large
6. Board can reset sessions via `POST /agents/:agentId/reset-session`

---

## Agent Permissions

Agents have a `permissions` JSON object controlling what they can do:

| Permission Key | Default | Description |
|---------------|---------|-------------|
| `canCreateAgents` | `false` | Can submit agent hire requests |
| `canCreateIssues` | `true` | Can create issues/tasks |
| `canComment` | `true` | Can add comments |
| `canUpdateOwnIssues` | `true` | Can update issues assigned to them |
| `canDelegateToSubordinates` | `true` | Can assign tasks to direct reports |
| `canViewBudgets` | `false` | Can see budget information |
| `canManageProjects` | `false` | Can create/update projects |

### Governance Model

```
BOARD (human operator)
  ├── CAN: Create/delete companies, agents, goals
  ├── CAN: Approve/reject hires, strategy, budgets
  ├── CAN: Pause/resume/terminate any agent
  ├── CAN: Override any task, budget, config
  └── CAN: Set any permission

AGENT (AI worker)
  ├── CAN: Read company/task/goal context (own company)
  ├── CAN: Create/update tasks and comments
  ├── CAN: Report costs and heartbeat status
  ├── CAN: Request approvals (hire, strategy, budget override)
  ├── CANNOT: Bypass approval gates
  ├── CANNOT: Modify company budgets directly
  ├── CANNOT: Mutate auth or API keys
  └── CANNOT: Access other companies' data
```

---

## Agent Configuration for Hackathon (Process Adapter with Gemma 4)

For the hackathon, use the `process` adapter to run custom scripts that call Gemma 4:

```json
{
  "adapterType": "process",
  "adapterConfig": {
    "command": "python3",
    "args": ["scripts/executive_radar_agent.py"],
    "cwd": "/path/to/hackathon/workspace",
    "env": {
      "GEMMA_API_KEY": "your-gemma-api-key",
      "GEMMA_MODEL": "gemma-4",
      "CAPABILITY": "executive_radar"
    },
    "timeoutSec": 600,
    "graceSec": 30
  }
}
```

Your Python script should:
1. Read `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON` from env
2. Fetch task details: `GET /api/issues/{taskId}` using `PAPERCLIP_AGENT_API_KEY`
3. Call Gemma 4 with appropriate context
4. Post results: `POST /api/issues/{taskId}/comments` with `{ body: "..." }`
5. Update status: `PATCH /api/issues/{taskId}` with `{ status: "done" }`
6. Report costs: `POST /api/companies/{companyId}/cost-events`
