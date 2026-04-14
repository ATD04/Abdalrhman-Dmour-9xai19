"""
Knowledge & Retrieval Microservice
===================================
A reusable, scalable national knowledge layer powered by Gemini Embedding 2.
Operates independently and serves other AI systems via REST APIs.

Endpoints:
  POST   /ingest              — Upload & embed documents
  POST   /retrieve            — Semantic search
  GET    /sources              — List all sources
  GET    /sources/{id}         — Get source details
  DELETE /sources/{id}         — Delete a source
  GET    /sources/{id}/page/N  — Page image preview
  GET    /versions/{id}        — Version history
  GET    /health               — Service health
  GET    /docs                 — OpenAPI documentation (auto)
"""
import sys
import logging
from pathlib import Path

# Add project root and shared module to path
# Docker: main.py at /app/main.py, shared at /app/shared/
# Local:  main.py at app/services/knowledge-service/main.py, shared at app/shared/
_here = Path(__file__).parent
sys.path.insert(0, str(_here))
_shared = _here / "shared"
if not _shared.exists():
    _shared = _here.parent.parent / "shared"
sys.path.insert(0, str(_shared))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import config

from storage.database import Database
from storage.vector_store import VectorStore
from core.embedding import EmbeddingEngine
from core.ingestion import IngestionEngine
from core.retrieval import RetrievalEngine

from api import ingest, retrieve, sources, versions, health

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("knowledge-service")

# ─── Shared Instances ─────────────────────────────────────────────────────────
db = Database()
vector_store = VectorStore()
embedding_engine = EmbeddingEngine()
ingestion_engine = IngestionEngine(db, vector_store, embedding_engine)
retrieval_engine = RetrievalEngine(db, vector_store, embedding_engine)

# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Knowledge & Retrieval Microservice",
    description=(
        "A reusable, scalable national knowledge layer powered by Gemini Embedding 2. "
        "Supports multimodal ingestion (PDF, images, text, HTML) with DB-backed PDF page storage "
        "and text-first retrieval. Designed to operate independently and serve other AI systems."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS (allow all origins for development) ────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Register Routers ────────────────────────────────────────────────────────
from fastapi.staticfiles import StaticFiles

app.include_router(ingest.router)
app.include_router(retrieve.router)
app.include_router(sources.router)
app.include_router(versions.router)
app.include_router(health.router)

# Mount static files for the UI
import os
static_path = os.path.join(os.path.dirname(__file__), "static")
app.mount("/", StaticFiles(directory=static_path, html=True), name="static")

@app.on_event("startup")
async def startup():
    logger.info("=" * 60)
    logger.info("Knowledge & Retrieval Microservice starting...")
    logger.info(f"Embedding Model: {config.EMBEDDING_MODEL}")
    logger.info(f"Storage: {config.DATA_DIR}")
    logger.info(f"Sources: {db.count_sources()} | Chunks: {db.count_chunks()}")
    logger.info("=" * 60)


# ─── Run ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.PORT,
        reload=True,
    )
