# Knowledge & Retrieval Microservice — Complete Reference

> **Status:** Production-ready (Phase 10 complete)
> **Repo:** https://github.com/EzzoHamdan/Knowledge
> **Path:** `/services/knowledge-service`
> **Port:** 8100

---

## Architecture Overview

```
knowledge-service/
├── main.py                  # FastAPI app entry point
├── config.py                # Env-aware config (loads .env via python-dotenv)
├── Dockerfile               # Multi-stage production build
├── docker-compose.yml       # One-command deployment
├── requirements.txt         # Python dependencies
├── .env                     # Local secrets (git-ignored)
├── .env.example             # Template for developers
│
├── api/                     # REST API endpoints
│   ├── ingest.py            # POST /ingest, POST /ingest/batch
│   ├── retrieve.py          # POST /retrieve (semantic search)
│   ├── sources.py           # GET/DELETE /sources, /sources/{id}/page/{n}
│   ├── versions.py          # GET /versions/{id}
│   └── health.py            # GET /health
│
├── core/                    # Business logic
│   ├── classifier.py        # LLM-powered document classifier (Gemini 2.5 Flash)
│   ├── chunking.py          # PDF→image pages, DOCX, PPTX, text, HTML
│   ├── embedding.py         # Gemini Embedding 2 wrapper (768/1536/3072 dims)
│   ├── ingestion.py         # Orchestrator: file→chunk→classify→embed→store
│   └── retrieval.py         # Semantic search with hard security pre-filters
│
├── storage/
│   ├── database.py          # SQLite metadata store (sources, chunks, versions, hashes)
│   └── vector_store.py      # JSON-based vector store (cosine similarity)
│
├── models/
│   └── schemas.py           # Pydantic request/response models
│
├── static/
│   └── index.html           # Testing dashboard UI
│
├── docs/
│   └── embeddings2.md       # Gemini Embedding 2 technical documentation
│
└── data/                    # Runtime data (git-ignored)
    ├── knowledge.db          # SQLite database
    ├── vectors/              # Embedding JSON files
    └── pages/                # Rendered PDF page images
```

---

## API Reference

### Ingestion

| Endpoint | Method | Description |
|---|---|---|
| `/ingest` | POST | Upload single file with auto-classification |
| `/ingest/batch` | POST | Upload multiple files simultaneously |

**Parameters (form-data):**
- `file` / `files` — The document(s)
- `source_name` — Optional label
- `tags` — Comma-separated tags
- `visibility` — Override: `public` / `internal` / `confidential`
- `approval_status` — `approved` / `draft` / `revoked`

### Retrieval

| Endpoint | Method | Description |
|---|---|---|
| `/retrieve` | POST | Semantic search with security filtering |

**Request body (JSON):**
```json
{
  "query": "ما هي شروط الضمان الاجتماعي",
  "top_k": 5,
  "sector": "labor",
  "visibility": "public",
  "doc_type": "regulation",
  "min_score": 0.3
}
```

### Sources & Versions

| Endpoint | Method | Description |
|---|---|---|
| `/sources` | GET | List all ingested sources |
| `/sources/{id}` | GET | Source details + metadata |
| `/sources/{id}` | DELETE | Remove source and all chunks |
| `/sources/{id}/page/{n}` | GET | Rendered page image |
| `/versions/{id}` | GET | Version history for a source |
| `/health` | GET | Service health check |

---

## Features Implemented (Phases 1-10)

### Phase 1-3: Core Engine
- **Multimodal Chunking:** PDF pages rendered as 200 DPI images (no OCR), plus DOCX, PPTX, images, text, HTML
- **Gemini Embedding 2:** Visual understanding of Arabic documents at 768 dimensions
- **SQLite Metadata:** Sources, chunks, versions, file hashes
- **Vector Store:** JSON-based cosine similarity search

### Phase 4: Auto-Classification & Versioning
- **LLM Classifier (Gemini 2.5 Flash):** Reads first page, determines `regulation` vs `general`
- **Auto-Versioning:** Same regulation title → automatic version bump, old version deactivated
- **Duplicate Detection:** SHA-256 hash prevents re-ingesting identical files

