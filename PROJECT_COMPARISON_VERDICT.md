# Project Comparison: JNPI vs. Manara
## Stakeholder Decision Document — Project Continuation Verdict
**Date:** March 16, 2026
**Classification:** Internal — Executive Decision Use
**Purpose:** Determine which of two parallel JNPI implementations should be selected for continued investment and production trajectory

---

## The Two Candidates

| | **Project A: JNPI (Knowledge2)** | **Project B: Manara Intelligence Platform** |
|---|---|---|
| **Internal Name** | JNPI | Manara Intelligence Platform |
| **Repository** | `EzzoHamdan/Knowledge2` | Separate codebase |
| **Architecture** | 5 independent microservices | 4 services (knowledge merged into RAG agents) |
| **Services** | knowledge · agent · governance · workflow · frontend | rag-agents (with embedded knowledge) · workflow · governance · frontend |
| **Storage** | SQLite + JSON files (local) | Google Firestore (cloud) |
| **Auth** | localStorage simulation (fake) | Firebase Authentication (real) |
| **AI Models** | Gemini 2.5 Flash + Gemini Embedding 2 (768-dim) | Gemini 2.5 Flash/Pro + Gemini Embedding 2 (2048-dim) + MiniLM |
| **Status** | ~75% — 3 of 5 services "100% complete" | ~60% functional, 4 active P0 security defects |
| **Development Phases** | Not explicitly phased | 4 documented phases with test validation |
| **Known Defects** | None formally registered | 22 confirmed open (4 critical) |
| **Document Ingestion** | 3 of hundreds ingested (corpus gap) | Subset of 24 ministries indexed (similar gap) |

---

## Head-to-Head Comparison

### Intelligence Pipeline

| Capability | JNPI (Knowledge2) | Manara |
|---|---|---|
| Query pipeline steps | 14-step (documented) | 8-step decision trace (persisted per query) |
| Routing | Rule-based + LLM (Gemini Flash, cached) | Scope classifier + fast/thinking mode |.     
| Chunking strategy | Page-based (PDF page = 1 chunk) | **3-phase semantic chunking** (MiniLM boundary detection → token cap → overlap stitching) |
| Chunk metadata | Basic classification fields | **5-layer metadata** (identity, breadcrumb, provenance, quality, versioning) |
| Embedding dimensions | 768 | **2048** |
| Confidence scoring | 4-factor weighted formula | 5-factor deterministic rubric |
| Answer repair | Not implemented | **Repair loop: up to 2 LLM rewrites before escalation** |
| Streaming answers | Not implemented | **Implemented** (`/query/stream`) |
| Self-verification | Optional, disabled by default | Built into validation pipeline |
| Amendment detection | Yes (is_amendment metadata flag) | Yes (is_latest flag per chunk, version disclosure) |
| Report export | Not implemented | **PDF + DOCX export** |
| Personalization | Not implemented | **User memory + personalization profile (thinking mode)** |
| Conversation memory | 20-turn SQLite session | **Memory extraction + recall across sessions** |
| Decision trace | Not formally stored | **8-step trace persisted per query** |

**Winner: Manara.** The intelligence pipeline is materially more sophisticated — semantic chunking, repair loops, streaming, memory, and report export are genuine production differentiators.

---

### Security & Access Control

| Capability | JNPI (Knowledge2) | Manara |
|---|---|---|
| Authentication | **localStorage array simulation (no tokens, no server validation)** | Firebase Auth (real tokens) — but with 3 critical bypass bugs |
| Roles | 3 (guest / user / admin) | **5 (Public, Normal Admin, Manager, Auditor, Super Admin)** |
| RBAC enforcement | Basic user_type → visibility mapping | Full role-gated routes + permission seeds |
| Data isolation | SQL WHERE clause by visibility tier | Firestore scoped queries — but **cross-user leakage confirmed (NEW-002)** |
| Guardrails active? | Yes — functional integration | **Contract mismatch (NEW-001): guardrails are effectively bypassed in live integration** |
| Secrets management | API keys in .env files | Firebase SA keys committed to git repo (**ERR-022**) |
| Critical security defects | **0 catalogued** | **4 catalogued** |

**Security is the most nuanced dimension.** JNPI has zero catalogued critical defects because it has no real security architecture — localStorage authentication is not a secure system, it is an absence of security. Manara has real security infrastructure (Firebase Auth, Firestore scoping, RBAC seeds) that was implemented and then found to have defects. Those defects are fixable engineering tasks. JNPI's authentication layer must be rebuilt from scratch.

