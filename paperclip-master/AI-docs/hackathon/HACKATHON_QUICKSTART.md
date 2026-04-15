# Hackathon Quickstart — Building the Digital Twin on Paperclip

> **Context**: 9xAI Hackathon — 3.5 days, 7 sprints, 7 mandatory capabilities for the Digital Twin of the Minister of Public Sector Development (Jordan). Paperclip is the orchestration layer. Gemma 4 is the reasoning model.

---

## What Paperclip Gives You (and What You Build On Top)

Paperclip is NOT an AI agent framework. It is the **control plane** — the org chart, task management, governance, coordination, and monitoring layer that your agents run inside.

Think of it this way:
- **Paperclip** = the company operating system (org structure, tasks, budgets, approvals, dashboards)
- **Gemma 4** = the brain inside each agent (reasoning, analysis, generation)
- **Your code** = the capabilities that connect the brain to the operating system

---

## Mapping the 7 Capabilities to Paperclip

Each capability maps to a **company** (or a team within a company) in Paperclip, with its own agents, org structure, and workflows.

| # | Capability | Paperclip Structure | What You Build |
|---|-----------|---------------------|----------------|
| 1 | Executive Radar | Company with CEO agent + analyst agents | Morning brief generation, risk detection, slippage alerts |
| 2 | Service Friction Intelligence | Team under a lead agent | Service pain mapping, friction diagnosis, simplification plans |
| 3 | Institutional Readiness Analyzer | Team with assessment agents | Readiness scorecards, maturity heatmaps, gap analysis |
| 4 | Policy Impact Assistant | Team with policy analyst agents | Policy comparison, impact assessment, tradeoff briefs |
| 5 | Cross-Entity Coordination Engine | Company with coordination agents | Dependency mapping, blocker tracking, ownership matrices |
| 6 | Citizen Voice Translator | Team with NLP/sentiment agents | Public feedback analysis, trust pulse, recurring issue synthesis |
| 7 | Ministerial Chief of Staff | CEO-level agent with executive assistants | Daily briefs, meeting prep, decision tracking, follow-up management |

---

## Architecture for Each Capability

Each capability should follow this pattern:

```
CAPABILITY (= a Team or Company in Paperclip)
├── Lead Agent (manages the capability)
│   ├── Analyst Agent 1 (does specific work)
│   ├── Analyst Agent 2 (does specific work)  
│   └── Reporter Agent (synthesizes and outputs)
├── Project (groups all issues/tasks for this capability)
│   ├── Issue: "Generate morning brief"
│   ├── Issue: "Analyze service friction data"
│   └── Issue: "Produce readiness scorecard"
├── Goal (what this capability achieves)
│   └── "Provide Minister with real-time situational awareness"
└── Routines (scheduled recurring work)
    ├── Daily: "Morning brief generation"
    └── Weekly: "Risk assessment update"
```

---

## Step-by-Step: Building a Capability

### 1. Start Paperclip
```bash
cd /path/to/paperclip
pnpm install
pnpm dev
# Open http://localhost:3100
```

### 2. Create Your Company
Either through the UI or via API:
```bash
curl -X POST http://localhost:3100/api/companies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Minister Digital Twin",
    "description": "Digital Twin of the Minister of Public Sector Development"
  }'
```

### 3. Define Goals
```bash
curl -X POST http://localhost:3100/api/companies/{companyId}/goals \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Provide ministerial intelligence for modernization oversight",
    "level": "company",
    "status": "active"
  }'
```

### 4. Create Agents (Your Agentic Team)

Each agent needs:
- An **adapter type** — how does it run? (use `process` adapter for custom scripts, `claude_local` for Claude Code, `http` for webhooks)
- A **role** — what is its job?
- A **reporting line** — who does it report to?
- **Adapter config** — the specific instructions/commands for this agent

```bash
# Create the CEO / Lead Agent
curl -X POST http://localhost:3100/api/companies/{companyId}/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Executive Radar Lead",
    "role": "ceo",
    "title": "Chief Intelligence Officer",
    "adapterType": "process",
    "adapterConfig": {
      "command": "python3",
      "args": ["scripts/executive_radar.py"],
      "cwd": "/path/to/your/capability",
      "env": {
        "GEMMA_API_KEY": "your-key",
        "CAPABILITY": "executive_radar"
      },
      "timeoutSec": 300
    },
    "capabilities": "Monitors modernization initiatives, detects risks, generates executive briefs"
  }'
```

