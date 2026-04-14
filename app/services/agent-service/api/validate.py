"""
POST /validate — Deprecated endpoint (self-verification module was removed).
"""
import logging
from fastapi import APIRouter, HTTPException
from models.schemas import ValidateRequest

logger = logging.getLogger("agent-service.validate")
router = APIRouter(tags=["validate"])


@router.post("/validate")
async def validate_answer(request: ValidateRequest):
    """Self-verification endpoint is disabled in the LangGraph runtime."""
    raise HTTPException(
        status_code=410,
        detail={
            "message": "Self-verification endpoint is disabled. Validation is performed automatically during /query/stream.",
        },
    )
