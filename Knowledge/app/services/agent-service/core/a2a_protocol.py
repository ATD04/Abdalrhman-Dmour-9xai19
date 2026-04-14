"""
Agent-to-Agent Transfer Protocol (A2A)

Implements an intra-service agent routing & transfer mechanism inspired by
Google's Agent2Agent protocol.  Key components:

* **Agent Card registry** — machine-readable descriptions of each specialist
  agent's scope and capabilities (bilingual EN/AR).
* **Query classifier** — fast LLM call that maps an incoming query to the
  best-fit agent using the registry as a "manual".
* **Transfer decision** — compares the classifier result with the currently
  selected agent and decides whether to transfer.

The protocol is invoked *after* the input guardrail and handoff check, but
*before* embedding/retrieval, so that the correct ministry filter is applied
from the start.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from typing import Optional

import config
from core.llm import GeminiClient
from ministries import MINISTRY_REGISTRY

logger = logging.getLogger("agent-service.a2a")

# ──────────────────────────────────────────────────────────────────────────────
#  Agent Card Registry
# ──────────────────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class AgentCard:
    """Machine-readable description of a specialist agent."""
    agent_id: str
    name_en: str
    name_ar: str
    ministry_name: str
    scope_en: str
    scope_ar: str
    topics_en: list[str]
    topics_ar: list[str]


AGENT_CARDS: dict[str, AgentCard] = {
    key.upper(): AgentCard(
        agent_id=key.upper(),
        name_en=info.label_en,
        name_ar=info.label_ar,
        ministry_name=info.agent_key,
        scope_en=info.scope_en,
        scope_ar=info.scope_ar,
        topics_en=list(info.topics_en),
        topics_ar=list(info.topics_ar),
    )
    for key, info in MINISTRY_REGISTRY.items()
}


# ──────────────────────────────────────────────────────────────────────────────
#  Agent Manual (compiled text for the LLM classifier)
# ──────────────────────────────────────────────────────────────────────────────

def _build_agent_manual() -> str:
    """Build a concise textual manual of all agents for the router prompt."""
    lines: list[str] = []
    for card in AGENT_CARDS.values():
        lines.append(
            f"- **{card.agent_id}** ({card.name_en} / {card.name_ar})\n"
            f"  Scope: {card.scope_en}\n"
            f"  النطاق: {card.scope_ar}"
        )
    return "\n".join(lines)


_AGENT_MANUAL: str = _build_agent_manual()


# ──────────────────────────────────────────────────────────────────────────────
#  Router prompt & classifier
# ──────────────────────────────────────────────────────────────────────────────

_ROUTER_SYSTEM_PROMPT = """\
You are a query router for the Jordan National Policy Intelligence platform.
Your ONLY job is to decide which specialist agent is best suited to answer \
the user's query. You MUST pick exactly one agent from the list, or respond \
with "NONE" if the query does not clearly fit any single agent.

AGENT MANUAL:
{agent_manual}

RULES:
1. Choose the agent whose scope is the BEST match for the user's query.
2. If the query spans multiple domains, choose the PRIMARY one.
3. If no agent is a good match, return "NONE".
4. Respond ONLY with valid JSON — no markdown fences, no explanation.

