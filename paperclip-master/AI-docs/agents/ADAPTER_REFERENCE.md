# Adapter Reference — All 10 Built-in Adapter Types

> **Registry**: `server/src/adapters/registry.ts`. Each adapter implements the `ServerAdapterModule` interface. The `process` adapter is the fallback for unknown types.

---

## Common Environment Variables

All local adapters (`claude_local`, `codex_local`, `cursor`, `gemini_local`, `opencode_local`, `pi_local`) inject these via `buildPaperclipEnv(agent)`:

| Variable | Description |
|----------|-------------|
| `PAPERCLIP_AGENT_ID` | Agent UUID |
| `PAPERCLIP_COMPANY_ID` | Company UUID |
| `PAPERCLIP_API_URL` | Paperclip server URL |
| `PAPERCLIP_API_KEY` | Auth token (agent API key or JWT) |
| `PAPERCLIP_RUN_ID` | Current heartbeat run ID |
| `PAPERCLIP_TASK_ID` | Issue ID (if task-triggered) |
| `PAPERCLIP_WAKE_REASON` | Why the agent was woken (e.g. `task_assigned`, `mentioned`, `manual`) |
| `PAPERCLIP_WAKE_COMMENT_ID` | Comment that triggered wake (if applicable) |
| `PAPERCLIP_APPROVAL_ID` | Approval ID (if approval-triggered) |
| `PAPERCLIP_APPROVAL_STATUS` | Approval status |
| `PAPERCLIP_LINKED_ISSUE_IDS` | Comma-separated linked issue IDs |
| `PAPERCLIP_WAKE_PAYLOAD_JSON` | Full wake payload as JSON |
| `PAPERCLIP_WORKSPACE_CWD` | Workspace working directory |
| `PAPERCLIP_WORKSPACE_SOURCE` | Workspace source type |
| `PAPERCLIP_WORKSPACE_STRATEGY` | Workspace strategy type |
| `PAPERCLIP_WORKSPACE_ID` | Execution workspace UUID |
| `PAPERCLIP_WORKSPACE_REPO_URL` | Git repo URL |
| `PAPERCLIP_WORKSPACE_REPO_REF` | Git ref |
| `PAPERCLIP_WORKSPACE_BRANCH` | Git branch |
| `PAPERCLIP_WORKSPACE_WORKTREE_PATH` | Worktree path |
| `AGENT_HOME` | Agent home directory |
| `PAPERCLIP_WORKSPACES_JSON` | All workspaces as JSON |
| `PAPERCLIP_RUNTIME_SERVICE_INTENTS_JSON` | Runtime service intents |
| `PAPERCLIP_RUNTIME_SERVICES_JSON` | Runtime services |
| `PAPERCLIP_RUNTIME_PRIMARY_URL` | Primary runtime service URL |

---

## 1. `claude_local` — Claude Code (local)

**Package**: `packages/adapters/claude-local/`

### Config Schema

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `cwd` | string | `process.cwd()` | Working directory (created if missing) |
| `command` | string | `"claude"` | CLI command to invoke |
| `model` | string | `""` (CLI default) | Model ID (e.g. `claude-opus-4-6`, `claude-sonnet-4-6`) |
| `effort` | string | `""` | Reasoning effort: `low`, `medium`, `high` |
| `chrome` | boolean | `false` | Pass `--chrome` flag |
| `promptTemplate` | string | `"You are agent {{agent.id}}..."` | Mustache-template for run prompts |
| `bootstrapPromptTemplate` | string | `""` | One-time prompt for fresh sessions |
| `instructionsFilePath` | string | `""` | Markdown file injected via `--append-system-prompt-file` |
| `maxTurnsPerRun` | number | `0` (unlimited) | Max turns per run |
| `dangerouslySkipPermissions` | boolean | `true` | Required for headless `--print` mode |
| `extraArgs` / `args` | string[] | `[]` | Additional CLI arguments |
| `env` | object | `{}` | Environment variables (supports `{type:"secret_ref",secretId:"..."}`) |
| `timeoutSec` | number | `0` | Run timeout |
| `graceSec` | number | `20` | SIGTERM grace period |
| `workspaceStrategy` | object | none | `{type:"git_worktree", baseRef?, branchTemplate?, worktreeParentDir?}` |

### Execution

