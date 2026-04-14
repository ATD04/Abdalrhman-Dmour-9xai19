import json
from cache import get_redis

SESSION_TTL = 1800  # 30 minutes

def get_session(session_id: str) -> dict:
    """Load conversation state from Redis."""
    r = get_redis()
    if r:
        try:
            raw = r.get(f"session:{session_id}")
            if raw:
                r.expire(f"session:{session_id}", SESSION_TTL)
                return json.loads(raw)
        except Exception:
            pass
    
    return {
        "history": [],          # list of {role, content} dicts
        "user_type": "citizen",
        "sector": "general",
        "language": "ar",
    }

def save_session(session_id: str, state: dict):
    """Persist conversation state to Redis."""
    r = get_redis()
    if r:
        try:
            r.setex(f"session:{session_id}", SESSION_TTL, json.dumps(state, ensure_ascii=False))
        except Exception:
            pass

def clear_session(session_id: str):
    """Explicit session logout/clear."""
    r = get_redis()
    if r:
        try:
            r.delete(f"session:{session_id}")
        except Exception:
            pass