OUTPUT FORMAT (strict JSON):
{{"agent_id": "<AGENT_ID or NONE>", "confidence": <0.0-1.0>, "reason": "<one sentence>"}}
"""

_ROUTER_USER_TEMPLATE = "Query: {query}"

# Minimum confidence from the router to trust the classification.
_ROUTER_MIN_CONFIDENCE = 0.55


async def classify_query(query: str, llm: GeminiClient) -> dict:
    """Classify a query into the best-fit agent using a fast LLM call.

    Returns dict with keys: agent_id (str|None), confidence (float), reason (str).
    """
    system_prompt = _ROUTER_SYSTEM_PROMPT.format(agent_manual=_AGENT_MANUAL)
    user_prompt = _ROUTER_USER_TEMPLATE.format(query=query)

    try:
        raw = await llm.generate(
            prompt=user_prompt,
            system_instruction=system_prompt,
            model=config.FAST_ROUTER_GEMINI_MODEL,
            max_output_tokens=150,
            max_retries=2,
        )
        parsed = _parse_router_response(raw)
        logger.info(
            "A2A classify: query='%s...' → agent=%s confidence=%.2f reason='%s'",
            query[:60], parsed["agent_id"], parsed["confidence"], parsed["reason"],
        )
        return parsed
    except Exception as exc:
        logger.warning("A2A classify failed: %s — defaulting to no transfer", exc)
        return {"agent_id": None, "confidence": 0.0, "reason": "classification_error"}


def _parse_router_response(raw: str) -> dict:
    """Extract the JSON classification from the router LLM response."""
    # Strip markdown code fences if present
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`")
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to find JSON object in the response
        match = re.search(r"\{[^}]+\}", cleaned)
        if match:
            data = json.loads(match.group())
        else:
            return {"agent_id": None, "confidence": 0.0, "reason": "unparseable_response"}

    agent_id = data.get("agent_id")
    if agent_id == "NONE" or agent_id not in AGENT_CARDS:
        agent_id = None
    confidence = float(data.get("confidence", 0.0))
    reason = str(data.get("reason", ""))
    return {"agent_id": agent_id, "confidence": confidence, "reason": reason}


# ──────────────────────────────────────────────────────────────────────────────
#  Transfer decision
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class TransferDecision:
    """Result of an A2A transfer check."""
    should_transfer: bool
    source_agent: Optional[str]
    target_agent: Optional[str]
    confidence: float
    reason: str


async def check_transfer(
    query: str,
    current_agent_id: Optional[str],
    llm: GeminiClient,
) -> TransferDecision:
    """Determine whether the query should be transferred to a different agent.

    Only triggers when a specific agent is currently selected (not None / "All").
    """
    # No transfer needed if no agent is selected (unfiltered mode)
    if not current_agent_id or current_agent_id not in AGENT_CARDS:
        return TransferDecision(
            should_transfer=False,
            source_agent=current_agent_id,
            target_agent=None,
            confidence=1.0,
            reason="no_agent_selected",
        )

    classification = await classify_query(query, llm)
    target_agent = classification["agent_id"]
    confidence = classification["confidence"]
    reason = classification["reason"]

    # If classifier couldn't determine an agent, stay with current
    if target_agent is None:
        return TransferDecision(
            should_transfer=False,
            source_agent=current_agent_id,
            target_agent=None,
            confidence=confidence,
            reason="classification_uncertain",
        )

    # If the classified agent matches the current one, no transfer
    if target_agent == current_agent_id:
        return TransferDecision(
            should_transfer=False,
            source_agent=current_agent_id,
            target_agent=None,
            confidence=confidence,
            reason="query_matches_current_agent",
        )

    # Transfer only if the router is sufficiently confident
    if confidence >= _ROUTER_MIN_CONFIDENCE:
        source_card = AGENT_CARDS[current_agent_id]
        target_card = AGENT_CARDS[target_agent]
        return TransferDecision(
            should_transfer=True,
            source_agent=current_agent_id,
            target_agent=target_agent,
            confidence=confidence,
            reason=reason or f"Query better suited for {target_card.name_en}",
        )

    # Low confidence — stay with current agent
    return TransferDecision(
        should_transfer=False,
        source_agent=current_agent_id,
        target_agent=None,
        confidence=confidence,
        reason="transfer_confidence_too_low",
    )


def get_agent_display_name(agent_id: str, language: str = "en") -> str:
    """Return the display name for an agent in the specified language."""
    card = AGENT_CARDS.get(agent_id)
    if not card:
        return agent_id
    return card.name_ar if language == "ar" else card.name_en
