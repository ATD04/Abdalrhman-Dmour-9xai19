# Jordan National Policy Intelligence Platform (JNPI)
## Comprehensive Stakeholder Report
**Date:** March 16, 2026
**Classification:** Internal — Stakeholder Decision Use
**Status:** Platform ~75% Complete — Active Development

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Identity & Mission](#2-project-identity--mission)
3. [Architecture Overview](#3-architecture-overview)
4. [Service-by-Service Breakdown](#4-service-by-service-breakdown)
   - 4.1 [Knowledge Service](#41-knowledge-service)
   - 4.2 [Agent Service](#42-agent-service)
   - 4.3 [Governance Service](#43-governance-service)
   - 4.4 [Workflow Service](#44-workflow-service)
   - 4.5 [Frontend Application](#45-frontend-application)
5. [Data Corpus & Knowledge Base](#5-data-corpus--knowledge-base)
6. [Security Architecture](#6-security-architecture)
7. [AI & Technology Stack](#7-ai--technology-stack)
8. [CI/CD & DevOps](#8-cicd--devops)
9. [Delivery Status & Milestones](#9-delivery-status--milestones)
10. [Strengths & Advantages](#10-strengths--advantages)
11. [Risks, Weaknesses & Gaps](#11-risks-weaknesses--gaps)
12. [Operational Considerations](#12-operational-considerations)
13. [Strategic Recommendations](#13-strategic-recommendations)
14. [Appendix: Full API Reference](#14-appendix-full-api-reference)

---

## 1. Executive Summary

The Jordan National Policy Intelligence Platform (JNPI) is a production-grade, multi-agent AI system purpose-built for the Jordanian government. It ingests Arabic legal and policy documents from all major ministries and government bodies, and enables citizens, government employees, and administrators to query this corpus in natural language — receiving grounded, cited, confidence-scored answers.

The platform is not a chatbot. It is a modular, independently deployable, enterprise-grade intelligence system comprising five microservices: Knowledge, Agent, Governance, Workflow, and a React frontend. Three of its five services are assessed as production-ready. The platform currently holds documents spanning 20+ government ministries, the Jordanian Constitution, criminal statutes, and sector-specific legislation totalling hundreds of legal/policy PDFs, DOCX files, and presentations.

**What it does:**
- Answers Arabic legal and policy questions with citations to specific document pages
- Routes queries through specialist AI agents (Legal Affairs, Public Services, Policy Analysis, General Knowledge)
- Enforces role-based visibility (citizen / employee / admin)
- Detects outdated or amended legal clauses and warns users
- Scores answer confidence and escalates unresolved queries into a human-in-the-loop workflow
- Logs every query, response, and guardrail decision for governance and audit

**Current completion: approximately 75%.** The three core intelligence services (Knowledge, Agent, Governance) are complete. The Workflow service is scaffolded at MVP level. The frontend is functional but not production-polished.

---

## 2. Project Identity & Mission

| Field | Value |
|---|---|
| **Full Name** | Jordan National Policy Intelligence Platform |
| **Abbreviation** | JNPI |
| **Repository** | github.com/EzzoHamdan/Knowledge2 |
| **Primary Branch** | `main` |
| **Development Language** | Python (backend), TypeScript (frontend) |
| **AI Provider** | Google Gemini (Gemini 2.5 Flash, Gemini Embedding 2) |
| **Target Users** | Jordanian citizens, government employees, administrators |
| **Target Domain** | Legal intelligence, policy analysis, public service navigation |
| **Language of Operation** | Arabic-first, with RTL interface |
| **Deployment Model** | Docker Compose (all services containerized) |

### Mission Statement (from project docs)

> *"This is not a chatbot. This is not a student experiment. This is a modular, agentic, government-ready AI platform that analyzes, monitors, and explains Jordan's strategic policies and modernization programs."*

The platform was conceived against the backdrop of Jordan's Vision 2025 public sector modernization agenda. It aims to democratize access to legal and regulatory knowledge — enabling citizens to understand their rights, employees to navigate complex policy, and administrators to access confidential governance information — all within a single, secure, audited system.

### Guiding Architectural Mandates

1. Every service is independently deployable with a well-defined API contract
2. Every feature is a self-contained, reusable module
3. Every module must be documented
4. Arabic-first: RTL layout is non-negotiable, not an afterthought
5. Every answer must be verifiable — citations to source documents with page-level precision
6. The system must be observable: every interaction logged, audited, and measurable

---

## 3. Architecture Overview

The platform follows a microservices architecture where five independent services communicate over REST APIs. The dependency graph is strictly acyclic: the Frontend calls the Agent Service, which coordinates all other services. The Knowledge and Governance services are "downstream" dependencies. The Workflow service is a side-effect destination.

```
┌─────────────────────────────────────────────────────────────────┐
│                 BROWSER (Citizen / Employee / Admin)            │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS / REST
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│           FRONTEND  (React 19 + TypeScript + Tailwind)          │
│  Chat · Ticket Inbox · Admin Queue · Role Selector · Citations  │
│                        Port 5173 / 80                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │ REST
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AGENT SERVICE  (FastAPI)                    │
│  Router · 4 Specialist Agents · Confidence · Escalation         │
│  Citation Extraction · Amendment Detection · Self-Verification  │
│  Session Store · In-Memory Cache · Fire-and-Forget Audit        │
│                        Port 9200 / 8200                         │
└──────┬───────────────────────────────────────────┬─────────────┘
       │ REST (sync: guardrails)                   │ REST (sync: retrieval)
       │ REST (async: audit log, fire-and-forget)  │
       ▼                                           ▼
┌──────────────────────────┐       ┌───────────────────────────────┐
│  GOVERNANCE SERVICE      │       │     KNOWLEDGE SERVICE         │
│  (FastAPI)               │       │     (FastAPI)                 │
│  Input Guardrails        │       │  Ingestion Pipeline           │
│  Output Guardrails       │       │  Gemini Embedding 2 (768-dim) │
│  Audit Logging           │       │  Auto-Classification          │
│  Evaluation Framework    │       │  Version Tracking             │
│  Platform Metrics        │       │  Security Pre-Filtering       │
│  Port 9300 / 8300        │       │  SQLite + JSON Vector Store   │
└──────────────────────────┘       │  Page Image Serving           │
                                   │  Port 9100 / 8100             │
                                   └───────────────────────────────┘
                            │ REST (async: ticket creation)
                            ▼
               ┌────────────────────────────┐
               │    WORKFLOW SERVICE        │
               │    (FastAPI)               │
               │  Case CRUD API             │
               │  Timeline Events           │
               │  User Ticket Inbox         │
               │  Admin Assignment Queue    │
               │  FAQ Candidate Flagging    │
               │  Port 9400 / 8400          │
               └────────────────────────────┘
```

### Data Flow for a Single Query

1. User submits a question via the React chat interface
2. Agent Service receives the query and checks the **input guardrail** (Governance Service)
3. **Router Agent** classifies intent and selects the appropriate specialist agent
4. Specialist agent calls **Knowledge Service** for semantically relevant document chunks (pre-filtered by user visibility tier)
5. Agent constructs a grounded answer with citations; runs **amendment detection** and optionally **self-verification**
6. Agent checks the **output guardrail** (Governance Service) for hallucinations or compliance violations
7. **Confidence score** is computed using a weighted four-factor formula
8. If the answer is inadequate, the agent proposes **human escalation** and awaits user confirmation
9. **Audit log** is fired asynchronously to Governance Service
10. Response — including citations, confidence, timing breakdown — is returned to the frontend

---

## 4. Service-by-Service Breakdown

### 4.1 Knowledge Service

**Port:** 8100 (internal) / 9100 (Docker)
**Status:** Production-ready (100% complete)

The Knowledge Service is the foundational layer of the platform. It is responsible for transforming raw government documents into semantically searchable vector representations, and serving both document metadata and visual page renderings to other services.

#### Ingestion Pipeline

The ingestion pipeline is a multi-stage process triggered by file upload:

| Stage | Action | Technology |
|---|---|---|
| 1 | SHA-256 hash to detect duplicate ingestion | Python `hashlib` |
| 2 | Format conversion (DOCX → PDF) | LibreOffice headless |
| 3 | Chunking (page / paragraph / fixed) + PNG rendering | PyMuPDF (fitz) |
| 4 | AI-powered classification | Gemini 2.5 Flash |
| 5 | Auto-versioning (detect superseded documents) | Internal logic |
| 6 | Batch embedding | Gemini Embedding 2 (768-dim) |
| 7 | Storage | SQLite (metadata) + JSON files (vectors) + PNG files (pages) |

**Supported file formats:** `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.txt`, `.html`, `.htm`, `.docx`, `.pptx`

**Chunking strategies:**
- **Page-based** (default): one chunk per PDF page — naturally aligned with legal document structure
- **Paragraph-based**: useful for narrative policy documents
- **Fixed-size**: configurable token windows for dense technical content

#### Auto-Classification

On every ingest, Gemini 2.5 Flash reads the document and produces a structured metadata JSON:

| Field | Description | Example |
|---|---|---|
| `doc_type` | Document category | `law`, `regulation`, `circular`, `study` |
| `title` | Extracted Arabic title | `قانون الجرائم الإلكترونية` |
| `year` | Year of promulgation | `2023` |
| `sector` | One of 22 government sectors | `digital_economy` |
| `visibility` | Access tier | `public`, `internal`, `confidential` |
| `knowledge_level` | Depth tier | 1–4 |
| `is_amendment` | Boolean | `true` / `false` |
| `amends_target` | ID of the superseded document | `uuid-of-original` |
| `approval_status` | Workflow gate | `pending`, `approved` |

#### Semantic Search

Retrieval is a two-stage process: exact SQL pre-filtering followed by cosine similarity ranking.

```
SQL pre-filter:
  WHERE visibility IN (allowed_for_user_type)
  AND approval_status = 'approved'
  AND sector IN (query_sectors)  [if provided]

Cosine similarity ranking:
  Load matching embeddings from JSON → compute dot products → return top_k results
```

This design guarantees that **no confidential document can appear in a citizen's results**, regardless of query phrasing.

#### Versioning

When a new document is ingested with the same title as an existing one, the service automatically creates a new version record. Both original and amended versions remain active; the amendment relationship is tracked via `is_amendment` and `amends_target` fields, enabling the Agent Service to warn users about superseded clauses.

#### Storage Architecture

The service uses a deliberately simple, operationally lightweight storage stack:
- **SQLite** (WAL mode): document metadata, chunk records, version history
- **JSON files**: embedding vectors, stored per document (`{hash}_v{n}.json`)
- **PNG files**: page renderings, stored per document in numbered subdirectories

This avoids dependencies on Postgres, Redis, or dedicated vector databases — making the service deployable on minimal infrastructure.

#### Already-Ingested Documents

Three documents have been processed and are live in the vector store:
- `572a1a72_v1.json` — 136 pages (large legislative document)
- `acd024a8_v1.json` — 6 pages
- `d79a2432_v1.json` — 5 pages

---

### 4.2 Agent Service

**Port:** 8200 (internal) / 9200 (Docker)
**Status:** Production-ready (100% complete)

The Agent Service is the intelligence core of the platform. It orchestrates the full query-answer lifecycle, coordinating all other services and enforcing every security, quality, and governance constraint in the system.

#### Router Agent

Every incoming query passes through the Router Agent, which determines which specialist should handle it.

**Two-mode routing:**
1. **Concise mode (fast rule-based):** Pattern-matches keywords against known legal/service/comparison phrases. If matched with high confidence, skips the LLM call entirely, saving ~200–400ms latency.
2. **Detailed mode (LLM-based):** Calls Gemini 2.5 Flash with max 160 output tokens to classify intent and sector. Results are cached for 5 minutes using SHA-256 of the query + user context, so identical repeated queries pay zero latency.

**5 intent categories:**

| Intent | Description | Routes To |
|---|---|---|
| `legal_inquiry` | Questions about specific laws, articles, penalties | Legal Affairs Agent |
| `service_inquiry` | Questions about government services, procedures, eligibility | Public Services Agent |
| `policy_comparison` | Questions comparing policies across time or sectors | Policy Analysis Agent |
| `general_inquiry` | General factual or contextual questions | General Knowledge Agent |
| `out_of_scope` | Non-government, personal, irrelevant queries | Rejection (polite response, no ticket) |

**22 valid sectors:** Covers all major Jordanian ministries and cross-cutting domains including digital economy, finance, health, justice, education, water, agriculture, transport, energy, tourism, labour, interior, foreign affairs, culture, environment, investment, planning, youth, social development, higher education, and prime ministry.

#### 4 Specialist Agents

Each specialist agent:
- Inherits a shared `BaseAgent` that enforces security, session, and visibility rules
- Has a domain-specific system prompt loaded from the `prompts/` directory
- Calls Knowledge Service with `user_type` → `visibility` mapping applied
- Extracts citations with source ID, page number, and source name
- Returns a structured `AgentResponse` object

| Agent | Domain | Strengths |
|---|---|---|
| **Legal Affairs** | Laws, regulations, penalties, rights | Citation precision, amendment detection |
| **Public Services** | Government services, eligibility, fees | Step-by-step procedural guidance |
| **Policy Analysis** | Cross-policy comparison, strategic context | Multi-document synthesis |
| **General Knowledge** | Broad government context | Fallback for ambiguous queries |

#### 14-Step Query Pipeline

The full processing pipeline for every non-cached query:

```
 1. Check for pending escalation confirmation (yes/no carry-over from previous message)
 2. Input guardrail check (Governance Service — rule-only in concise mode, LLM in detailed)
 3. Check for explicit user-requested escalation ("talk to someone")
 4. Route query (rule-based or LLM, with 5-min cache)
 5. Out-of-scope check → polite rejection if applicable
 6. Load conversation history from SessionStore (SQLite, 24h TTL, max 20 turns)
 7. Build AgentContext (user_type, visibility, top_k, sector, mode)
 8. Dispatch to specialist agent(s) via delegation engine
 9. Extract citations from retrieved chunks
10. Amendment detection (flag superseded clauses)
11. Self-verification (optional — disabled by default, adds ~200ms)
12. Output guardrail (Governance Service — LLM checks for hallucination/compliance leaks)
13. Confidence scoring (weighted four-factor formula)
14. Escalation trigger check → if answer inadequate, propose ticket creation to user
15. Cache response for /confidence and /explain endpoint access
16. Persist to session store
17. Fire-and-forget async audit log to Governance Service
18. Return QueryResponse to frontend
```

#### Confidence Scoring Formula

```
confidence = (0.25 × chunk_support)
           + (0.35 × avg_similarity)
           + (0.15 × amendment_factor)
           + (0.25 × sector_match)

amendment_factor = 1.0  (no amendments detected)
                   0.7  (amendments exist — answer may be partially outdated)

If self-verification found issues: confidence -= 0.15
```

The confidence score is returned to the frontend and displayed to the user. Queries falling below the `CONFIDENCE_THRESHOLD` (default: 0.4) trigger the human escalation flow.

#### Escalation Flow

The escalation flow is one of the platform's most architecturally significant features, reflecting a mature understanding of AI system limitations:

1. Agent's `_looks_unanswered()` check detects low-quality answers (confidence below threshold, empty answer, hedging language)
2. Agent responds to the user asking: *"I was unable to find a confident answer. Would you like me to escalate this to a government official?"*
3. User's next message is captured — if "yes", a case is created in the Workflow Service
4. If the user is authenticated as a `guest`, they are prompted to sign up before a ticket can be opened
5. Out-of-scope rejected queries **never** create tickets — only genuine in-scope unanswered queries escalate

#### Caching Strategy

| Cache Layer | Key | TTL | Benefit |
|---|---|---|---|
| Routing result | SHA-256(query + user_type + sector + language) | 5 min | Skip LLM routing for repeat queries |
| Input guardrail | SHA-256(query + user_type + language) | 5 min | Skip LLM guardrail for benign query |
| Output guardrail | SHA-256(answer + citations + metadata) | 5 min | Skip LLM guardrail for identical output |
| Response data | Request ID (FIFO, max 1000 entries) | Session | Serve /confidence and /explain cheaply |

---

### 4.3 Governance Service

**Port:** 8300 (internal) / 9300 (Docker)
**Status:** Production-ready (100% complete)

The Governance Service provides the platform's trust and integrity layer. It operates as a standalone service that the Agent Service calls synchronously (for guardrails) and asynchronously (for audit logging).

#### Guardrail System

**Input guardrails** (checked before the query ever reaches a specialist agent):

| Category | What It Detects |
|---|---|
| `prompt_injection` | Attempts to override system instructions or extract model internals |
| `off_topic` | Queries with zero relevance to Jordanian government/policy |
| `policy_violation` | Politically sensitive or inappropriate content |
| `compliance_issue` | Queries that could create legal liability if answered by the system |

**Output guardrails** (checked after the specialist agent generates a response):

| Category | What It Detects |
|---|---|
| `hallucination` | Claims not grounded in retrieved chunks |
| `visibility_leak` | Confidential information surfaced in a response for a lower-tier user |
| `compliance_issue` | Responses that could create legal/regulatory liability |

**Two guardrail modes:**
- **Rule-only (fast):** Pattern matching, no LLM call. Used by default in Concise mode. Zero added latency.
- **LLM-based (thorough):** Gemini 2.5 Flash evaluates the query/response. Used in Detailed mode. Results cached to amortize cost.

#### Audit Logging

Every query processed by the Agent Service generates an audit record containing:

| Field | Description |
|---|---|
| `request_id` | Unique UUID per query |
| `session_id` | Links to conversation session |
| `query` | Full original query text |
| `user_type` | `citizen` / `employee` / `admin` |
| `intent` | Classified intent |
| `sector` | Classified sector |
| `agent_used` | Which specialist handled the query |
| `answer` | Full response text |
| `confidence` | Computed confidence score |
| `input_guardrail_result` | Pass/fail + category if failed |
| `output_guardrail_result` | Pass/fail + category if failed |
| `total_latency_ms` | End-to-end response time |
| `knowledge_latency_ms` | Knowledge Service retrieval time |
| `escalated` | Whether the query went to workflow |

Audit records are retained for 90 days (configurable) in a SQLite database.

#### Evaluation Framework

The service exposes an evaluation endpoint that can assess response quality on single queries, batches, or aggregate historical data. This supports ongoing quality monitoring and can be integrated into pre-release validation pipelines.

#### Platform Metrics

The `/metrics` endpoint exposes aggregate operational statistics:
- Total query volume and daily trend
- Average and P95 latency (milliseconds)
- Average confidence score
- Escalation rate (% of queries that created tickets)
- Guardrail rejection rate (% of queries blocked)
- Query distribution by sector
- Query distribution by agent type

---

### 4.4 Workflow Service

**Port:** 8400 (internal) / 9400 (Docker)
**Status:** Scaffolded — MVP functional, production features incomplete (~40%)

The Workflow Service manages the human-in-the-loop escalation layer. When the Agent Service cannot provide a confident grounded answer, it creates a "case" in the Workflow Service for review by a government official.

#### Case Data Model

```
case_id            UUID — unique case identifier
request_id         UUID — links to the original agent query
session_id         UUID — links to the conversation
user_id            string — who submitted the query
query              text — the original question
query_hash         SHA-256 of query — deduplication
user_type          citizen / employee / admin
sector_primary     primary classification sector
sector_labels[]    all matching sectors
priority           low / medium / high / urgent
status             open → pending → closed
assigned_to        admin user ID
escalation_reason  why the agent could not answer
confidence         the agent's confidence score at escalation time
resolution_answer  the answer provided by the human official
is_faq_candidate   boolean — should this become a knowledge base entry?
timeline[]         array of timestamped events (assignment, notes, resolution)
```

#### API Capabilities (MVP)

- Create a new escalated case
- List cases with filters (status, sector, priority, assigned user)
- Get full case details with timeline
- Update case status, priority, assignment
- Add internal notes to timeline
- Resolve a case with a human-provided answer
- View a user's own ticket inbox
- Flag a resolved case as an FAQ candidate

#### Missing Production Features

The following workflow capabilities are documented in the plan but not yet implemented:

- SLA enforcement (auto-escalate urgent cases exceeding time limits)
- Real-time notification system (email / push on case updates)
- Supervisor override and reassignment workflows
- FAQ pipeline (automatically promote FAQ candidates to the knowledge base)
- Bulk operations for admin users
- Reporting and workload analytics dashboards

---

### 4.5 Frontend Application

**Port:** 5173 (dev) / 80 (Docker/nginx)
**Status:** MVP implemented, production polish incomplete (~60%)

The frontend is a single-page React 19 application written in TypeScript, served in production by nginx. The entire UI currently lives in a single ~1800-line `App.tsx` file.

#### User Roles and Views

| Role | Access | Views |
|---|---|---|
| `guest` | Unauthenticated visitor | Chat (limited — cannot create tickets) |
| `user` | Authenticated citizen/employee | Chat + Ticket Inbox |
| `admin` | Government administrator | Chat + Ticket Inbox + Admin Queue |

#### Key UI Features

**Chat Interface:**
- Full Arabic RTL support
- Conversation history with multi-session management
- Two query modes: Concise (fast) and Detailed (comprehensive)
- Inline confidence score display on every response
- Citation cards showing source name, document title, and page number
- Escalation confirmation dialog (yes/no prompt when agent cannot answer)
- Guest-to-signup prompt gate for ticket creation
- Framer Motion animations for message transitions
- React Markdown rendering for structured agent responses

**Document Citations:**
- Each citation links to the actual PDF page image served by the Knowledge Service
- `source_id` + `page` → HTTP call to Knowledge Service `/sources/{id}/page/{n}`
- Users can visually verify exactly which document page contains the cited information

**Ticket Inbox (user view):**
- Lists open, pending, and closed tickets
- Shows escalation reason and resolution answer when available

**Admin Queue:**
- Lists all escalated tickets across all users
- Assignment and resolution UI

**Authentication:**
- Local-storage based simulation (no production auth backend yet)
- `StoredUser` array with simulated login/signup flows
- Role switching UI for demo purposes

#### Technology Stack

| Technology | Version | Role |
|---|---|---|
| React | 19.2.4 | UI framework |
| TypeScript | 5.9.3 | Type safety |
| Vite | 8.0.0 | Build tool and dev server |
| Tailwind CSS | 3.4.19 | Utility-first styling |
| Framer Motion | 12.36.0 | Animations |
| Recharts | 3.8.0 | Admin metrics visualization |
| Lucide React | 0.577.0 | Icon library |
| React Markdown | 10.1.0 | Markdown rendering in agent responses |
| nginx | 1.27-alpine | Production HTTP server |

---

## 5. Data Corpus & Knowledge Base

The `Minsitries_Data/` directory contains the raw government document corpus intended for ingestion. It represents a comprehensive collection of Jordanian legal and regulatory documents across all major government sectors.

### Covered Ministries and Bodies

| Entity | Document Types | Example Documents |
|---|---|---|
| Prime Ministry | Laws, circulars | Prime Ministry regulations |
| Ministry of Interior | Laws | Interior ministry legislation |
| Ministry of Justice | Laws, regulations | Justice legislation |
| Ministry of Finance | Laws, regulations | Financial legislation |
| Ministry of Health | Laws, regulations | Health laws |
| Ministry of Education | Laws, regulations | Education legislation |
| Ministry of Higher Education | 4 documents | Higher Education Law, University Licensing, Admission Criteria, Certificate Equivalency |
| Ministry of Digital Economy | Laws, regulations | Digital economy legislation |
| Ministry of Labour | Laws | Labour laws and regulations |
| Ministry of Energy | Laws, regulations | Energy sector legislation |
| Ministry of Agriculture | 2 PDFs + 1 DOCX | Agricultural laws |
| Ministry of Water | Laws | Water management legislation |
| Ministry of Social Development | 2 PDFs + 1 DOCX | Associations Law, National Aid Fund Law |
| Ministry of Investment | Laws | Investment regulations |
| Ministry of Planning | Reports | Foreign aid reports (special collection) |
| Ministry of Tourism | Laws | Tourism legislation |
| Ministry of Youth | Laws | Youth legislation |
| Ministry of Culture | Laws | Cultural heritage legislation |
| Ministry of Transport | Laws | Transport regulations |
| Ministry of Public Works | Laws | Public works legislation |
| Ministry of Environment | Laws | Environmental regulations |
| Ministry of Foreign Affairs | Laws | Foreign affairs legislation |
| Ministry of Political & Parliamentary Affairs | Laws | Parliamentary legislation |
| Cybercrime | 2 PDFs | Cybercrime Law 17/2023, Cybercrime Law 27/2015 |
| Civil Status | 1 PDF | Civil Status Law 2001 |
| General Legislation (التشريعات) | ~31 documents | Cross-cutting legislation |
| Studies (الدراسات) | ~9 documents | Policy research and studies |

### Cross-Cutting Documents

| Document | Type | Significance |
|---|---|---|
| `الدستور_2022.pdf` | Constitution | Jordan Constitution 2022 — foundational document |
| `قانون-السير-2023.pdf` | Law | Traffic Law 2023 |
| `قانون_الجنسية_الأردنية_رقم_6_لسنة_1954` | DOCX | Nationality Law |
| `قانون_جوازات_السفر_رقم_2_لسنة_1969` | DOCX | Passport Law |
| `قانون_منع_الجرائم_رقم_7_لسنة_1954` | DOCX | Crime Prevention Law |

### Document Language

All documents are in Arabic. The platform handles Arabic text natively:
- Gemini Embedding 2 achieves 59.6% win rate on Arabic retrieval benchmarks (vs ~38% for OpenAI alternatives)
- Gemini 2.5 Flash classifier reads and classifies Arabic document content
- No OCR required — Gemini uses visual embeddings of rendered PDF pages

### Ingestion Status

Of the full corpus in `Minsitries_Data/`, only **3 documents** have been embedded and are currently live in the vector store. The remainder of the corpus has not yet been ingested. This is a significant operational gap — the platform's intelligence quality is only as good as the documents in its vector store.

---

## 6. Security Architecture

Security is multi-layered and enforced at every tier of the stack.

### Role-Based Access Control (RBAC)

```
User Type    →    Visibility Tier    →    Accessible Documents
---------         ---------------         --------------------
citizen      →    public             →    Public laws, citizen-facing regulations
employee     →    internal           →    Public + internal ministry documents
admin        →    confidential       →    All documents including confidential
```

This mapping is applied at the **Agent Service** level on every query (converted from `user_type` to visibility tier before calling the Knowledge Service), and enforced again at the **Knowledge Service** SQL level as a mandatory WHERE clause filter. There is no code path by which a citizen can receive confidential content.

### Document Approval Gating

Documents in the knowledge base carry an `approval_status` field. Only documents with `approval_status = 'approved'` are returned in search results. This allows administrators to ingest documents without immediately exposing them to users — a staging gate for content governance.

### Input Guardrails

The Governance Service checks every query for:
- **Prompt injection**: Attempts to subvert the AI system's instructions
- **Off-topic queries**: Non-government content that consumes resources without serving the mission
- **Policy violations**: Politically sensitive or inappropriate content
- **Compliance issues**: Queries that would create liability if processed

### Output Guardrails

Before any response is returned to the user, the Governance Service checks for:
- **Hallucinations**: Claims not supported by retrieved document chunks
- **Visibility leaks**: Confidential information appearing in a lower-tier response
- **Compliance issues**: Responses that may create legal liability for the platform

### Session Security

- User type (`citizen` / `employee` / `admin`) is set at session creation and **cannot be escalated mid-session**
- Sessions expire after 24 hours
- Maximum 20 turns per conversation depth

### Audit Trail

Every interaction generates an immutable audit log record stored for 90 days. This satisfies government-grade accountability requirements and provides a forensic trail for any disputed interactions.

---

## 7. AI & Technology Stack

### Core AI Models

| Model | Purpose | Notes |
|---|---|---|
| **Gemini 2.5 Flash** | Agent reasoning, routing, classification, guardrails | Primary LLM; chosen for speed and Arabic capability |
| **Gemini Embedding 2** | Document and query embedding | 768-dim used in practice (supports 3072/1536/768 via MRL) |

### Why Gemini

The choice of Google Gemini is well-justified in the project documentation:

| Metric | Gemini Embedding 2 | OpenAI Alternative |
|---|---|---|
| **Arabic ARCD win rate** | 59.6% | ~38% |
| **MTEB score** | 68.32 | Lower |
| **Cost per 10,000 docs** | ~$9.60 (no OCR needed) | ~$46.50 (requires OCR preprocessing) |
| **Arabic PDF handling** | Native visual embedding of page images | Requires OCR pipeline |

For an Arabic-language government platform, Gemini's Arabic superiority is a decisive technical advantage.

### Backend Stack

| Technology | Version | Role |
|---|---|---|
| Python | 3.11 | As runtime for all backend services |
| FastAPI | ≥0.115.0 | Web framework |
| Uvicorn | ≥0.30.0 | ASGI server |
| Pydantic | ≥2.0.0 | Data validation and schema enforcement |
| SQLite | — | Persistence (metadata, sessions, audit logs, vectors) |
| PyMuPDF | ≥1.24.0 | PDF rendering and page extraction |
| LibreOffice | headless | DOCX-to-PDF conversion |
| Tesseract OCR | + Arabic language pack | Fallback OCR for scanned documents |
| python-docx | ≥1.0.0 | DOCX parsing |
| python-pptx | ≥0.6.23 | PPTX parsing |
| aiosqlite | ≥0.20.0 | Async SQLite access |
| httpx | ≥0.27.0 | Async HTTP client for inter-service calls |

### Infrastructure Stack

| Technology | Role |
|---|---|
| Docker | All services containerized |
| Docker Compose | Multi-service orchestration |
| nginx 1.27 | Frontend production serving + SPA routing |
| GitHub Actions | CI/CD: Python syntax validation, Docker build validation, CodeQL security scanning |

---

## 8. CI/CD & DevOps

### Pipelines

Three GitHub Actions workflows are configured:

| Pipeline | Trigger | What It Does |
|---|---|---|
| `ci-python.yml` | Push to `main`, any PR | Installs all Python dependencies for all 4 backend services; validates syntax via `compileall` |
| `docker-build.yml` | Push to `main`, any PR | Builds Docker images for knowledge, agent, and governance services (no push — validation only) |
| `codeql.yml` | Push to `main`, any PR | Static security analysis via GitHub CodeQL |

### Known CI Issue

Both `ci-python.yml` and `docker-build.yml` reference the path `Knowledge_Management/services/...`, which is a **legacy path** that no longer matches the actual repository structure (`app/services/...`). This means CI pipelines are likely broken for the current repository layout and will not actually validate the code as expected. This is a **medium-priority bug** that needs fixing before any production release.

### Deployment Model

All services are defined in `/app/docker-compose.yml` with named volumes for persistent data:

| Service | Internal Port | Docker External Port | Volume |
|---|---|---|---|
| frontend | 80 | 5173 | — |
| knowledge-service | 8100 | 9100 | `knowledge-data` |
| agent-service | 8200 | 9200 | `agent-data` |
| governance-service | 8300 | 9300 | `governance-data` |
| workflow-service | 8400 | 9400 | `workflow-data` |

**Dependency order:** `knowledge-service` starts before `agent-service`, which starts before `governance-service` and `workflow-service`. Frontend starts after `agent-service`.

### Missing DevOps Maturity

- No Kubernetes or Helm config for production-scale deployment
- No health check configuration in Docker Compose (services depend on each other by name, not readiness)
- No secrets management (API keys in `.env` files, no Vault/Secrets Manager integration)
- No horizontal scaling configuration
- No production logging aggregation (no ELK/Loki stack)
- No rate limiting at the API gateway level

---

## 9. Delivery Status & Milestones

### Current Status By Service

| Service | Completion | Production Ready? | Notes |
|---|---|---|---|
| Knowledge Service | 100% | Yes | Full ingestion pipeline, semantic search, versioning |
| Agent Service | 100% | Yes | Full multi-agent pipeline, escalation, confidence |
| Governance Service | 100% | Yes | Guardrails, audit, metrics, evaluation |
| Frontend | ~60% | No | MVP functional, single-file, no real auth |
| Workflow Service | ~40% | No | CRUD scaffolded, SLA and notifications missing |
| **Overall Platform** | **~75%** | **Partial** | Core intelligence ready, operational layer incomplete |

### Milestone Timeline (Actual)

| Milestone | Target | Completed | Status |
|---|---|---|---|
| M1: Knowledge Engine | March 12, 2026 | March 12, 2026 | Done |
| M2: Agent Orchestration | March 15, 2026 | March 15, 2026 | Done |
| M3: Governance & Platform | March 15, 2026 | March 15, 2026 | Done |
| M4: Workflow & HITL | TBD | Partial | In progress |
| M5: Frontend Production | TBD | Partial | In progress |
| M6: Full Corpus Ingestion | TBD | Not started | Planned |

---

## 10. Strengths & Advantages

### Technical Strengths

**1. Exceptional Arabic AI Performance**
The platform's selection of Gemini Embedding 2 is technically superior for Arabic. At a 59.6% Arabic retrieval win rate versus OpenAI's ~38%, the system will return more accurate source passages for Arabic legal queries. This is a non-trivial advantage for a government platform operating exclusively in Arabic.

**2. Cost-Effective Embedding**
The no-OCR visual embedding approach reduces ingestion cost from ~$46.50 to ~$9.60 per 10,000 documents — an 80% cost reduction. At government scale, this compounds significantly.

**3. Layered Security with No Single Point of Failure**
Security is enforced at three independent layers: Agent Service (user_type mapping), Knowledge Service (SQL WHERE clause), and Governance Service (output guardrail). A bug in any single layer cannot alone expose confidential data.

**4. Grounded Answers with Page-Level Citations**
Every response includes citations that map to specific document pages, served as PNG images directly from the knowledge base. Users can visually verify every claim. This is a critical trust feature for legal and policy content.

**5. Amendment Awareness**
The platform understands that laws get amended over time and warns users when a cited clause may have been superseded. This is sophisticated legal-domain knowledge rarely found in general AI systems.

**6. Human Escalation with Confirmation Gate**
Instead of silently failing when it cannot answer, the platform proposes ticket creation and waits for user consent. The system never auto-creates tickets for out-of-scope rejections, preventing spam in the workflow queue.

**7. Confidence Transparency**
Every answer carries a numerically computed confidence score, with its components (chunk support, similarity, amendment factor, sector match) interpretable by the system. Users and administrators can see why a score is low.

**8. Modular Microservice Architecture**
Each service is independently deployable, independently scalable, and independently testable. A new LLM provider can be swapped in the Agent Service without touching the Knowledge Service. The Workflow Service can be replaced entirely without disrupting the intelligence pipeline.

**9. Full Observability**
The Governance Service captures latency, confidence distribution, escalation rate, sector distribution, and guardrail rejection rate at P95 granularity. Administrators have genuine operational visibility.

**10. Comprehensive Document Corpus**
The `Minsitries_Data/` corpus covers every major Jordanian ministry and cross-cutting legislation including the 2022 Constitution, criminal statutes, civil status law, and sector-specific regulations. Once fully ingested, this represents one of the most comprehensive Arabic legal knowledge bases in an AI system.

### Strategic Strengths

**1. Government-Grade Design Philosophy**
The platform was explicitly designed as a government system, not retrofitted from a consumer product. This is reflected in every design decision: audit logging by default, human-in-the-loop escalation, multi-tier access control, compliance guardrails.

**2. Alignment with Jordan's Modernization Agenda**
The project documentation explicitly references Jordan's Prime Ministry roadmap and Vision 2025. The platform positions itself as infrastructure for public sector digital transformation, not a standalone tool.

**3. Citizen-Facing Accessibility**
By enabling citizens to query the full body of Jordanian law in plain Arabic and receive cited, grounded answers, the platform democratizes legal knowledge that was previously accessible only to legal professionals.

**4. Knowledge Accumulation**
The FAQ candidate system, where unresolved escalated cases can be flagged to enter the knowledge base, creates a virtuous cycle: every gap in the system's knowledge becomes a structured improvement opportunity.

---

## 11. Risks, Weaknesses & Gaps

### Technical Risks

**1. Single-File Frontend — Critical Technical Debt**
The entire frontend application is implemented in a single ~1,800-line `App.tsx` file. This is not scalable. As features grow, this file will become unmaintainable. It currently mixes types, state, business logic, and rendering in a flat file. This must be refactored into components and hooks before production.

**2. Simulated Authentication — No Production Auth**
The frontend uses a local-storage array to simulate login/signup. There is no session token, JWT, OAuth2, or any real authentication mechanism. Every "logged in" user could be any user. This is a **critical blocker for production deployment** and represents a serious security gap.

**3. SQLite + JSON File Storage — Scalability Ceiling**
The platform uses SQLite (WAL mode) and flat JSON files for vector storage. While pragmatic for a prototype, this architecture has a hard scalability ceiling. Under concurrent multi-user load:
- SQLite WAL mode handles read concurrency but serializes writes
- Loading entire JSON embedding files into memory per query becomes expensive at scale (currently only 3 docs, but the full corpus is hundreds of files)
- No connection pooling, no read replicas, no database clustering
For a national government platform at scale, this will need migration to PostgreSQL + pgvector or a dedicated vector database (Pinecone, Weaviate, Qdrant).

**4. Broken CI/CD Pipelines**
Both `ci-python.yml` and `docker-build.yml` reference the wrong directory path (`Knowledge_Management/services/...` instead of `app/services/...`). This means the platform currently has no working automated CI validation. Code merges to `main` are not being validated.

**5. No Rate Limiting or Abuse Protection**
There is no API gateway, rate limiter, or DDoS protection in the current architecture. All services are directly accessible. A public-facing deployment without rate limiting is vulnerable to resource exhaustion attacks.

**6. In-Memory Session Store Volatility**
Session state (pending escalation confirmations, conversation history) is stored in SQLite but intermediate state like "pending escalation" is held in memory. Any service restart clears this state, disrupting active conversations mid-flow.

**7. Corpus Ingestion Not Complete**
Of hundreds of documents in the corpus directory, only 3 have been embedded. The platform's answer quality is directly limited by the documents in its vector store. A platform intended to cover all of Jordan's legal framework currently cannot answer questions about 95%+ of its stated document corpus.

**8. No Kubernetes or Production Orchestration**
Docker Compose is suitable for single-machine development. A national government platform requires Kubernetes (or equivalent) for:
- High availability (multiple replicas per service)
- Auto-scaling under load
- Zero-downtime deployments
- Secrets management
- Persistent volume claims on distributed storage

**9. No Observability Stack**
There is no log aggregation (ELK, Loki), distributed tracing (Jaeger, Zipkin), or external metrics pipeline (Prometheus/Grafana). The Governance Service provides internal metrics, but there is no way to correlate logs across services or set alerts.

**10. Knowledge Service Memory Footprint**
On each semantic search, the Knowledge Service loads JSON embedding files from disk. With 3 documents this is trivial. With 500 documents and many concurrent users, loading and cosine-scoring thousands of embeddings per query in Python will become a significant bottleneck.

### Operational Risks

**11. Single LLM Provider Dependency (Google Gemini)**
The entire platform — routing, classification, answering, guardrails, embeddings — depends on a single AI provider. A Google Gemini API outage, pricing change, rate limit, or deprecation would halt the entire system. There is no fallback model configuration.

**12. No Secrets Management**
API keys (Google Gemini) are configured via `.env` files. In a production deployment, these should be managed by a secrets management system (HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager). Hardcoding or leaving keys in environment files creates exposure risk if the environment ever leaks.

**13. Workflow Service Severely Incomplete**
The Workflow Service is missing SLA enforcement, real-time notifications, supervisor workflows, FAQ promotion pipeline, and reporting. Without these, human reviewers have no alerting when urgent cases arrive and no structured path for case resolution quality to feed back into the knowledge base.

**14. No Backup or Disaster Recovery Plan**
The knowledge database, vector files, and audit logs are stored in Docker named volumes. There is no documented backup strategy, no offsite replication, and no documented recovery procedure.

**15. Frontend Has No Internationalization (i18n) Framework**
While the platform claims Arabic-first, the frontend codebase does not use an i18n framework. Switching between Arabic and English UI (for bilingual government contexts) would require extensive code changes.

---

## 12. Operational Considerations

### Deployment Requirements

To deploy the platform today:

1. **Infrastructure:** A Linux server with Docker and Docker Compose installed. Minimum estimated specs for demo/pilot: 4 CPU cores, 8GB RAM, 50GB storage. Production minimum: 8 cores, 16GB RAM, 500GB storage (for full corpus pages and vectors).

2. **API Keys:** A valid Google Gemini API key with billing enabled. The key must be placed in `.env` files for all services (knowledge-service, agent-service, governance-service).

3. **Document Ingestion:** The `Minsitries_Data/` corpus must be ingested by calling the Knowledge Service `/ingest` or `/ingest/batch` endpoint with appropriate sector/visibility metadata. This is a manual operational step not yet automated.

4. **Service Start Order:** `docker compose up --build` from the `/app/` directory. Services start in dependency order automatically.

### Estimated Ongoing Costs

| Cost Item | Estimate | Notes |
|---|---|---|
| Gemini API (queries) | Variable | Depends on query volume; Gemini Flash is cost-optimized |
| Gemini API (ingestion) | ~$9.60 / 10,000 docs | One-time cost per document |
| Infrastructure (cloud VM) | ~$200–500/month | Depends on cloud provider and tier |
| Storage | ~$20–50/month | For vectors, pages, audit logs |

### Performance Characteristics

| Metric | Concise Mode | Detailed Mode |
|---|---|---|
| Routing | ~0ms (rule-based, cached) | ~200–400ms (LLM) |
| Guardrail (input) | ~0ms (rule-only) | ~200–400ms (LLM) |
| Knowledge retrieval | ~100–300ms | ~100–300ms |
| Agent generation | ~500–800ms | ~800–1500ms |
| Output guardrail | ~0ms (cached) | ~200–400ms (LLM) |
| **Total estimated** | **~600ms–1.1s** | **~1.5s–3s** |

These are estimated based on documented optimizations. Actual latency depends on Google Gemini API response times, network conditions, and server load.

---

## 13. Strategic Recommendations

### Immediate (Before Any Production Deployment)

1. **Fix CI/CD path references.** The broken pipelines (`Knowledge_Management/services/...` → `app/services/...`) must be corrected. Zero automated validation on `main` is unacceptable for a production system.

2. **Implement real authentication.** Replace local-storage simulation with JWT or OAuth2 (Google/ADFS/Keycloak). Define role assignment and provisioning flows. This is the single most critical security gap.

3. **Automate corpus ingestion.** Create a batch ingestion script that walks the `Minsitries_Data/` directory and submits all documents to the Knowledge Service with correct metadata. The 3-of-hundreds ingestion gap must be closed.

4. **Add Docker health checks.** `depends_on` by name does not guarantee a service is *ready* before dependents start. Add `healthcheck` entries to `docker-compose.yml` using each service's `/health` endpoint.

### Short-Term (0–3 Months)

5. **Refactor the frontend.** Break `App.tsx` into components, hooks, and separate type files. Establish a `src/components/`, `src/pages/`, `src/hooks/`, `src/types/` structure.

6. **Complete the Workflow Service.** Implement SLA alerting, email/push notifications for case updates, supervisor escalation paths, and the FAQ-to-knowledge-base promotion pipeline.

7. **Evaluate storage migration path.** Benchmark the JSON vector store under 500+ documents and realistic concurrency. Prototype a pgvector or Qdrant migration before load becomes a problem.

8. **Add rate limiting.** Implement a rate limiter (nginx `limit_req_zone` or an API gateway like Kong/Traefik) before any public-facing deployment.

9. **Implement API key rotation and secrets management.** Move Gemini API keys to environment-injected secrets in production (Docker secrets, Vault, or cloud-native secrets manager).

### Medium-Term (3–9 Months)

10. **Kubernetes migration.** Translate the Docker Compose stack to Helm charts or Kustomize manifests for Kubernetes. Design for multi-replica deployments of the Agent Service (stateless) and Governance Service.

11. **Add a second LLM fallback.** Introduce configuration for a fallback model (e.g., Anthropic Claude or a locally-hosted Ollama instance) for routing and generation, to reduce single-provider dependency risk.

12. **Implement observability stack.** Deploy Prometheus + Grafana for metrics, Loki for log aggregation, and configure alerts for P95 latency, confidence degradation, and error rates.

13. **Document management admin UI.** Build an administrative interface for ingesting new documents, setting visibility levels, approving documents for production, and triggering re-ingestion after updates.

14. **Legal disclaimer and terms.** For citizen-facing deployment, add a legal disclaimer that AI answers are informational and not legal advice. The governance team should review output guardrail prompts with a legal advisor.

---

## 14. Appendix: Full API Reference

### Knowledge Service (Port 8100 / 9100)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health check |
| `POST` | `/ingest` | Ingest a single document (multipart form: file + metadata) |
| `POST` | `/ingest/batch` | Ingest multiple documents in one request |
| `POST` | `/retrieve` | Semantic search (body: query, user_type, sector, top_k, min_score) |
| `GET` | `/sources` | List all ingested documents |
| `DELETE` | `/sources/{id}` | Delete a document and its chunks/vectors |
| `GET` | `/sources/{id}/page/{n}` | Get PNG page image for a document page |
| `GET` | `/versions/{id}` | Get version history for a document |

### Agent Service (Port 8200 / 9200)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health check |
| `POST` | `/query` | Main query endpoint (body: query, user_type, session_id, mode, sector_hint) |
| `GET` | `/confidence/{request_id}` | Get confidence breakdown for a previous response |
| `POST` | `/delegate` | Multi-agent delegation endpoint |
| `POST` | `/validate` | Validate a response against source chunks |
| `POST` | `/explain` | Explain the reasoning behind a response |

### Governance Service (Port 8300 / 9300)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health check |
| `POST` | `/guardrail_check` | Run input or output guardrail check |
| `POST` | `/audit` | Log an audit record |
| `GET` | `/audit` | Query audit records (filters: user_type, intent, date range) |
| `POST` | `/evaluate` | Evaluate response quality (single/batch/aggregate) |
| `GET` | `/metrics` | Platform performance metrics |
| `GET` | `/logs` | Audit log viewer |
| `GET` | `/release_status` | Current release / build status |

### Workflow Service (Port 8400 / 9400)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health check |
| `POST` | `/cases` | Create a new escalation case |
| `GET` | `/cases` | List cases with filters (status, sector, priority, assignee) |
| `GET` | `/cases/{id}` | Get full case details with timeline |
| `PATCH` | `/cases/{id}` | Update case (status, priority, assigned_to) |
| `POST` | `/cases/{id}/notes` | Add a timeline note to a case |
| `POST` | `/cases/{id}/resolve` | Resolve a case with a human answer |
| `GET` | `/users/{user_id}/cases` | Get all cases submitted by a specific user |
| `POST` | `/cases/{id}/faq_candidate` | Flag a resolved case for FAQ promotion |

---

*This document was generated on March 16, 2026 from a comprehensive analysis of the full project repository, all documentation files, all service source code and configurations, and the data corpus inventory.*

*Sources consulted: `Jordan National Policy Intelligence Platform.txt`, `platform_milestones.md`, `frontend_plan.md`, `workflow_plan.md`, `agent_service_handoff.md`, `agent_service_prompt.md`, `knowledge-documentation.md`, `knowledge_engine_complete.md`, `embeddings2.md`, all service `README.md` files, all `docker-compose.yml` and `Dockerfile` files, all `.env.example` files, all `requirements.txt` files, and `src/App.tsx` frontend source.*
