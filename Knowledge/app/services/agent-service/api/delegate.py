"""
POST /delegate — Deprecated endpoint (specialist delegation is disabled).
"""
import logging
from fastapi import APIRouter, HTTPException
from models.schemas import DelegateRequest

logger = logging.getLogger("agent-service.delegate")
router = APIRouter(tags=["delegate"])


@router.post("/delegate")
async def delegate_to_specialist(request: DelegateRequest):
    """Specialist delegation is permanently disabled in the LangGraph runtime."""
    raise HTTPException(
        status_code=410,
        detail={
            "message": "Specialist delegation is disabled. Use /query/stream.",
            "runtime": "langgraph_rag",
            "supported_endpoint": "/query/stream",
        },
    )