**Winner: Contested.** Manara has superior security intention with fixable implementation defects. JNPI has no security implementation to fix.

---

### Knowledge Processing

| Capability | JNPI (Knowledge2) | Manara |
|---|---|---|
| Supported formats | PDF, DOCX, PPTX, TXT, HTML, images | PDF, DOCX, TXT |
| Chunking | Page-based (simple, fast) | **3-phase semantic + token-cap + overlap** (complex, accurate) |
| Arabic OCR | Tesseract (fallback) | Arabic text normalization and OCR variant cleanup |
| Embedding | 768-dim (below Gemini max of 3072) | **2048-dim** (higher fidelity) |
| Vector store | JSON flat files (local) | **Firestore native vector index** (cloud, scalable, managed) |
| Version tracking | Separate is_amendment + amends_target | is_latest flag per chunk, version_history_count |
| Legal version disclosure | Agent warns on amendment detection | Inline chunk disclosure (chunk-level, more granular) |
| Circuit breaker | Not implemented | **Retrieval fallback + circuit breaker logic** |
| Knowledge service independence | **Yes — separately deployable service** | Merged with agent service (cannot scale independently) |
| Admin ingestion UI | Not implemented | **Manager UI (`/manager/upload`)** |
| Visual dashboards | Basic testing HTML | **Chunking and normalization dashboards** |

**Winner: Manara** on processing quality. The semantic chunking advantage is particularly significant for legal text — laws are structured semantically (articles, clauses, paragraphs), not by page boundaries. Manara's chunking closely mirrors how legal content is actually organized, producing more precise retrieval. JNPI's page-based chunking often bundles multiple articles together or splits a single article across chunks.

The one structural advantage JNPI holds — the independently deployable knowledge service — reflects correct architectural thinking but is an operational concern, not an intelligence quality concern.

---

### Workflow & HITL

| Capability | JNPI (Knowledge2) | Manara |
|---|---|---|
| Ticket creation | Yes | Yes |
| Ticket lifecycle | open → pending → closed | open → escalated → resolved |
| Admin ticket inbox | Yes | Yes |
| Resolution fan-out | Not implemented | **Email notification + RAG callback + user_notifications record** |
| Resolution in chat | Not implemented | **Resolution message appears in user chat** |
| SLA enforcement | Not implemented | Hooks present (not fully implemented) |
| Notifications | Not implemented | Email stubs (real integration pending) |
| RBAC for workflow | Basic (admin/user) | **4-role RBAC** (Normal Admin, Manager, Auditor, Super Admin) |
| FAQ candidate flagging | Yes | Not explicitly noted |
| Stage: Production-readiness | ~40% | ~65% (complete loop, stubs remain) |

**Winner: Manara.** The complete resolution loop (resolution message appears in user chat after ticket resolved) is a critical UX feature that JNPI entirely lacks. Even with stub notifications, the architectural skeleton is complete.

---

### Frontend

| Capability | JNPI (Knowledge2) | Manara |
|---|---|---|
| Architecture | **Single ~1800-line App.tsx file** | Multiple routes, pages, Zustand state management |
| Routing | None (view state in memory) | **React Router (11+ role-gated routes)** |
| State management | Local component state | **Zustand 5** |
| i18n (internationalization) | No framework — Arabic hardcoded | **Custom i18n framework (Arabic + English)** |
| RTL support | Yes | Yes |
| Role-gated pages | 3 views (chat/tickets/admin) | **11 distinct pages by role** |
| Authentication UI | Simulated (localStorage) | **Firebase ID token flow** |
| Streaming display | Not implemented | **Yes** |
| Admin pages | Basic ticket queue | System dashboard, ministry list, role manager, activity log, audit viewer, metrics |
| Manager pages | Not implemented | **Document upload UI, manager ticket view** |
| Auditor pages | Not implemented | **Auditor inbox** |
| Mobile / responsive | Basic Tailwind | Basic Tailwind |
| Component structure | None (single file) | **Componentized** |

**Winner: Manara.** This is not close. JNPI's frontend is a prototype sketch — a single massive file with simulated auth. Manara's frontend has proper routing, state management, role-gated pages for each of 5 roles, real auth, and an i18n framework. Rebuilding JNPI's frontend to match Manara's scope would require comparable effort to continuing Manara's frontend.

---

### Infrastructure & DevOps

