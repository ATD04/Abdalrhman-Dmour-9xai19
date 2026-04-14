# Knowledge & Retrieval Microservice

A reusable, scalable national knowledge layer powered by **Gemini Embedding 2**.  
Supports multimodal ingestion (PDF, images, text, HTML) with visual understanding — **no OCR required**.  
Designed to operate independently and serve other AI systems.

---

## Quick Start

```bash
cd knowledge-service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
GEMINI_API_KEY="your_key" python main.py
# → Server starts on http://localhost:8100
# → API docs at http://localhost:8100/docs
```

---

## Architecture

```
┌──────────────── API Layer (FastAPI) ─────────────────┐
│  POST /ingest    POST /retrieve    GET /sources      │
│  GET /versions   GET /health       DELETE /sources/id│
└────────┬──────────────┬──────────────┬───────────────┘
         │              │              │
┌────────▼───┐  ┌───────▼──────┐  ┌───▼──────────────┐
│  Ingestion │  │  Retrieval   │  │  Source/Version   │
│   Engine   │  │   Engine     │  │   Management      │
└──┬─────┬───┘  └──────┬───────┘  └──────────────────┘
   │     │             │
┌──▼──┐ ┌▼──────────┐ ┌▼────────────────┐
│Chunk│ │ Embedding  │ │  Vector Store   │
│ Eng │ │ Engine     │ │  (JSON files)   │
└─────┘ │(Gemini E2) │ ├────────────────┤
        └────────────┘ │ Metadata DB    │
                       │ (SQLite)       │
                       └────────────────┘
```

---

## API Reference

### `POST /ingest` — Upload & Embed a Document

```bash
curl -X POST http://localhost:8100/ingest \
  -F "file=@report.pdf" \
  -F "source_name=Q4 Revenue Report" \
  -F "tags=finance,2024,quarterly" \
  -F "language=ar" \
  -F "chunk_strategy=page"
```

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `file` | File | required | PDF, PNG, JPG, TXT, HTML |
| `source_name` | string | filename | Human-readable label |
| `tags` | string | "" | Comma-separated tags |
| `language` | string | "auto" | Language hint (ar, en) |
| `chunk_strategy` | string | "page" | page / fixed / paragraph |

**Response:**
```json
{
  "source_id": "58bd6534",
  "filename": "report.pdf",
  "source_name": "Q4 Revenue Report",
  "chunks_created": 6,
  "version": 1,
  "status": "completed"
}
```

---

### `POST /retrieve` — Semantic Search

```bash
curl -X POST http://localhost:8100/retrieve \
  -H "Content-Type: application/json" \
  -d '{
    "query": "ما هي صلاحيات الأمين العام؟",
    "top_k": 5,
    "source_ids": ["58bd6534"],
    "tags": ["foreign_affairs"],
    "min_score": 0.2
  }'
```

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `query` | string | required | Natural language query (any language) |
| `top_k` | int | 5 | Number of results |
| `source_ids` | string[] | null | Filter by sources |
| `tags` | string[] | null | Filter by tags |
| `min_score` | float | 0.0 | Minimum similarity threshold |

**Response:**
```json
{
  "results": [
    {
      "chunk_id": "58bd6534_v1_p6",
      "source_id": "58bd6534",
      "source_name": "نظام التنظيم الإداري",
      "filename": "report.pdf",
      "page": 6,
      "score": 0.392705,
      "version": 1,
      "chunk_type": "pdf",
      "metadata": {"tags": ["foreign_affairs"], "language": "ar"}
    }
  ],
  "query": "ما هي صلاحيات الأمين العام؟",
  "total_searched": 6,
  "embedding_dim": 3072
}
```

---

### `GET /sources` — List All Sources

```bash
curl http://localhost:8100/sources
```

### `DELETE /sources/{source_id}` — Delete a Source

```bash
curl -X DELETE http://localhost:8100/sources/58bd6534
```

### `GET /sources/{source_id}/page/{page_num}` — Page Image

```bash
# Returns PNG image of the rendered page
curl http://localhost:8100/sources/58bd6534/page/3 --output page3.png
```

### `GET /versions/{source_id}` — Version History

