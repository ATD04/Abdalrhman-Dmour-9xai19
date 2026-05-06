"""Small validation helpers for the chat API contracts."""

from __future__ import annotations

from typing import Any


def detect_language(text: str) -> str:
    """Return ``ar`` when the prompt contains Arabic script, otherwise ``en``."""
    for char in text:
        if "\u0600" <= char <= "\u06ff":
            return "ar"
    return "en"


def validate_chat_request(payload: dict[str, Any]) -> dict[str, Any]:
    message = str(payload.get("message", "")).strip()
    if not message:
        raise ValueError("Request body must include a non-empty 'message' field.")

    conversation_id = payload.get("conversation_id")
    if conversation_id is not None:
        conversation_id = str(conversation_id).strip() or None

    return {
        "message": message,
        "conversation_id": conversation_id,
        "debug": bool(payload.get("debug", False)),
        "language": detect_language(message),
    }


def unavailable_response(
    *,
    conversation_id: str,
    language: str,
    reason: str,
    model: str,
    provider: str,
) -> dict[str, Any]:
    return {
        "conversation_id": conversation_id,
        "answer": None,
        "language": language,
        "time_scope": None,
        "citations": [],
        "refusal_reason": reason,
        "debug": {
            "tools_used": [],
            "model": model,
            "provider": provider,
            "model_status": "unavailable",
        },
    }
