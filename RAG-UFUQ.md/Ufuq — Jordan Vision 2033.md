# 🇯🇴 Ufuq — Jordan Vision 2033 RAG Advisory Agent

An AI-powered advisory system that answers citizen and investor questions about Jordan's **Economic Modernization Vision (2023–2033)** using Retrieval-Augmented Generation (RAG).

---

## 🧠 How It Works

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│               Ufuq Frontend  (React + Vite)                     │
│                                                                 │
│  ┌──────────────────────┐   ┌────────────────────────────────┐  │
│  │   Chat Interface      │   │    Review Console (HITL)       │  │
│  │  English / Arabic RTL │   │  Low-confidence ticket review  │  │
│  └──────────┬───────────┘   └──────────────┬─────────────────┘  │
└─────────────┼─────────────────────────────┼───────────────────┘
              │  HTTP  localhost:5173 → 8000 │
┌─────────────▼─────────────────────────────▼───────────────────┐
│                    FastAPI Backend                             │
│                                                               │
│  1. Guardrails  — scope check + prompt-injection block        │
│  2. Retrieval   — embed query → ChromaDB semantic search      │
│  3. Generation  — Vertex AI (gemini-2.0-flash-lite) +         │
│                   Gemini API fallback (GOOGLE_API_KEY)        │
│  4. Output Check — citation validation + confidence scoring   │
│  5. HITL        — confidence < 40% → escalate to human agent  │
│                                                               │
│  ┌──────────────┐  ┌─────────────┐  ┌────────────────────┐   │
│  │   ChromaDB   │  │   SQLite    │  │  Google Vertex AI  │   │
│  │  (vectors)   │  │  (tickets)  │  │  + Gemini API      │   │
│  └──────────────┘  └─────────────┘  └────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

### Step-by-Step Query Flow

1. **User submits a question** in English or Arabic
2. **Guardrails** confirm the query is in-scope (Jordan Vision topics) and not a prompt injection
3. **Retrieval** embeds the question using `text-embedding-004` (Vertex AI), then fetches the top-5 document chunks from ChromaDB
4. **Generation** sends the chunks + question to `gemini-2.0-flash-lite` via Vertex AI; if that fails, it retries automatically via the direct Gemini API (using `GOOGLE_API_KEY`)
5. **Output validation** checks for source citations and scores confidence
6. **If confidence < 40%**, a HITL ticket is created and shown in the Review Console for a human agent
7. **Response** is returned with the answer, confidence score, source citations, and escalation status

---

## 🗂️ Project Structure

```
JV-RAG/
├── backend/
│   ├── main.py                   # FastAPI app entry point
│   ├── config.py                 # Pydantic settings loaded from .env
│   ├── requirements.txt
│   ├── service-account.json      # GCP service account (Vertex AI auth)
│   ├── routers/
│   │   └── query.py              # POST /api/query orchestration
│   └── services/
│       ├── ingestion.py          # PDF extraction, chunking, embedding → ChromaDB
│       ├── retrieval.py          # Semantic search (ChromaDB + Vertex embeddings)
│       ├── generation.py         # Vertex AI primary / Gemini API fallback
│       ├── guardrails.py         # Input/output scope + injection validation
│       └── hitl.py               # Human-in-the-loop ticket management (SQLite)
├── frontend/
│   ├── index.html
│   └── src/
│       ├── App.jsx               # Root layout, routing, language toggle (EN/AR)
│       ├── index.css             # RTL-first design system (logical CSS properties)
│       └── pages/
│           ├── ChatPage.jsx      # Chat interface with confidence card + citations
│           └── AgentConsole.jsx  # Human agent review & resolution dashboard
├── scripts/
│   └── ingest.py                 # One-time document ingestion script
├── JV-RAG-Data/
│   ├── *.pdf                     # Source PDF documents
│   └── Links.txt                 # URLs scraped for additional content
├── chroma_db/                    # Vector database (auto-created)
├── data/
│   └── jvrag.db                  # SQLite HITL tickets (auto-created)
└── .env                          # API keys and configuration
```

