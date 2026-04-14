# Agent Service — Implementation Prompt

> Copy this entire prompt into a new AI conversation to continue building the Agent Orchestration Microservice.

---

## Context: What Has Been Built

The **Knowledge & Retrieval Microservice** (`knowledge-service`) is fully built and operational. It is a standalone FastAPI service (port 8100) that:

1. **Ingests** government documents (PDF, DOCX, PPTX, images, text, HTML) by rendering each page as an image and embedding it using **Gemini Embedding 2** (768-dim, no OCR needed).
2. **Classifies** every document using **Gemini 2.5 Flash** to extract: `doc_type` (regulation/general), `title`, `document_year`, `document_number`, `legal_category`, `is_amendment`, `amends_target`, `sector` (22 government sectors), `knowledge_level` (L1-L4), `visibility` (public/internal/confidential), `topic_keywords`, and `owner_entity`.
3. **Retrieves** with **hard security pre-filtering**: visibility + approval_status are enforced at the SQL level BEFORE any vector search. Supports filtering by `sector`, `doc_type`, `tags`, and `source_ids`.
4. **Versions** regulations automatically. Amending laws are stored side-by-side with originals (not as version bumps) so agents can reason about superseded clauses.
5. **Prevents duplicates** via SHA-256 file hashing.
6. **Runs in Docker** with persistent data volumes.

### Knowledge Service API (What the Agent Service Consumes)

```
POST http://localhost:8100/retrieve
{
  "query": "ما هي شروط التقاعد المبكر",
  "top_k": 5,
  "sector": "labor",           // optional: focus on specific sector
  "visibility": "public",      // REQUIRED: security boundary
  "doc_type": "regulation",    // optional: only search laws
  "min_score": 0.3
}

Response:
{
  "results": [
    {
      "chunk_id": "...",
      "source_id": "...",
      "source_name": "قانون الضمان الاجتماعي لسنة ٢٠١٤",
      "filename": "law_2014.pdf",
      "page": 4,
      "score": 0.87,
      "version": 2,
      "chunk_type": "pdf",
      "metadata": {
        "tags": ["regulation", "2014", "labor", "social_security"],
        "sector": "labor",
        "knowledge_level": "L2_sectoral",
        "visibility": "public",
        "is_amendment": false,
        "amends_target": null,
        "document_year": "2014",
        "legal_category": "Original Law",
        "topic_keywords": ["social_security", "insurance"],
        "owner_entity": "مؤسسة الضمان الاجتماعي"
      }
    }
  ],
  "query": "...",
  "total_searched": 42,
  "embedding_dim": 768
}

GET http://localhost:8100/sources              # List all documents
GET http://localhost:8100/sources/{id}         # Get source details
GET http://localhost:8100/sources/{id}/page/1  # Get page image
GET http://localhost:8100/health               # Health check
```

### Repository Structure
```
/services
  /knowledge-service     ← DONE (port 8100)
  /agent-service         ← YOU ARE BUILDING THIS (port 8200)
  /governance-service    ← Future
  /workflow-service      ← Future
/frontend-app            ← Future
/shared
/docs
```

**Repo:** https://github.com/EzzoHamdan/Knowledge

---

## Your Mission: Build the Agent Orchestration Microservice

You are **Team 2 — Agent Orchestration**. Build a FastAPI microservice that serves as the intelligent brain of the Jordan National Policy Intelligence Platform.

### Core Architecture

```
User Query → Router Agent → [Specialist Agent(s)] → Knowledge Service (RAG) → Answer + Citations
                                                  → Tool Calls (MCP/Function Calling)
                                                  → Self-Verification
                                                  → Escalation (if needed)
```

### Required Modules

1. **Router Agent** — Analyzes the user query, determines intent, selects the right specialist agent(s), detects the sector, and sets the visibility level based on user authentication.

2. **Specialist Agents** — Domain-specific agents that know how to query the Knowledge Service with the right filters:
   - Legal Affairs Agent (sector: justice, labor, etc.)
   - Public Services Agent (citizen-facing questions)
   - Policy Analysis Agent (comparing regulations, timeline analysis)
   - General Knowledge Agent (non-legal questions)

