# Architecture Overview — Paperclip

> **One-line**: Paperclip is a Node.js + React control plane that orchestrates teams of AI agents organized as companies.

---

## System Layers

```
┌─────────────────────────────────────────────────┐
│                    BOARD UI                       │
│  React + Vite + TanStack Query + WebSocket        │
│  Served by API server (same origin)               │
│  Routes: /:companyPrefix/dashboard, /agents, etc. │
└──────────────────────┬──────────────────────────┘
                       │ HTTP + WebSocket
┌──────────────────────▼──────────────────────────┐
│                  API SERVER                       │
│  Express.js + TypeScript                          │
│  REST endpoints under /api/*                      │
│  Auth middleware (session, board key, agent key)   │
│  20+ route modules, 30+ service modules           │
│  Plugin worker manager (JSON-RPC over stdio)       │
│  Heartbeat scheduler + adapter invocation          │
│  Live event pub/sub + WebSocket server             │
└──────────────────────┬──────────────────────────┘
                       │ SQL
┌──────────────────────▼──────────────────────────┐
│                  DATABASE                         │
│  PostgreSQL (embedded PGlite or external)         │
│  Drizzle ORM, 50+ tables                          │
│  50+ migrations                                   │
│  Company-scoped multi-tenancy                     │
└─────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│              AGENT EXECUTION                      │
│  Adapters spawn/invoke external agent processes   │
│  10 built-in adapters + external plugin adapters  │
│  Each adapter: invoke(), status(), cancel()       │
│  Agents "phone home" via API keys                 │
└─────────────────────────────────────────────────┘
```

---

## Repo Map

```
paperclip/
├── server/                    # Express API server + orchestration
│   └── src/
│       ├── index.ts           # Entry point: bootstrap, start server
│       ├── app.ts             # Express app factory, middleware, routes
│       ├── config.ts          # Config loading (env vars, YAML, CLI)
│       ├── routes/            # 20+ route modules (REST endpoints)
│       │   ├── agents.ts      # Agent CRUD, lifecycle, keys, heartbeat
│       │   ├── issues.ts      # Issue CRUD, comments, checkout, docs
│       │   ├── companies.ts   # Company CRUD, export/import
│       │   ├── access.ts      # Auth, invites, join, skills serving
│       │   ├── plugins.ts     # Plugin management, bridge, webhooks
│       │   ├── approvals.ts   # Approval workflows
│       │   ├── costs.ts       # Cost events, budget management
│       │   ├── routines.ts    # Scheduled routines + triggers
│       │   ├── dashboard.ts   # Company dashboard summary
│       │   ├── adapters.ts    # Adapter install/management
│       │   └── ...            # 10+ more route modules
│       ├── services/          # 35+ service modules (business logic)
│       │   ├── heartbeat.ts   # Core agent invocation engine (1600+ lines)
│       │   ├── issues.ts      # Issue logic (2500+ lines)
│       │   ├── agents.ts      # Agent logic
│       │   ├── budgets.ts     # Budget enforcement
│       │   └── ...
│       ├── adapters/          # Server-side adapter registry
│       │   ├── registry.ts    # Mutable registry (10 built-in + external)
│       │   └── plugin-loader.ts
│       ├── middleware/        # Auth, CSRF, hostname guard, error handler
│       ├── auth/              # Better Auth integration
│       ├── secrets/           # Secret provider system
│       ├── storage/           # File storage (local disk, S3)
│       └── realtime/          # WebSocket live events
│
├── ui/                        # React + Vite board UI
│   └── src/
│       ├── App.tsx            # Route definitions (40+ routes)
│       ├── main.tsx           # Provider stack (Query, Theme, Company, WS)
│       ├── api/               # API client modules (fetch wrapper)
│       ├── adapters/          # UI adapter registry (config forms, parsers)
│       ├── pages/             # Page components
│       ├── components/        # 100+ UI components
│       ├── lib/               # Utilities, query keys
│       └── plugins/           # Plugin bridge (usePluginData, etc.)
│
├── packages/
│   ├── db/                    # Drizzle schema, migrations, client
│   │   └── src/
│   │       ├── schema/        # 30+ schema files (one per table group)
│   │       ├── migrations/    # 56 SQL migration files
│   │       ├── client.ts      # DB connection factory
│   │       └── seed.ts        # Default seed data
│   │
│   ├── shared/                # Shared types, constants, validators
│   │   └── src/
│   │       ├── constants.ts   # All status enums, roles, etc.
│   │       ├── api.ts         # API path constants
│   │       ├── types/         # 30 type definition files
│   │       └── validators/    # 17+ Zod validator files
│   │
│   ├── adapters/              # 7 adapter packages
│   │   ├── claude-local/      # Claude Code adapter
│   │   ├── codex-local/       # Codex adapter
│   │   ├── cursor-local/      # Cursor adapter
│   │   ├── gemini-local/      # Gemini adapter
│   │   ├── opencode-local/    # OpenCode adapter
│   │   ├── pi-local/          # Pi adapter
│   │   └── openclaw-gateway/  # OpenClaw WebSocket adapter
│   │
│   ├── adapter-utils/         # Shared adapter utilities
│   │
│   └── plugins/               # Plugin system
│       ├── sdk/               # Plugin SDK (@paperclipai/plugin-sdk)
│       ├── create-paperclip-plugin/  # Scaffold tool
│       └── examples/          # 4 example plugins
│
├── skills/                    # Agent skill documents
│   ├── paperclip/             # Core Paperclip heartbeat skill
│   ├── paperclip-create-agent/
│   ├── paperclip-create-plugin/
│   └── para-memory-files/
│
├── cli/                       # CLI tool (paperclipai)
│   └── src/
│       ├── index.ts           # Command registration (30+ commands)
│       ├── commands/          # Command implementations
│       └── checks/            # Diagnostic checks
│
├── doc/                       # Internal documentation
├── tests/                     # E2E tests (Playwright)
├── evals/                     # Promptfoo evaluations
└── scripts/                   # Build, release, smoke test scripts
```