```bash
claude --print - --output-format stream-json --verbose \
  [--dangerously-skip-permissions] [--model <model>] [--effort <effort>] \
  [--chrome] [--max-turns <n>] [--resume <sessionId>] \
  [--append-system-prompt-file <path>] --add-dir <promptBundleDir>
```

Prompt piped via **stdin**.

### Session Management

Full session resume via `--resume <sessionId>`. Sessions validated by matching cwd and promptBundleKey. Reports `clearSession` on max-turns.

### Skill Sync

Mode: `"ephemeral"`. Skills materialized into content-addressed prompt bundle directory (`--add-dir`).

### Billing

Provider: `"anthropic"`. Biller: `"anthropic"` or `"aws_bedrock"` (when Bedrock auth detected). Supports `supportsLocalAgentJwt: true`.

### Models

`claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-6`, `claude-sonnet-4-5-20250929`, `claude-haiku-4-5-20251001`. Bedrock variants available.

---

## 2. `codex_local` — Codex (local)

**Package**: `packages/adapters/codex-local/`

### Config Schema

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `cwd` | string | `process.cwd()` | Working directory |
| `command` | string | `"codex"` | CLI command |
| `model` | string | `"gpt-5.3-codex"` | Model ID |
| `modelReasoningEffort` | string | `""` | Effort: `minimal`, `low`, `medium`, `high`, `xhigh` |
| `search` | boolean | `false` | Run with `--search` |
| `fastMode` | boolean | `false` | Enable Codex Fast mode (gpt-5.4 only) |
| `dangerouslyBypassApprovalsAndSandbox` | boolean | `true` | Bypass interactive prompts |
| `promptTemplate` | string | `"You are agent {{agent.id}}..."` | Run prompt |
| `bootstrapPromptTemplate` | string | `""` | First-session prompt |
| `instructionsFilePath` | string | `""` | Instructions markdown prepended to stdin |
| `extraArgs` / `args` | string[] | `[]` | Additional CLI args |
| `env` | object | `{}` | Environment variables |
| `timeoutSec` | number | `0` | Timeout |
| `graceSec` | number | `20` | Grace period |
| `workspaceStrategy` | object | none | Git worktree strategy |

### Execution

```bash
codex [--search] exec --json [--dangerously-bypass-approvals-and-sandbox] \
  [--model <model>] [-c model_reasoning_effort=...] \
  [resume <sessionId>] -
```

Prompt piped via **stdin**.

### Skill Sync

Mode: `"ephemeral"`. Skills symlinked into managed `CODEX_HOME/skills/` directory.

### Models

`gpt-5.4`, `gpt-5.3-codex` (default), `gpt-5.3-codex-spark`, `gpt-5`, `o3`, `o4-mini`, `gpt-5-mini`, `gpt-5-nano`, `o3-mini`, `codex-mini-latest`.

---

## 3. `cursor` — Cursor CLI (local)

**Package**: `packages/adapters/cursor-local/`

### Config Schema

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `cwd` | string | `process.cwd()` | Working directory |
| `command` | string | `"agent"` | CLI command |
| `model` | string | `"auto"` | Model ID |
| `mode` | string | none | `"plan"` or `"ask"` (omit for autonomous) |
| `promptTemplate` | string | `"You are agent {{agent.id}}..."` | Run prompt |
| `bootstrapPromptTemplate` | string | `""` | First-session prompt |
| `instructionsFilePath` | string | `""` | Instructions file |
| `extraArgs` / `args` | string[] | `[]` | Additional CLI args |
| `env` | object | `{}` | Environment variables |
| `timeoutSec` | number | `0` | Timeout |
| `graceSec` | number | `20` | Grace period |

### Execution

```bash
agent -p --output-format stream-json --workspace <cwd> \
  [--resume <sessionId>] [--model <model>] [--mode <mode>] [--yolo]
```

Prompt via **stdin**. Auto-adds `--yolo` for unattended execution.

### Skill Sync

Persistent symlink mode into `~/.cursor/skills/`.

### Models

`auto` (default), `composer-1.5`, `gpt-5.3-codex` variants, `opus-4.6`, `sonnet-4.6`, `gemini-3.1-pro`, `grok`, `kimi-k2.5`, and many more.

---

## 4. `gemini_local` — Gemini CLI (local)

**Package**: `packages/adapters/gemini-local/`

