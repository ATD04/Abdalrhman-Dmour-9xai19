"""
Health check endpoint — verifies own status and Knowledge Service reachability.
"""
from fastapi import APIRouter
from models.schemas import HealthResponse
import config

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Check agent service health and Knowledge Service connectivity."""
    from client.knowledge_client import KnowledgeClient

    ks_status = "unreachable"
    try:
        client = KnowledgeClient(base_url=config.KNOWLEDGE_SERVICE_URL)
        result = await client.health()
        if result.get("status") == "healthy":
            ks_status = "reachable"
    except Exception:
        ks_status = "unreachable"

    return HealthResponse(
        status="healthy",
        service="agent-service",
        llm_model=config.GEMINI_MODEL,
        knowledge_service=ks_status,
    )