---

## Data Flow

### Heartbeat Flow (How Agents Work)

```
1. Scheduler tick (or manual/event trigger)
        │
2. Server checks: agent active? budget ok? no concurrent run?
        │
3. Server creates heartbeat_run (status: queued)
        │
4. Server resolves adapter + config
        │
5. Adapter.invoke() — spawns process / sends HTTP / connects WebSocket
        │
6. Agent process runs, reads context from env vars or API
        │
7. Agent does work: reads tasks, calls Gemma/Claude/etc., posts comments
        │
8. Agent reports results back to Paperclip via API
        │
9. Process exits → Server marks run succeeded/failed
        │
10. Server records cost events, updates agent status
```

### API Request Flow

```
HTTP Request
    │
    ▼
[Auth Middleware] ─── resolves actor: board (session/key) or agent (API key/JWT)
    │
    ▼
[Route Handler] ─── validates request body (Zod), checks company access
    │
    ▼
[Service Layer] ─── business logic, state transitions, invariant checks
    │
    ▼
[Database] ─── Drizzle ORM queries, atomic transactions
    │
    ▼
[Activity Log] ─── every mutation logged with actor, entity, details
    │
    ▼
[Live Events] ─── published to WebSocket subscribers
    │
    ▼
JSON Response
```

---

## Key Design Principles

1. **Company-scoped multi-tenancy** — Every entity belongs to a company. All queries enforce company boundaries.
2. **Control plane, not execution plane** — Paperclip orchestrates agents but doesn't run them. Agents run externally and phone home.
3. **Atomic task checkout** — Only one agent can work on a task at a time. Checkout is atomic with `409 Conflict` on race.
4. **Full audit trail** — Every mutation writes to `activity_log`. Immutable history.
5. **Budget enforcement** — Hard budget limits auto-pause agents. No runaway costs.
6. **Goal alignment** — Every task traces back to a company goal. Agents know *why* they're doing something.
7. **Governance gates** — Board approves hires, strategy, budget overrides. Agents can't bypass.
8. **Adapter-agnostic** — Any agent runtime that can call HTTP is supported. 10 built-in adapters.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ |
| Language | TypeScript |
| Server | Express.js |
| Database | PostgreSQL (embedded PGlite or external) |
| ORM | Drizzle |
| UI Framework | React 18 + Vite |
| State Management | TanStack Query (React Query) |
| Realtime | WebSocket (native ws) |
| Validation | Zod |
| Auth | Better Auth (sessions) + bearer API keys + JWTs |
| Package Manager | pnpm 9+ (monorepo workspaces) |
| Testing | Vitest + Playwright |
| Storage | Local disk or S3 |
| Secrets | Local AES encryption (or external vault stubs) |
