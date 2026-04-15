# AI-Docs Index — Paperclip Codebase Reference

> **Purpose**: This folder is the AI-native reference for any AI coding assistant (Claude, Codex, Cursor, Gemini, etc.) working on the Paperclip codebase or building capabilities on top of it during the 9xAI hackathon.
>
> **How to use**: Start with the doc most relevant to your task. Each doc is self-contained but cross-references others. Read `hackathon/HACKATHON_QUICKSTART.md` first if you're building for the Digital Twin hackathon.

---

## Quick Navigation

### Hackathon
- [Hackathon Quickstart](hackathon/HACKATHON_QUICKSTART.md) — START HERE for the 9xAI hackathon. Maps the 7 capabilities to Paperclip primitives.
- [Capability Mapping](hackathon/CAPABILITY_MAPPING.md) — Detailed mapping of each ministerial capability to Paperclip entities, org structures, and workflows.
- [Hackathon Reference (original)](hackathon_reference.txt) — The raw hackathon instruction set from 9xAI.

### Architecture
- [Architecture Overview](architecture/ARCHITECTURE_OVERVIEW.md) — Full system architecture, layers, data flow, and repo map.
- [Core Concepts](architecture/CORE_CONCEPTS.md) — Companies, agents, issues, heartbeats, goals, budgets, approvals — the mental model.

### API
- [API Reference](api/API_REFERENCE.md) — Every REST endpoint with methods, paths, request/response shapes.
- [API Auth](api/API_AUTH.md) — Authentication modes, API keys, session auth, agent JWTs.
- [API Patterns](api/API_PATTERNS.md) — Error codes, pagination, filtering, checkout semantics, activity logging.

### Agents & Adapters
- [Agent System](agents/AGENT_SYSTEM.md) — Agent lifecycle, adapter architecture, heartbeat system, wakeup flow.
- [Adapter Reference](agents/ADAPTER_REFERENCE.md) — Config schemas and behavior for each adapter type (Claude, Codex, Cursor, Gemini, OpenCode, Pi, OpenClaw, Process, HTTP).
- [Agent Permissions](agents/AGENT_PERMISSIONS.md) — What agents can and cannot do, permission keys, governance.

### Database
- [Database Schema](database/DATABASE_SCHEMA.md) — All tables, columns, types, indexes, and relationships.
- [Data Model Diagram](database/DATA_MODEL.md) — Visual entity relationship overview.

### UI
- [UI Architecture](ui/UI_ARCHITECTURE.md) — React app structure, routing, state management, API client.
- [UI Routes](ui/UI_ROUTES.md) — Every page route and what it renders.

### Plugins
- [Plugin System](plugins/PLUGIN_SYSTEM.md) — Plugin architecture, SDK API, manifest, lifecycle.

### Skills
- [Skills System](skills/SKILLS_SYSTEM.md) — How skills work, built-in skills, company skills.

### Guides
- [Dev Setup](guides/DEV_SETUP.md) — Getting Paperclip running locally for development.
- [Creating an Agent Company](guides/CREATING_COMPANY.md) — Step-by-step guide to creating a company with agents.