### Phase 5: Legal Metadata Extraction
- Extracts: `title`, `document_year`, `document_number`, `legal_category`
- Detects amendments (`is_amendment`, `amends_target`)
- Amending laws stored side-by-side (not as version bumps) so agents can reason about superseded clauses

### Phase 6: Multi-Format Support
- Added DOCX and PPTX chunking via `python-docx` and `python-pptx`
- Batch ingestion API (`/ingest/batch`)

### Phase 7: Testing Dashboard
- Premium dark-mode HTML UI served from `/`
- Upload, query, browse sources, view page images

### Phase 8: Legal Document Specialization
- Source metadata merged into retrieval results
- Agent can read `is_amendment`, `amends_target`, `document_year` directly from search results

### Phase 9: Event Loop Optimization
- `engine.ingest` runs in `starlette.concurrency.run_in_threadpool`
- Server stays responsive during heavy batch processing

### Phase 10: Prime Ministry Roadmap Alignment
- **5 new classification fields:** `sector`, `knowledge_level`, `visibility`, `topic_keywords`, `owner_entity`
- **22 government sectors:** water, health, education, justice, labor, finance, etc.
- **4 knowledge levels:** L1_general → L4_departmental
- **3 visibility tiers:** public, internal, confidential
- **Hard security filtering:** `visibility` + `approval_status` enforced at SQL level BEFORE vector search
- **Approval gate:** Only `approved` documents appear in search results

---

## Database Schema

### `sources` table
| Column | Type | Description |
|---|---|---|
| source_id | TEXT PK | UUID hash |
| source_name | TEXT | Official title or filename |
| filename | TEXT | Original file name |
| file_type | TEXT | pdf, docx, pptx, image, text, html |
| doc_type | TEXT | `regulation` or `general` |
| tags | TEXT (JSON) | Array of tags |
| language | TEXT | Language hint |
| visibility | TEXT | `public` / `internal` / `confidential` |
| approval_status | TEXT | `approved` / `draft` / `revoked` |
| current_version | INT | Active version number |
| metadata | TEXT (JSON) | Full classification blob |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

### `metadata` JSON blob (stored per source)
```json
{
  "doc_type": "regulation",
  "title": "قانون الضمان الاجتماعي لسنة ٢٠١٤",
  "document_year": "2014",
  "document_number": "1",
  "legal_category": "Original Law",
  "is_amendment": false,
  "amends_target": null,
  "sector": "labor",
  "knowledge_level": "L2_sectoral",
  "visibility": "public",
  "topic_keywords": ["social_security", "insurance", "retirement"],
  "owner_entity": "مؤسسة الضمان الاجتماعي"
}
```

---

## Security Architecture

```
Agent Query → [Visibility Gate (SQL)] → [Approval Gate (SQL)] → [Sector Filter] → [Vector Search] → Results
```

- Filters execute BEFORE any embeddings are loaded
- Immune to prompt injection (restricted docs never enter the search pool)
- Admin can override visibility/approval via ingestion API

---

## Running the Service

```bash
# Local
cp .env.example .env
# Edit .env with your GEMINI_API_KEY
python main.py

# Docker
docker compose up --build
```

**Environment Variables:** See `.env.example` for all options.

---

## Python SDK (for Agent Service integration)

```python
import requests

# Ingest a document
with open("law.pdf", "rb") as f:
    resp = requests.post("http://localhost:8100/ingest",
        files={"file": f},
        data={"visibility": "public", "approval_status": "approved"})

# Semantic search with security
resp = requests.post("http://localhost:8100/retrieve",
    json={
        "query": "ما هي شروط التقاعد المبكر",
        "top_k": 5,
        "sector": "labor",
        "visibility": "public",
    })

results = resp.json()["results"]
for r in results:
    print(f"[{r['score']:.2f}] {r['source_name']} p.{r['page']}")
    print(f"  sector: {r['metadata'].get('sector')}")
    print(f"  amendment: {r['metadata'].get('is_amendment')}")
```
