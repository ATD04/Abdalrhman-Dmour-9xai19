"""
GET /explain_decision/{response_id} — Explain routing decision details.
Returns the routing decision and confidence breakdown from the Redis cache.
"""
import logging
from fastapi import APIRouter, HTTPException
from api.confidence import get_cached_response

logger = logging.getLogger("agent-service.explain")
router = APIRouter(tags=["explain"])


@router.get("/explain_decision/{response_id}")
async def explain_decision(response_id: str):
    """Return the routing decision details for a previous /query response."""
    cached = get_cached_response(response_id)
    if not cached:
        raise HTTPException(
            status_code=404,
            detail=f"Response {response_id} not found or has expired.",
        )

    return {
        "response_id": response_id,
        "routing_decision": cached.get("routing", {}),
        "path": cached.get("path"),
        "review": cached.get("review", {}),
        "confidence": cached.get("confidence", {}),
        "amendments": cached.get("amendments", {}),
        "verification_issues": cached.get("verification_issues", []),
    }
