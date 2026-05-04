"""
Claude Chat Engine — Wadi Saqra Traffic Assistant
--------------------------------------------------
Manages multi-turn conversations with Claude claude-sonnet-4-5.
On each user message:
  1. Send conversation history + system prompt + all tool schemas to Claude.
  2. Claude decides which tool(s) to call.
  3. We execute each tool, append the results.
  4. Claude produces a final answer.
  5. We return the answer and updated history to the caller.

Sessions are stored in memory (dict keyed by session_id).
History is capped to the last 20 turns to control token usage.
"""

import json
import os
import uuid
from datetime import datetime
from typing import Any

import anthropic
from dotenv import load_dotenv

from src.chatbot.tools import TOOL_SCHEMAS, TOOL_FUNCTIONS

load_dotenv()

CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY", "")
MODEL          = "claude-sonnet-4-5"
MAX_TOKENS     = 80
MAX_HISTORY    = 20        # messages (user + assistant turns) kept per session

SYSTEM_PROMPT = """You are a traffic assistant for Wadi Saqra Intersection in Amman.

RULE: Reply in exactly ONE sentence. No exceptions. No lists. No markdown. No emojis unless the user uses one. Always call a tool first. Reply in Arabic if the user writes in Arabic.

Now is {today}, {time}."""


# ── In-memory session store ───────────────────────────────────────────────────
_sessions: dict[str, list[dict]] = {}


def _build_system() -> str:
    now = datetime.now()
    return SYSTEM_PROMPT.format(
        today=now.strftime("%A, %B %d, %Y"),
        time=now.strftime("%H:%M"),
    )


def _cap_history(history: list[dict]) -> list[dict]:
    """Keep only the last MAX_HISTORY messages (preserve pairs)."""
    if len(history) > MAX_HISTORY:
        return history[-MAX_HISTORY:]
    return history


def new_session() -> str:
    """Create a new session and return its ID."""
    sid = str(uuid.uuid4())
    _sessions[sid] = []
    return sid


def reset_session(session_id: str) -> None:
    _sessions[session_id] = []


def get_history(session_id: str) -> list[dict]:
    return _sessions.get(session_id, [])


def _first_sentence(text: str) -> str:
    """Return only the first sentence of text, stripping markdown."""
    # Strip markdown
    import re
    text = re.sub(r'#{1,3}\s*', '', text)
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'\*(.*?)\*', r'\1', text)
    text = re.sub(r'^[-•]\s+', '', text, flags=re.MULTILINE)
    text = text.strip()
    # Split on sentence-ending punctuation followed by space or end
    import re as _re
    m = _re.search(r'[.!?](?:\s|$)', text)
    if m:
        return text[:m.start()+1].strip()
    # No punctuation found — return whole text (already short due to token limit)
    return text


def chat(session_id: str, user_message: str) -> dict[str, Any]:
    """
    Process one user message and return the assistant reply.

    Returns:
        {
            "reply":      str,
            "session_id": str,
            "tools_used": list[str],
            "turn":       int,
        }
    """
    if not CLAUDE_API_KEY:
        return {
            "reply":      "Claude API key is not configured. Add CLAUDE_API_KEY to the .env file.",
            "session_id": session_id,
            "tools_used": [],
            "turn":       0,
        }

    client = anthropic.Anthropic(api_key=CLAUDE_API_KEY)

    # Initialise session if unknown
    if session_id not in _sessions:
        _sessions[session_id] = []

    history = _sessions[session_id]
    history.append({"role": "user", "content": user_message})
    history = _cap_history(history)

    tools_used: list[str] = []

    # ── Agentic loop: Claude → tools → Claude → … → final answer ──────────
    while True:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=_build_system(),
            tools=TOOL_SCHEMAS,
            messages=history,
        )

        # Append assistant turn to history
        assistant_content = response.content
        history.append({"role": "assistant", "content": assistant_content})

        # If Claude wants to stop — we have the final text
        if response.stop_reason == "end_turn":
            reply_text = ""
            for block in assistant_content:
                if hasattr(block, "text"):
                    reply_text += block.text
            break

        # If Claude wants to use tools
        if response.stop_reason == "tool_use":
            tool_results = []
            for block in assistant_content:
                if block.type != "tool_use":
                    continue

                tool_name = block.name
                tool_input = block.input or {}
                tools_used.append(tool_name)

                # Execute the tool
                fn = TOOL_FUNCTIONS.get(tool_name)
                if fn:
                    try:
                        result = fn(tool_input)
                    except Exception as exc:
                        result = {"error": f"Tool '{tool_name}' failed: {exc}"}
                else:
                    result = {"error": f"Unknown tool: {tool_name}"}

                tool_results.append({
                    "type":        "tool_result",
                    "tool_use_id": block.id,
                    "content":     json.dumps(result, ensure_ascii=False, default=str),
                })

            # Append tool results and loop
            history.append({"role": "user", "content": tool_results})
            history = _cap_history(history)
            continue

        # Unexpected stop reason — treat whatever text is there as final
        reply_text = ""
        for block in assistant_content:
            if hasattr(block, "text"):
                reply_text += block.text
        break

    _sessions[session_id] = history
    return {
        "reply":      _first_sentence(reply_text.strip()),
        "session_id": session_id,
        "tools_used": list(dict.fromkeys(tools_used)),   # deduplicated
        "turn":       len([m for m in history if m["role"] == "user"]),
    }
