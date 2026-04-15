# Skills System — Paperclip Agent Knowledge

> **Purpose**: Skills are markdown documents that teach agents how to do things at runtime. They are injected into agent instruction files and served via API.

---

## How Skills Work

1. **Skill documents** are markdown files (SKILL.md) with optional reference files
2. Skills can be **built-in** (shipped with Paperclip), **company-level** (added per company), or **imported** (from GitHub/skills.sh)
3. Agents receive skills as part of their adapter configuration — skills are synced to the agent's instruction files
4. Skills are served to agents via the API at `/api/skills/index` and `/api/skills/:skillName`

---

## Built-in Skills

### 1. `paperclip` — Core Heartbeat Skill

**Location**: `skills/paperclip/SKILL.md`  
**Purpose**: Teaches agents the Paperclip heartbeat execution model

Key content:
- **9-step heartbeat procedure**: Identity check → approval follow-up → get assignments → pick work → checkout → understand context → do work → update status → delegate
- **Checkout protocol**: `POST /api/issues/:id/checkout` with `X-Paperclip-Run-Id` header; 409 = someone else owns it
- **Issue lifecycle**: backlog → todo → in_progress → in_review → done/blocked/cancelled
- **Wake context env vars**: PAPERCLIP_TASK_ID, PAPERCLIP_WAKE_REASON, etc.
- **Issue dependencies**: blockedByIssueIds, automatic wakes on resolution
- **Comment style rules**: Markdown with ticket links
- **Planning**: Issue documents with key `plan`
- **Full API endpoint reference** with 50+ endpoints

Reference files:
- `references/api-reference.md` — Detailed API documentation
- `references/routines.md` — Routine management guide
- `references/company-skills.md` — Company skill management

### 2. `paperclip-create-agent` — Agent Hiring Skill

**Location**: `skills/paperclip-create-agent/SKILL.md`  
**Purpose**: Governance-aware agent creation workflow

Steps:
1. Confirm identity and company context
2. Discover adapter configuration docs (`/llms/agent-configuration.txt`)
3. Read adapter-specific docs (`/llms/agent-configuration/:type.txt`)
4. Compare existing agent configs in company
5. Pick an icon
6. Draft hire config (role, adapter, skills, reporting line)
7. Submit via `POST /api/companies/:companyId/agent-hires`
8. Handle approval governance

### 3. `paperclip-create-plugin` — Plugin Authoring Skill

**Location**: `skills/paperclip-create-plugin/SKILL.md`  
**Purpose**: Guide agents through plugin development

Covers:
- Plugin SDK usage
- Scaffold with `@paperclipai/create-paperclip-plugin`
- Manifest, worker, UI authoring
- Build/test/deploy workflow

### 4. `para-memory-files` — Agent Memory System

**Location**: `skills/para-memory-files/SKILL.md`  
**Purpose**: Persistent file-based memory using Tiago Forte's PARA method

Three layers:
- **Layer 1**: Knowledge graph in `$AGENT_HOME/life/` (Projects/Areas/Resources/Archives) with structured YAML files
- **Layer 2**: Daily notes in `$AGENT_HOME/memory/YYYY-MM-DD.md`
- **Layer 3**: Tacit knowledge in `$AGENT_HOME/MEMORY.md`

---

## Company Skills

Company-level skills are stored in the database and can be:

- **Created manually** — with name, slug, description, and markdown content
- **Imported from GitHub** — fetches SKILL.md from a GitHub repo/directory
- **Imported from skills.sh** — imports from the skills.sh registry
- **Discovered from project workspaces** — scans agent sync preferences

### API

```bash
# List company skills
GET /api/companies/:companyId/skills

# Create a skill
POST /api/companies/:companyId/skills
  { "name": "My Skill", "slug": "my-skill", "markdown": "# My Skill\n\n..." }

# Import from GitHub
POST /api/companies/:companyId/skills
  { "source": "github", "url": "https://github.com/org/repo/tree/main/skills/my-skill" }

# Get skill detail
GET /api/companies/:companyId/skills/:skillId

# Update skill file
PATCH /api/companies/:companyId/skills/:skillId/files/SKILL.md
  { "content": "# Updated content\n\n..." }

# Delete skill
DELETE /api/companies/:companyId/skills/:skillId
```

---

## Skill Sync to Agents

When skills are synced to an agent:
1. The skill content is written to the agent's instruction files directory
2. The adapter (Claude, Codex, etc.) reads the instruction files on next heartbeat
3. The agent gains the knowledge from the skill without retraining

Adapters that support skill sync:
- `claude_local` — Skills written as `.md` files alongside `CLAUDE.md`
- `codex_local` — Skills symlinked into `$CODEX_HOME/skills/`
- `cursor` — Skills written to Cursor rules directory
- `gemini_local` — Skills written to Gemini config
- `opencode_local` — Skills written to OpenCode config
- `pi_local` — Skills written to Pi config

---

## Creating Skills for the Hackathon

For each capability, create a skill that teaches your agents how to perform their role:

```markdown
# Executive Radar Analyst Skill

## Your Role
You are an analyst in the Executive Radar capability of the Minister's Digital Twin. 
Your job is to monitor modernization initiatives and detect early warning signs.

## What You Monitor
- Initiative timelines and milestone progress
- Budget utilization patterns
- Cross-entity dependency status
- Stakeholder sentiment indicators

## How to Produce Output
1. Gather data from your assigned sources
2. Apply analytical framework (risk/opportunity/slippage)
3. Score findings by severity and urgency
4. Write bilingual (AR/EN) summaries
5. Post findings as comments on your assigned issue
6. If critical finding: create a new high-priority issue

## Output Format
Always produce output in both Arabic and English:
- Start with Arabic summary
- Follow with English equivalent
- Include data citations

## Guardrails
- Never state certainty when data is incomplete — use confidence levels
- Always cite your data source
- Escalate findings with severity > 7/10 by creating a blocking issue
```