### Config Schema

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `cwd` | string | `process.cwd()` | Working directory |
| `command` | string | `"gemini"` | CLI command |
| `model` | string | `"auto"` | Model ID |
| `sandbox` | boolean | `false` | `false` passes `--sandbox=none` |
| `promptTemplate` | string | `"You are agent {{agent.id}}..."` | Run prompt |
| `bootstrapPromptTemplate` | string | `""` | First-session prompt |
| `instructionsFilePath` | string | `""` | Instructions file |
| `extraArgs` / `args` | string[] | `[]` | Additional CLI args |
| `env` | object | `{}` | Environment variables |
| `timeoutSec` | number | `0` | Timeout |
| `graceSec` | number | `20` | Grace period |

### Execution

```bash
gemini --output-format stream-json [--resume <sessionId>] [--model <model>] \
  --approval-mode yolo [--sandbox / --sandbox=none] --prompt <prompt>
```

Prompt via `--prompt` flag (not stdin). Always passes `--approval-mode yolo`.

### Skill Sync

Persistent symlink mode into `~/.gemini/skills/`.

### Models

`auto` (default), `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.0-flash`, `gemini-2.0-flash-lite`.

---

## 5. `opencode_local` — OpenCode (local)

**Package**: `packages/adapters/opencode-local/`

### Config Schema

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `cwd` | string | `process.cwd()` | Working directory |
| `command` | string | `"opencode"` | CLI command |
| `model` | string | **required** | `provider/model` format (e.g. `openai/gpt-5.2-codex`) |
| `variant` | string | `""` | Reasoning variant: `minimal`-`max` |
| `dangerouslySkipPermissions` | boolean | `true` | Inject `permission.external_directory=allow` |
| `promptTemplate` | string | `"You are agent {{agent.id}}..."` | Run prompt |
| `bootstrapPromptTemplate` | string | `""` | First-session prompt |
| `instructionsFilePath` | string | `""` | Instructions file |
| `extraArgs` / `args` | string[] | `[]` | Additional CLI args |
| `env` | object | `{}` | Environment variables |
| `timeoutSec` | number | `0` | Timeout |
| `graceSec` | number | `20` | Grace period |

### Execution

```bash
opencode run --format json [--session <sessionId>] \
  [--model <model>] [--variant <variant>]
```

Prompt via **stdin**. Sets `OPENCODE_DISABLE_PROJECT_CONFIG=true`.

### Skill Sync

Persistent symlink mode into `~/.claude/skills/` (yes, the Claude skills directory).

### Models

`openai/gpt-5.2-codex` (default), `openai/gpt-5.4`, `openai/gpt-5.2`, `openai/gpt-5.1-codex-max`, `openai/gpt-5.1-codex-mini`.

---

## 6. `pi_local` — Pi (local)

**Package**: `packages/adapters/pi-local/`

### Config Schema

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `cwd` | string | `process.cwd()` | Working directory |
| `command` | string | `"pi"` | CLI command |
| `model` | string | **required** | `provider/model` format (e.g. `xai/grok-4`) |
| `thinking` | string | `""` | Thinking level: `off`, `minimal`-`xhigh` |
| `promptTemplate` | string | `"You are agent {{agent.id}}..."` | User prompt |
| `bootstrapPromptTemplate` | string | `""` | First-session prompt |
| `instructionsFilePath` | string | `""` | Appended to system prompt via `--append-system-prompt` |
| `extraArgs` / `args` | string[] | `[]` | Additional CLI args |
| `env` | object | `{}` | Environment variables |
| `timeoutSec` | number | `0` | Timeout |
| `graceSec` | number | `20` | Grace period |

### Execution

```bash
pi --mode json -p --append-system-prompt <systemPrompt> \
  [--provider <provider>] [--model <model>] [--thinking <level>] \
  --tools read,bash,edit,write,grep,find,ls \
  --session <sessionPath> --skill <skillsDir> <userPrompt>
```

Prompt via **positional argument**. Sessions stored as JSONL files in `~/.pi/paperclips/`.

### Skill Sync

Persistent symlink mode into `~/.pi/agent/skills/`.

### Models

Dynamic discovery via `pi --list-models`.

---

## 7. `openclaw_gateway` — OpenClaw Gateway

**Package**: `packages/adapters/openclaw-gateway/`