---

## ⚙️ Configuration (`.env`)

```env
# ── Google Cloud ──────────────────────────────────────────────
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=./backend/service-account.json

# ── Vertex AI ─────────────────────────────────────────────────
VERTEX_EMBEDDING_MODEL=text-embedding-004
VERTEX_EMBEDDING_DIMENSIONS=768

# ── Gemini (direct API — fallback if Vertex AI fails) ─────────
GOOGLE_API_KEY=AIza...
GENERATION_MODEL=gemini-2.0-flash-lite

# ── RAG Parameters ────────────────────────────────────────────
CHROMA_DB_PATH=./chroma_db
SQLITE_DB_PATH=./data/jvrag.db
RETRIEVAL_TOP_K=5
CONFIDENCE_THRESHOLD=0.40

# ── Server ────────────────────────────────────────────────────
LOG_LEVEL=INFO
```

---

## 🚀 Running the Project

### 1. Install Python dependencies
```bash
pip install -r backend/requirements.txt
```

### 2. Ingest documents (one-time)
```bash
python scripts/ingest.py
```
Extracts text from PDFs + web URLs → splits into chunks → generates Vertex AI embeddings → stores in ChromaDB.

### 3. Start the backend
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### 4. Start the frontend
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173**

---

## 🌐 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/query` | Submit a question |
| `GET` | `/api/tickets` | List HITL escalation tickets |
| `PUT` | `/api/tickets/{id}/resolve` | Resolve a ticket with human answer |

### Query Request
```bash
curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What investment incentives does Jordan offer?", "language": "en"}'
```

### Query Response
```json
{
  "answer": "Jordan offers several investment incentives including...",
  "confidence": 0.92,
  "sources": [
    { "document": "Economic_Modernisation_Vision.pdf", "page": 42 },
    { "document": "Investment_Environment_Report.pdf",  "page": 15 }
  ],
  "escalated": false,
  "language": "en"
}
```

---

## 🔧 Key Dependencies

| Package | Purpose |
|---|---|
| `fastapi` + `uvicorn` | REST API server |
| `google-cloud-aiplatform` (`vertexai`) | Vertex AI embeddings + generation |
| `google-generativeai` | Direct Gemini API (fallback) |
| `chromadb` | Local vector database |
| `pymupdf` (`fitz`) | PDF text extraction |
| `beautifulsoup4` + `httpx` | Web scraping |
| `langchain-text-splitters` | Overlapping document chunking |
| `pydantic-settings` | Type-safe config from `.env` |
| `aiosqlite` | Async SQLite for HITL tickets |
| `react` + `vite` | Frontend SPA |
| `framer-motion` | UI animations |
| `lucide-react` | Icons |

---

##   Frontend — Ufuq 3.0 Design System

The frontend is a **fully bilingual (English / Arabic)** React application.

### RTL Architecture
- Switching to Arabic sets `document.documentElement.dir = "rtl"` on `<html>` — no page reload.
- The root layout uses **CSS Flexbox** — the sidebar automatically moves to the visual right under `dir="rtl"`.
- All CSS uses **logical properties** exclusively:

| Physical (removed) | Logical (used) |
|---|---|
| `margin-left / margin-right` | `margin-inline-start / margin-inline-end` |
| `padding-left / padding-right` | `padding-inline-start / padding-inline-end` |
| `border-left` | `border-inline-start` |
| `text-align: left` | `text-align: start` |
| `top` / `bottom` spacing | `margin-block-start / end` |

### Key Components
| Component | File | Role |
|---|---|---|
| App root layout | `App.jsx` | Sidebar + canvas flex layout, language toggle, routing |
| Chat interface | `ChatPage.jsx` | Message bubbles, AI confidence card, citations, input bar |
| Review console | `AgentConsole.jsx` | HITL ticket list + resolution panel |
| Design system | `index.css` | RTL-first CSS variables, logical property layout |