| Capability | JNPI (Knowledge2) | Manara |
|---|---|---|
| Containerization | Docker Compose (5 services) | **Docker Compose (4 services, root workspace)** |
| Dockerfile quality | Per-service Dockerfiles | **Multi-target root Dockerfile** |
| CI/CD pipelines | 3 pipelines — **broken** (wrong paths) | GitHub Actions — partial but functional |
| Health checks in Compose | Not configured | Not fully configured |
| Secrets management | .env files | Firebase SA keys — **committed to git (critical)** |
| Database migrations | None (`create_all` only) | None (`create_all` only) — same gap |
| Test coverage | No test files visible | **Pytest suites (13 + 11 passes confirmed)** |
| Latency (measured) | Estimated 600ms–3s (no real benchmark) | **Measured: fast p50 5.6s, thinking p50 13.8s** — problematic |
| Performance SLO | Not defined | Not defined |
| Observability | Internal metrics endpoint | **Activity logs + agent traces + correlation IDs + stage latency** |

**Winner: Manara** on test coverage and observability. Both projects have infrastructure gaps. JNPI's broken CI is partially counterbalanced by Manara's latency problem — p50 of 5.6 seconds in fast mode is at the edge of acceptable for a real-time government query interface.

---

## Scoring Summary

| Dimension | Weight | JNPI Score | Manara Score |
|---|---|---|---|
| Intelligence pipeline quality | 25% | 6/10 | **9/10** |
| Knowledge processing sophistication | 20% | 5/10 | **8/10** |
| Security architecture | 20% | 3/10 | 5/10 |
| Frontend completeness | 15% | 3/10 | **7/10** |
| Workflow / HITL completeness | 10% | 3/10 | **6/10** |
| Infrastructure / DevOps maturity | 10% | 4/10 | **6/10** |
| **Weighted Total** | | **4.4 / 10** | **7.3 / 10** |

---

## The Core Arguments

### Why Manara (Project B) Is Superior

**1. The intelligence is better designed.**
Semantic chunking matters enormously for legal text. Legal articles do not respect PDF page boundaries. Manara's 3-phase chunking — detect semantic breaks, enforce token caps, stitch overlap — produces chunks that are coherent units of legal meaning. JNPI's page-based chunking bundles multiple articles together, degrading retrieval precision for specific legal queries.

**2. The product is more complete.**
Streaming answers, report export, memory, personalization, a repair loop, 5-layer chunk metadata, 2048-dim embeddings, an admin ingestion UI, 11 role-gated frontend pages, real RBAC — Manara has built features that JNPI has not even scaffolded. The delta represents months of engineering work that would need to be replicated if JNPI were chosen.

**3. The security defects are known and bounded.**
Manara's 4 critical security defects are catalogued with exact file locations, root causes, and remediation steps. They are solvable:
- Firebase key rotation: 1–2 days
- Cross-user isolation fix: 1–2 days (scope queries by `user_id`)
- Auth bypass removal: 1–2 days
- Hardcoded password removal: 1 day

JNPI's authentication "system" is localStorage simulation. Replacing it with a real auth system (Firebase, JWT, OAuth2) requires designing the entire auth layer — that is a larger effort than patching Manara's specific defects.

**4. Manara has a testing culture. JNPI does not.**
Four phases of development, each validated with pytest runs (17 passes, 13 passes, 11 passes) and explicit verification matrices. JNPI has no visible test suite. For a government platform where incorrect legal advice is a real liability, test-verified behavior is not optional.

**5. The infrastructure choice scales.**
Firestore vector search is a managed, horizontally scalable, globally distributed vector store. JNPI's JSON flat files work for 3 documents and will fail under a real corpus. Migrating JNPI's storage layer to a real vector database is a larger effort than fixing Manara's known issues.

---

### Why One Might Argue for JNPI (Project A)

**1. Proper microservice separation.**
The knowledge service is independently deployable in JNPI. This is architecturally correct per the original specification. Manara must split its `rag-agents` monolith at some point if it needs to scale knowledge ingestion independently from query serving.

