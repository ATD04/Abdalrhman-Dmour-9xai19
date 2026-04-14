"""
Agent Service Microservice
==========================
Unified single-model RAG runtime for the Jordan National Policy Intelligence Platform.
Receives user query, retrieves knowledge, and returns grounded answers with citations,
confidence scores, and escalation support.

Endpoints:
    POST   /query/stream       — Main entry: user query → streamed answer with citations
    POST   /query              — Deprecated legacy endpoint (returns 410)
  POST   /delegate           — Internal: router delegates to specialist
  GET    /confidence/{id}    — Explain confidence for a response
  POST   /validate           — Verify an answer against knowledge base
  GET    /explain_decision/{id} — Explain routing decision
  GET    /health             — Service health
  GET    /docs               — OpenAPI documentation (auto)
"""
import sys
import logging
from pathlib import Path

# Add project root and shared module to path
# Docker: main.py at /app/main.py, shared at /app/shared/
# Local:  main.py at app/services/agent-service/main.py, shared at app/shared/
_here = Path(__file__).parent
sys.path.insert(0, str(_here))
_shared = _here / "shared"
if not _shared.exists():
    _shared = _here.parent.parent / "shared"
sys.path.insert(0, str(_shared))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import config

from client.knowledge_client import KnowledgeClient
from api import health, query, confidence, delegate, validate, explain

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("agent-service")

# ─── Shared Instances ─────────────────────────────────────────────────────────
knowledge_client = KnowledgeClient(base_url=config.KNOWLEDGE_SERVICE_URL)

# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Agent Service Microservice",
    description=(
        "Unified single-model RAG runtime for the Jordan National Policy Intelligence Platform. "
        "Retrieves knowledge from the Knowledge Service and generates grounded answers with "
        "citations, confidence scores, and escalation support. Arabic-first, security-enforced."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
_allow_creds = "*" not in config.ALLOWED_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=_allow_creds,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Register Routers ────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(query.router)
app.include_router(confidence.router)
app.include_router(delegate.router)
app.include_router(validate.router)
app.include_router(explain.router)

# ─── Static UI ──────────────────────────────────────────────────────────────
static_dir = Path(__file__).parent / "static"

@app.get("/", include_in_schema=False)
async def serve_ui():
    return FileResponse(static_dir / "index.html")

app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# ─── Startup ─────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    logger.info("=" * 60)
    logger.info("Agent Service Microservice starting...")
    logger.info(f"[CONFIG] KNOWLEDGE_SERVICE_URL resolved to: {config.KNOWLEDGE_SERVICE_URL}")
    logger.info(f"[CONFIG] GOVERNANCE_SERVICE_URL resolved to: {config.GOVERNANCE_SERVICE_URL}")
    logger.info(f"[CONFIG] WORKFLOW_SERVICE_URL resolved to: {config.WORKFLOW_SERVICE_URL}")
    logger.info(f"[CONFIG] ALLOWED_ORIGINS: {config.ALLOWED_ORIGINS}")
    logger.info(f"LLM Model: {config.GEMINI_MODEL}")
    logger.info(f"Single-model runtime enabled: {config.ENABLE_SINGLE_MODEL_RAG}")
    logger.info(f"Confidence Threshold: {config.CONFIDENCE_THRESHOLD}")
    logger.info(f"Self-Verification: {'enabled' if config.ENABLE_SELF_VERIFICATION else 'disabled'}")
    await KnowledgeClient.startup_shared_client(
        base_url=config.KNOWLEDGE_SERVICE_URL,
        timeout=300,
    )
    logger.info("LangGraph pipeline compiled — ready to serve.")
    logger.info("=" * 60)


@app.on_event("shutdown")
async def shutdown():
    await KnowledgeClient.shutdown_shared_client()


# ─── Run ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.PORT,
        reload=True,
    )