3. **Tool Abstraction Layer** — Each agent can call:
   - `search_knowledge(query, sector, visibility, doc_type)` → calls Knowledge Service `/retrieve`
   - `get_source_details(source_id)` → calls `/sources/{id}`
   - `get_page_image(source_id, page)` → calls `/sources/{id}/page/{n}`
   - Future: MCP tools, function calling

4. **Confidence Scoring** — Each response includes a confidence score based on:
   - Number of supporting chunks found
   - Average similarity score
   - Whether sources are amendments or original laws
   - Whether the question falls within a known sector

5. **Citation Enforcement** — EVERY response must include:
   - Source document name
   - Page number(s)
   - Document year
   - Whether the cited law has amendments

6. **Self-Verification** — Before returning, the agent checks:
   - Are there amendments that might supersede the cited clauses?
   - Is the cited version the latest?
   - Does the answer contradict other retrieved chunks?

7. **Escalation Triggers** — Transfer to human when:
   - Confidence < threshold
   - Query is out of scope
   - Conflicting information found
   - User explicitly requests human

8. **Delegation Engine** — For complex queries, the router can delegate sub-questions to multiple specialist agents and merge their responses.

### Required APIs

| Endpoint | Method | Description |
|---|---|---|
| `/query` | POST | Main entry point — accepts user query, returns answer with citations |
| `/delegate` | POST | Internal: router delegates to specialist |
| `/confidence` | GET | Explain confidence for a response |
| `/validate` | POST | Verify an answer against knowledge base |
| `/explain_decision` | GET | Explain why the router chose specific agents |
| `/health` | GET | Service health |

### `/query` Request/Response Contract

```json
// Request
{
  "query": "ما هي شروط التقاعد المبكر في الأردن؟",
  "user_type": "citizen",          // citizen | employee | admin
  "session_id": "abc-123",         // for conversation context
  "sector_hint": null,             // optional: user can specify sector
  "language": "ar"
}

// Response
{
  "answer": "بحسب قانون الضمان الاجتماعي لسنة ٢٠١٤...",
  "confidence": 0.92,
  "citations": [
    {
      "source_name": "قانون الضمان الاجتماعي لسنة ٢٠١٤",
      "source_id": "b64d97a2",
      "page": 4,
      "document_year": "2014",
      "is_amendment": false,
      "relevance_score": 0.87
    }
  ],
  "agent_used": "legal_affairs",
  "sector": "labor",
  "has_amendments": true,
  "amendment_note": "هذا القانون تم تعديله بقانون معدل لسنة ٢٠١٩",
  "escalated": false,
  "session_id": "abc-123"
}
```

### Tech Stack
- **Framework:** FastAPI (port 8200)
- **LLM:** Gemini 2.5 Flash (for reasoning) or Gemini 2.5 Pro
- **Agent Framework:** Consider PydanticAI, LangGraph, or raw function calling
- **Knowledge Access:** HTTP client to Knowledge Service (localhost:8100)
- **Config:** python-dotenv + .env
- **Docker:** Dockerfile + docker-compose.yml

### Security Rules
1. **ALWAYS** pass `visibility` when calling the Knowledge Service based on `user_type`:
   - `citizen` → `visibility: "public"`
   - `employee` → `visibility: "internal"`
   - `admin` → `visibility: "confidential"`
2. NEVER expose internal/confidential data to citizens regardless of prompt content
3. The Knowledge Service enforces this at SQL level, but the Agent must set it correctly

### Key Design Decisions from the Prime Ministry Roadmap
- **Knowledge Levels:** L1 (general gov policy) → L4 (departmental). The agent should understand which level applies to the query.
- **Response Policy:** Only answer based on the latest approved version of knowledge.
- **Out-of-Scope Handling:** If out of scope → check if another specialist agent exists (A2A). If no → escalate to human.
- **Continuous Improvement:** Log unanswered/low-quality questions for future knowledge updates.

### Important Notes
- The knowledge-service stores BOTH original laws and amending laws as separate, active sources. The Agent must reason about which clauses are superseded by checking `is_amendment` and `amends_target` in the metadata.
- Arabic is the primary language. All prompts and responses should support Arabic natively.
- The agent must work independently from the frontend — it's a pure API service.