### Config Schema

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `url` | string | **required** | WebSocket URL (`ws://` or `wss://`) |
| `headers` | object | `{}` | Handshake headers |
| `authToken` | string | none | Shared gateway token |
| `password` | string | none | Gateway password |
| `deviceToken` | string | none | Device token |
| `devicePrivateKeyPem` | string | auto-generated Ed25519 | Device private key for pairing |
| `disableDeviceAuth` | boolean | `false` | Disable signed device auth |
| `clientId` | string | `"gateway-client"` | Gateway client ID |
| `clientMode` | string | `"backend"` | Gateway client mode |
| `role` | string | `"operator"` | Gateway role |
| `scopes` | string[] | `["operator.admin"]` | Gateway scopes |
| `sessionKeyStrategy` | string | `"issue"` | `"issue"`, `"fixed"`, or `"run"` |
| `sessionKey` | string | `"paperclip"` | Fixed session key |
| `payloadTemplate` | object | `{}` | Merged into gateway request |
| `timeoutSec` | number | `120` | Timeout |
| `autoPairOnFirstConnect` | boolean | `true` | Auto-approve device pairing |

### Execution

Pure WebSocket communication — no local process spawning. Opens WS connection, sends `agent` request with wake text, calls `agent.wait` for results. Supports Ed25519 device authentication and auto-pairing.

### Session Management

Managed via `sessionKeyStrategy` — sessions keyed per-issue, per-run, or fixed.

---

## 8. `hermes_local` — Hermes Agent

External npm package: `hermes-paperclip-adapter@^0.2.0`. Not included as a local package. Supports session resume, skill sync, and `supportsLocalAgentJwt: true`. Config is schema-driven.

---

## 9. `process` — Process (fallback)

**Source**: `server/src/adapters/process/`

### Config Schema

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `command` | string | **required** | Command to execute |
| `args` | string[] | `[]` | Command arguments |
| `cwd` | string | `process.cwd()` | Working directory |
| `env` | object | `{}` | Environment variables |
| `timeoutSec` | number | `0` | Timeout |
| `graceSec` | number | `15` | Grace period |

### Execution

Spawns command as child process. No prompt, no stdin, no output parsing. Returns exit code + stdout/stderr. This is the **fallback adapter** for unknown types.

### For Hackathon

This adapter is ideal for custom Python agents:

```json
{
  "adapterType": "process",
  "adapterConfig": {
    "command": "python3",
    "args": ["agents/my_agent.py"],
    "cwd": "/path/to/hackathon",
    "env": {
      "GEMMA_API_KEY": "your-key",
      "GEMMA_MODEL": "gemma-4"
    },
    "timeoutSec": 600
  }
}
```

No session management, no skill sync.

---

## 10. `http` — HTTP Webhook

**Source**: `server/src/adapters/http/`

### Config Schema

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `url` | string | **required** | Endpoint URL |
| `method` | string | `"POST"` | HTTP method |
| `headers` | object | `{}` | Request headers |
| `payloadTemplate` | object | `{}` | Merged with `{agentId, runId, context}` |
| `timeoutMs` | number | `0` | Request timeout |

### Execution

Makes HTTP `fetch()` to configured URL with JSON body. Returns `exitCode: 0` on 2xx response. No response body parsing. No session management. No skill sync.

---

## Adapter Comparison Matrix

| Adapter | Local Process | Session Resume | Skill Sync | Prompt Method | Workspace Strategy |
|---------|--------------|----------------|------------|---------------|-------------------|
| `claude_local` | Yes | Yes | Ephemeral bundle | stdin | git_worktree |
| `codex_local` | Yes | Yes | Ephemeral symlink | stdin | git_worktree |
| `cursor` | Yes | Yes | Persistent symlink | stdin | — |
| `gemini_local` | Yes | Yes | Persistent symlink | `--prompt` flag | — |
| `opencode_local` | Yes | Yes | Persistent symlink | stdin | — |
| `pi_local` | Yes | Yes (file-based) | Persistent symlink | positional arg | — |
| `openclaw_gateway` | No (WebSocket) | Strategy-based | No | WebSocket message | — |
| `hermes_local` | Yes | Yes | Yes | — | — |
| `process` | Yes | No | No | None | — |
| `http` | No (HTTP) | No | No | HTTP body | — |
