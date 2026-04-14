"""
Shared Redis client for caching.
Falls back gracefully if Redis is unavailable (non-fatal).
"""
import os
import logging
import redis as redis_lib

logger = logging.getLogger(__name__)

_client = None

def get_redis() -> redis_lib.Redis | None:
    """
    Returns a Redis client, or None if Redis is unavailable.
    Caching is always optional — the system works without it.
    """
    global _client
    if _client is not None:
        return _client
    try:
        url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        _client = redis_lib.Redis.from_url(url, decode_responses=True, socket_connect_timeout=2)
        _client.ping()
        logger.info(f"Redis connected: {url}")
        return _client
    except Exception as e:
        logger.warning(f"Redis unavailable (caching disabled): {e}")
        return None
