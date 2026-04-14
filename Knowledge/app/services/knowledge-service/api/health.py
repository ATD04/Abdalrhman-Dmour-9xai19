"""
Knowledge Service — Health API
GET /health — Service health check.
"""
from fastapi import APIRouter
from models.schemas import HealthResponse
from config import EMBEDDING_MODEL, DATA_DIR

router = APIRouter(tags=["Health"])


def get_db():
    from main import db
    return db


@router.get("/health", response_model=HealthResponse,
            summary="Health check",
            description="Returns service status, model info, and storage statistics.")
async def health():
    database = get_db()
    return HealthResponse(
        status="healthy",
        service="knowledge-service",
        embedding_model=EMBEDDING_MODEL,
        total_sources=database.count_sources(),
        total_chunks=database.count_chunks(),
        storage_path=str(DATA_DIR),
    )
