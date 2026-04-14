"""
GET /confidence/{response_id} — Explain confidence for a response.
Uses Redis-backed cache (TTL 10 min) populated by /query endpoint.
"""
import json
import logging
from fastapi import APIRouter, HTTPException
from cache import get_redis

logger = logging.getLogger("agent-service.confidence")
router = APIRouter(tags=["confidence"])

_RESPONSE_CACHE_PREFIX = "resp_cache:"
_RESPONSE_CACHE_TTL = 600  # 10 minutes


def cache_response(response_id: str, data: dict) -> None:
    """Store response data in Redis (or fall back to noop)."""
    r = get_redis()
    if not r:
        return
    try:
        r.setex(
            f"{_RESPONSE_CACHE_PREFIX}{response_id}",
            _RESPONSE_CACHE_TTL,
            json.dumps(data, ensure_ascii=False, default=str),
        )
    except Exception as exc:
        logger.warning("Failed to cache response %s: %s", response_id, exc)


def get_cached_response(response_id: str) -> dict | None:
    """Retrieve cached response data from Redis."""
    r = get_redis()
    if not r:
        return None
    try:
        raw = r.get(f"{_RESPONSE_CACHE_PREFIX}{response_id}")
        if raw:
            return json.loads(raw)
    except Exception as exc:
        logger.warning("Failed to read response cache %s: %s", response_id, exc)
    return None


@router.get("/confidence/{response_id}")
async def explain_confidence(response_id: str):
    """Return the confidence breakdown for a previous /query response."""
    cached = get_cached_response(response_id)
    if not cached:
        raise HTTPException(
            status_code=404,
            detail=f"Response {response_id} not found or has expired.",
        )

    return {
        "response_id": response_id,
        "confidence": cached.get("confidence", {}),
    }
