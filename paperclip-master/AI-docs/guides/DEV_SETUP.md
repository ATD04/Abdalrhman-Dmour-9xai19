# Dev Setup — Getting Paperclip Running

> **Requirements**: Node.js 20+, pnpm 9.15+

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/paperclipai/paperclip.git
cd paperclip
pnpm install

# Start dev server (API + UI, watch mode)
pnpm dev
```

This starts:
- **API**: `http://localhost:3100/api`
- **UI**: `http://localhost:3100` (served by API server)
- **Database**: Embedded PostgreSQL (auto-created at `~/.paperclip/instances/default/db/`)

No Docker, no external database required.

---

## One-Command Bootstrap

```bash
npx paperclipai onboard --yes
```

Or with `pnpm` from repo root:
```bash
pnpm paperclipai run
```

This does: auto-onboard → doctor check → start server.

---

## Health Check

```bash
curl http://localhost:3100/api/health
# {"status":"ok","version":"...","mode":"local_trusted"}

curl http://localhost:3100/api/companies
# [] (empty array, no companies yet)
```

---

## Key Commands

| Command | What It Does |
|---------|-------------|
| `pnpm dev` | Start API + UI in watch mode |
| `pnpm dev:once` | Start without file watching |
| `pnpm dev:server` | Server only (no UI) |
| `pnpm build` | Build all packages |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm test:run` | Run vitest tests |
| `pnpm db:generate` | Generate DB migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations |

---

## Reset Database

```bash
rm -rf ~/.paperclip/instances/default/db
pnpm dev
```

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | External PostgreSQL URL (leave unset for embedded) |
| `PAPERCLIP_HOME` | Override data directory (default: `~/.paperclip`) |
| `PAPERCLIP_INSTANCE_ID` | Instance name (default: `default`) |
| `ANTHROPIC_API_KEY` | For Claude adapter |
| `OPENAI_API_KEY` | For Codex adapter |
| `GOOGLE_AI_STUDIO_KEY` | For Gemini adapter |

---

## Data Directory Structure

```
~/.paperclip/
└── instances/
    └── default/
        ├── db/                    # Embedded PostgreSQL data
        ├── data/
        │   ├── storage/           # Uploaded files
        │   └── backups/           # Auto-backups
        ├── secrets/
        │   └── master.key         # Encryption key
        ├── workspaces/            # Agent home workspaces
        │   └── <agent-id>/
        └── config.json            # Instance config
```

---

## Docker Alternative

```bash
docker build -t paperclip-local .
docker run --name paperclip \
  -p 3100:3100 \
  -e HOST=0.0.0.0 \
  -e PAPERCLIP_HOME=/paperclip \
  -v "$(pwd)/data/docker-paperclip:/paperclip" \
  paperclip-local
```

Or with Compose:
```bash
docker compose -f docker/docker-compose.quickstart.yml up --build
```

---

## Authentication Modes

| Mode | When | How |
|------|------|-----|
| `local_trusted` | Default dev mode | All requests auto-authenticated as admin board |
| `authenticated` | Production/shared | Session auth + API keys required |

Start in authenticated mode:
```bash
pnpm dev --bind lan         # LAN access
pnpm dev --bind tailnet     # Tailscale only
```