### 5. Create Issues (Work Items)
```bash
curl -X POST http://localhost:3100/api/companies/{companyId}/issues \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Generate morning brief for modernization status",
    "description": "Analyze all active initiatives, identify slippage, risks, and opportunities. Output a concise ministerial brief.",
    "status": "todo",
    "priority": "high",
    "assigneeAgentId": "{agentId}",
    "projectId": "{projectId}",
    "goalId": "{goalId}"
  }'
```

### 6. Set Up Routines (Scheduled Work)
For recurring tasks like daily briefs:
```bash
curl -X POST http://localhost:3100/api/companies/{companyId}/routines \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Daily Executive Morning Brief",
    "description": "Generate and deliver the ministers morning briefing",
    "assigneeAgentId": "{agentId}",
    "projectId": "{projectId}"
  }'

# Then add a schedule trigger
curl -X POST http://localhost:3100/api/routines/{routineId}/triggers \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "schedule",
    "label": "Daily 7am",
    "cronExpression": "0 7 * * *",
    "enabled": true
  }'
```

### 7. Wire Up Your Gemma 4 Integration

Your agents need to call Gemma 4 for reasoning. The adapter config's `command` should point to a script that:

1. Reads the Paperclip context (task details, wake reason) from environment variables
2. Calls Gemma 4 API with the appropriate prompt  
3. Posts results back to Paperclip as comments/status updates

Key environment variables available to your scripts during heartbeat:
- `PAPERCLIP_API_URL` — Base URL of the Paperclip API
- `PAPERCLIP_AGENT_API_KEY` — Agent's API key for authentication
- `PAPERCLIP_TASK_ID` — Current task being worked on
- `PAPERCLIP_WAKE_REASON` — Why the agent was woken up
- `PAPERCLIP_COMPANY_ID` — The company context

---

## Bilingual (Arabic/English) Outputs

All capabilities must produce bilingual outputs. Implement this at the Gemma 4 prompt level:
- System prompt instructs the model to produce both Arabic and English outputs
- Store outputs in issue comments or documents with bilingual formatting
- Use Paperclip's document system (`PUT /api/issues/:id/documents/:key`) for structured bilingual outputs

---

## Integration Between Capabilities

The 7 capabilities should be able to share data. Paperclip enables this through:

1. **Cross-capability issues** — One capability can create issues in another's project
2. **Shared goals** — Capabilities can reference the same company goal
3. **Agent mentions** — Agents can @-mention each other in comments to trigger wakeups
4. **Issue dependencies** — Use `blockedByIssueIds` to create cross-capability dependencies
5. **Company-wide dashboard** — The dashboard aggregates status across all capabilities

---

## Sprint Strategy Recommendation

| Sprint | Capability | Why This Order |
|--------|-----------|----------------|
| 1 | Ministerial Chief of Staff (7) | Sets up the core coordination infrastructure — daily briefs, decision tracking |
| 2 | Executive Radar (1) | Builds on Chief of Staff with monitoring and alerting layer |
| 3 | Service Friction Intelligence (2) | First analytical capability — citizen-facing, high impact |
| 4 | Citizen Voice Translator (6) | Feeds into Service Friction with public feedback signals |
| 5 | Institutional Readiness Analyzer (3) | Assessment framework for institutions |
| 6 | Policy Impact Assistant (4) | Builds on readiness data for policy analysis |
| 7 | Cross-Entity Coordination Engine (5) | Ties everything together with dependency tracking |

This order builds from "operational core" outward to "analytical capabilities" and finally to "coordination," so each sprint can leverage what was built before.

---

## Key Files to Read

| File | Why |
|------|-----|
| `doc/GOAL.md` | Paperclip's mission and architecture philosophy |
| `doc/PRODUCT.md` | Core concepts (companies, agents, tasks, heartbeats) |
| `doc/SPEC-implementation.md` | V1 data model, API contract, state machines |
| `skills/paperclip/SKILL.md` | The agent-facing skill that teaches agents how to use Paperclip |
| `AI-docs/architecture/ARCHITECTURE_OVERVIEW.md` | Full system walkthrough |
| `AI-docs/api/API_REFERENCE.md` | Complete endpoint catalog |
