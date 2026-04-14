"""
LangGraph state schema for the Unified RAG pipeline.
Every node reads/writes typed fields on this state dict.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from langgraph.graph import MessagesState


@dataclass
class RAGState:
    """Typed state that flows through every graph node."""

    # ── Request inputs ────────────────────────────────────────────────
    query: str = ""
    user_type: str = "citizen"
    language: str = "ar"
    mode: str = "concise"
    session_id: str = ""
    response_id: str = ""
    user_id: Optional[str] = None
    sector_hint: Optional[str] = None
    agent_id: Optional[str] = None
    conversation_history: list[dict] = field(default_factory=list)

    # ── Early-exit flags ──────────────────────────────────────────────
    blocked: bool = False
    handoff_requested: bool = False
    answered_from_workflow: bool = False

    # ── Clarification ───────────────────────────────────────────────
    needs_clarification: bool = False
    clarification_question: Optional[str] = None

    # ── Greeting (skip RAG pipeline) ────────────────────────────────
    is_greeting: bool = False
    greeting_response: Optional[str] = None

    # ── A2A Transfer ──────────────────────────────────────────────────
    transfer_occurred: bool = False
    transfer_from: Optional[str] = None
    transfer_to: Optional[str] = None
    transfer_reason: Optional[str] = None
    transfer_confidence: float = 0.0

    # ── Governance ────────────────────────────────────────────────────
    governance_input: Optional[dict] = None
    governance_output: Optional[dict] = None

    # ── Retrieval ─────────────────────────────────────────────────────
    retrieval_query: str = ""
    query_embedding: list[float] = field(default_factory=list)
    retrieval_embedding: list[float] = field(default_factory=list)
    chunks: list[dict] = field(default_factory=list)
    full_doc_fetched: bool = False
    full_doc_source_id: Optional[str] = None
    full_doc_reason: Optional[str] = None

    # ── Workflow answered-match ────────────────────────────────────────
    answered_match: Optional[dict] = None

    # ── Generation ────────────────────────────────────────────────────
    answer: str = ""
    streamed_parts: list[str] = field(default_factory=list)

    # ── Suggestions ─────────────────────────────────────────────────
    suggestions: list[str] = field(default_factory=list)

    # ── Post-generation pipeline results ──────────────────────────────
    citations: list[Any] = field(default_factory=list)
    amendments: dict = field(default_factory=lambda: {
        "has_amendments": False,
        "amendment_note": None,
        "amendment_sources": [],
        "amendment_lookup_total": 0.0,
        "amendment_lookup_count": 0,
    })
    review: dict = field(default_factory=lambda: {
        "status": "warning",
        "support_quality": "moderate",
        "contradiction_risk": 0.0,
        "no_answer": False,
        "escalation_recommended": False,
        "issues": [],
        "review_warning": None,
        "correction": None,
        "confidence_penalty": 0.0,
    })
    confidence_result: dict = field(default_factory=lambda: {"score": 0.0, "breakdown": {}})
    escalation_result: Optional[Any] = None

    # ── Escalation confirmation ───────────────────────────────────────
    escalation_confirmation_required: bool = False
    escalation_confirmation_reason: Optional[str] = None

    # ── Verification ──────────────────────────────────────────────────
    verification_issues: list[str] = field(default_factory=list)

    # ── Timings ───────────────────────────────────────────────────────
    timings: dict[str, float] = field(default_factory=dict)
    t_total_start: float = 0.0

    # ── Error ─────────────────────────────────────────────────────────
    error: Optional[str] = None