**2. No active security exploits today.**
JNPI has no Firebase keys committed to git, no cross-user leakage, and no hardcoded credentials. (Though this is partly because these features don't exist yet.)

**3. Lower operational complexity.**
No Firebase account, no Firestore billing, no GCP dependency. Pure Python + SQLite + Docker. A government that wants full data sovereignty or air-gapped deployment would prefer this.

**4. Simpler codebase for new developers.**
JNPI's services are easier to reason about individually.

---

### Why These Arguments Are Insufficient to Reverse the Verdict

The microservice separation advantage is real but secondary — you can always extract a service from a monolith. You cannot easily add 4 phases of product development, semantic chunking infrastructure, streaming, memory, report export, and a complete HITL loop to a project that has none of them.

The "no active security exploits" argument only holds because JNPI's features are not yet real. When you implement Firebase Auth for JNPI (which you must — localStorage is not deployable), you introduce the same risk vectors that Manara already identified and documented.

The operational simplicity advantage is negated at government scale. A national platform serving all of Jordan's ministries will need managed, scalable cloud infrastructure. SQLite and JSON files are not that.

---

## Verdict

**Continue with Manara (Project B).**

Manara is the superior platform. It has deeper intelligence, a more mature codebase, better infrastructure choices, real testing, and a richer feature set. Its open defects are well-documented, bounded, and resolvable within 4–6 weeks of focused engineering. JNPI is a better architectural diagram with fewer working features.

The table below summarizes what needs to happen immediately upon this decision:

---

## Recommended Next Steps for Manara

### Sprint 1: Security Remediation (Weeks 1–2)
These must be completed before any deployment to a non-local environment.

| Action | Effort | Why |
|---|---|---|
| Rotate all Firebase service account keys, remove from git history (BFG Repo Cleaner) | 1 day | Credentials still live in git history even if removed from working tree |
| Fix cross-user history leakage: scope all history queries by `user_id` + `conversation_id` | 1 day | Government data isolation failure — regulatory risk |
| Fix governance API contract mismatch (NEW-001): align rag-agents payload to governance schema | 1–2 days | Guardrails are completely bypassed in current live integration |
| Remove client-side auth bypass — phone login must obtain real Firebase token | 1 day | Any user can authenticate as anyone |
| Remove hardcoded `superadmin123` bootstrap password | 0.5 days | Trivial to exploit |
| Remove demo credential map from frontend source | 0.5 days | Ships credentials in production JS bundle |

### Sprint 2: Core Correctness (Weeks 3–4)

| Action | Effort | Why |
|---|---|---|
| Fix ticket ID schema mismatch int→UUID str | 0.5 days | Resolution callbacks completely broken |
| Fix async blocking in knowledge_app (asyncio.to_thread for heavy sync ops) | 1 day | Query serving blocked by ingestion under load |
| Fix ZeroDivisionError in governance `compute_diversity_score()` | 0.5 days | Empty chunk list crashes governance service |
| Fix Redis config or remove queue dependency entirely | 1 day | Notification system broken at config level |
| Improve retrieval grounding threshold for legal queries (query_term_coverage > 0) | 2–3 days | Zero-coverage answers risk legal misinformation |

### Sprint 3: Platform Maturity (Weeks 5–8)

| Action | Effort | Why |
|---|---|---|
| Address fast vs. thinking mode quality divergence | 2–3 days | Non-deterministic answers undermine trust |
| Add Alembic migration baseline | 1–2 days | No safe path for schema evolution in production |
| Add Docker health checks to Compose | 0.5 days | Services start before dependencies are ready |
| Fix full CI/CD pipeline (end-to-end, not per-changed-service) | 2–3 days | No automated regression protection |
| Implement real notification callbacks (email) behind feature flag | 3–5 days | Ticket resolution doesn't notify users |
| Ingest full ministry document corpus | 3–5 days | Platform knowledge base is incomplete |

### What to Preserve from JNPI (Knowledge2)

These ideas from JNPI are worth incorporating into Manara:

| JNPI Feature | Why It's Worth Adopting |
|---|---|
| PPTX support in ingestion | Several ministry documents are presentations — Manara currently lacks this |
| FAQ candidate flagging | Explicit pathway to build self-improving knowledge base |
| Independent knowledge service deployment plan | When Manara's knowledge_app needs to scale independently, JNPI's service boundary design is the right model |
| Amendment metadata (is_amendment + amends_target at source level) | More explicit tracking of legal supersession than Manara's is_latest chunk flag |

---

## Summary Table

| Question | Answer |
|---|---|
| Which project has the better intelligence pipeline? | Manara |
| Which project has a working authentication system? | Manara (with defects) — JNPI has none |
| Which project has a complete HITL loop? | Manara |
| Which project has better knowledge processing? | Manara (semantic chunking) |
| Which project has a complete, working frontend? | Manara |
| Which project has test coverage? | Manara |
| Which project has fewer security defects today? | JNPI (by absence, not by design) |
| Which project has cleaner microservice boundaries? | JNPI |
| Which project scales to the full 24-ministry corpus? | Manara (Firestore) |
| **Which project should continue?** | **Manara** |

---

*Analysis based on full review of: `JNPI_Stakeholder_Report.md` (Knowledge2 project, March 16 2026), `STAKEHOLDER_BRIEF.md` (Manara project, March 16 2026), and all source material underlying both documents.*
