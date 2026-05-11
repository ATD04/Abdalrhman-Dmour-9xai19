"""
main.py — FastAPI application entry point for the Persona Classification service.

Startup sequence:
  1. lifespan handler calls init_db() — creates ./data/persona.db and all tables.
  2. seed_persona_definitions() — populates persona_definitions if empty (DB-02).
  3. Routers are mounted:
     - GET /health
     - GET /v1/classifications  (B-04)
     - GET /v1/personas/stats   (B-05)
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import SessionLocal, init_db
from app.seed_personas import seed_persona_definitions
from app.routers import classifications as classifications_router
from app.routers import stats as stats_router


# ---------------------------------------------------------------------------
# Lifespan — runs once at startup and once at shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ---- Startup ----
    # 1. Create ./data/persona.db and all three tables if not present
    init_db()
    # 2. Seed persona_definitions with the 10 archetypes (idempotent)
    db = SessionLocal()
    try:
        seed_persona_definitions(db)
    finally:
        db.close()
    yield
    # ---- Shutdown (nothing to clean up for SQLite) ----


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Persona Classification Service",
    description=(
        "LLM-as-a-Judge persona classification backend for the "
        "Voice of Citizen / CXI Dashboard — Hashemite Kingdom of Jordan."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — open for demo; platform team adds JWT / origin restriction later
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health check (B-01 contract)
# ---------------------------------------------------------------------------

@app.get("/health", tags=["meta"])
def health_check():
    """Returns service status. Always 200 while the process is alive."""
    return {"status": "ok", "service": "persona-classification"}


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

# B-04: GET /v1/classifications
app.include_router(classifications_router.router)

# B-05: GET /v1/personas/stats
app.include_router(stats_router.router)