```bash
curl http://localhost:8100/versions/58bd6534
```

### `GET /health` — Health Check

```bash
curl http://localhost:8100/health
```

---

## Integration Guide

### Python SDK (Recommended)

Copy `client/knowledge_client.py` into your project:

```python
from knowledge_client import KnowledgeClient

ks = KnowledgeClient("http://localhost:8100")

# 1. Ingest a document
result = ks.ingest(
    "ministry_report.pdf",
    source_name="Ministry of Health Strategy",
    tags=["health", "2024", "strategy"],
    language="ar"
)
print(f"Ingested: {result['chunks_created']} chunks")

# 2. Search
results = ks.retrieve(
    "ما هي الأهداف الاستراتيجية لوزارة الصحة؟",
    top_k=3,
    tags=["health"]
)
for r in results["results"]:
    print(f"  Page {r['page']} ({r['score']:.1%}) — {r['source_name']}")

# 3. Batch ingest a directory
ks.ingest_directory(
    "path/to/ministry_docs/",
    tags=["ministry", "2024"],
    language="ar"
)

# 4. Manage sources
sources = ks.list_sources()
ks.delete_source("old_source_id")
```

### Integration with Agent Service

The agent-service can call the knowledge-service to ground its responses:

```python
# In agent-service/tools/knowledge_tool.py
from knowledge_client import KnowledgeClient

ks = KnowledgeClient("http://knowledge-service:8100")

def search_knowledge(query: str, tags: list = None) -> list:
    """Tool for agents to search the knowledge base."""
    result = ks.retrieve(query, top_k=5, tags=tags)
    return [{
        "source": r["source_name"],
        "page": r["page"],
        "score": r["score"],
        "page_image_url": ks.get_page_image_url(r["source_id"], r["page"]),
    } for r in result["results"]]
```

### Integration with Any HTTP Client

```javascript
// JavaScript / TypeScript
const response = await fetch("http://localhost:8100/retrieve", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    query: "What are the Ministry's objectives?",
    top_k: 5,
  }),
});
const data = await response.json();
```

---

## Configuration (Environment Variables)

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | required | Google Gemini API key |
| `EMBEDDING_MODEL` | gemini-embedding-2-preview | Embedding model |
| `EMBEDDING_DIMENSIONS` | 3072 | Output dimensions (768/1536/3072) |
| `PDF_DPI` | 200 | PDF rendering quality |
| `MAX_UPLOAD_SIZE_MB` | 100 | Max file upload size |
| `DEFAULT_TOP_K` | 5 | Default search results |
| `HOST` | 0.0.0.0 | Server host |
| `PORT` | 8100 | Server port |

---

## Version Tracking

Re-ingesting a file with the same `source_name` automatically creates a new version:

```bash
# First ingestion → version 1
curl -X POST /ingest -F "file=@v1.pdf" -F "source_name=Policy Doc"

# Re-ingest with updated file → version 2
curl -X POST /ingest -F "file=@v2.pdf" -F "source_name=Policy Doc"

# Check versions
curl /versions/{source_id}
```

---

## Project Structure

```
knowledge-service/
├── main.py                 # FastAPI entry point
├── config.py               # Configuration (env vars)
├── requirements.txt        # Dependencies
├── api/                    # API route handlers
│   ├── ingest.py           # POST /ingest
│   ├── retrieve.py         # POST /retrieve
│   ├── sources.py          # GET/DELETE /sources
│   ├── versions.py         # GET /versions
│   └── health.py           # GET /health
├── core/                   # Business logic
│   ├── chunking.py         # PDF→image, text splitting
│   ├── embedding.py        # Gemini Embedding 2 wrapper
│   ├── ingestion.py        # Orchestrator pipeline
│   └── retrieval.py        # Vector search + ranking
├── storage/                # Persistence
│   ├── database.py         # SQLite metadata
│   └── vector_store.py     # Embedding storage
├── models/
│   └── schemas.py          # Pydantic models
├── client/
│   └── knowledge_client.py # Python SDK
└── data/                   # Runtime (auto-created)
    ├── knowledge.db        # SQLite database
    ├── vectors/            # Embedding files
    └── pages/              # Rendered page images
```
