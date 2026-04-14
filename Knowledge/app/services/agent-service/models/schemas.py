"""
Agent Orchestration Microservice — Pydantic Schemas
All request/response models in one place.
"""
from __future__ import annotations
from typing import Optional
import re

from pydantic import BaseModel, Field, model_validator
from ministries import AGENT_MINISTRY_MAP


_ARABIC_CHARS_RE = re.compile(r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]")
_LATIN_CHARS_RE = re.compile(r"[A-Za-z]")


def _infer_query_language(query: str, fallback: str = "ar") -> str:
    """Infer response language from query script so answers follow user input language."""
    normalized_fallback = (fallback or "").strip().lower()
    if normalized_fallback not in {"ar", "en"}:
        normalized_fallback = "ar"

    text = query or ""
    arabic_chars = len(_ARABIC_CHARS_RE.findall(text))
    latin_chars = len(_LATIN_CHARS_RE.findall(text))

    if arabic_chars == 0 and latin_chars == 0:
        return normalized_fallback
    if arabic_chars > latin_chars:
        return "ar"
    if latin_chars > arabic_chars:
        return "en"

    # Tie-break mixed-script queries with caller preference to avoid oscillation.
    return normalized_fallback


# ─── Query ───────────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: str = Field(max_length=4096, description="User's natural language query")
    user_type: str = Field(
        default="citizen",
        description="User role: citizen | operator | admin",
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Session ID for conversation context",
    )
    user_id: Optional[str] = Field(
        default=None,
        description="Stable user ID for cross-session continuity",
    )
    sector_hint: Optional[str] = Field(
        default=None,
        description="Optional sector hint to guide routing",
    )
    language: str = Field(
        default="ar",
        description="Response language: ar | en",
    )
    mode: str = Field(
        default="concise",
        description="Response mode: concise (short, fast) | detailed (thorough, chain-of-thought)",
    )
    agent_id: Optional[str] = Field(
        default=None,
        description="Agent ID to scope retrieval by ministry: " + " | ".join(AGENT_MINISTRY_MAP.keys()),
    )

    @model_validator(mode="after")
    def align_language_with_query(self) -> "QueryRequest":
        self.language = _infer_query_language(self.query, self.language)
        return self


class Citation(BaseModel):
    source_name: str = Field(description="Official document name")
    source_id: str = Field(description="Knowledge Service source ID")
    page: int = Field(description="Page number in the source document")
    document_year: Optional[str] = Field(default=None, description="Publication year")
    is_amendment: bool = Field(default=False, description="Whether this is an amending law")
    relevance_score: float = Field(description="Cosine similarity score (0-1)")


class QueryResponse(BaseModel):
    answer: str = Field(description="Generated answer grounded in retrieved evidence")
    confidence: float = Field(description="Confidence score (0-1)")
    citations: list[Citation] = Field(default_factory=list, description="Source citations")
    agent_used: str = Field(description="Which specialist agent handled the query")
    sector: str = Field(description="Detected government sector")
    has_amendments: bool = Field(default=False, description="Whether cited laws have amendments")
    amendment_note: Optional[str] = Field(
        default=None,
        description="Note about amendments affecting cited sources",
    )
    escalated: bool = Field(default=False, description="Whether query was escalated to human")
    escalation_reason: Optional[str] = Field(default=None, description="Reason for escalation")
    escalation_confirmation_required: bool = Field(
        default=False,
        description="Whether user confirmation is required before creating workflow ticket",
    )
    session_id: Optional[str] = Field(default=None, description="Session ID for follow-up queries")
    response_id: Optional[str] = Field(default=None, description="Unique response ID for /confidence and /explain")
    path: Optional[str] = Field(default=None, description="Execution path: single_agent_fast or multi_agent_orchestrated")
    timings: dict = Field(default_factory=dict, description="Step-by-step timing breakdown in seconds")
    chunks_used: int = Field(default=0, description="Total retrieved chunks used for answer synthesis")


# ─── Routing ─────────────────────────────────────────────────────────────────

class SubQuestion(BaseModel):
    question: str
    agent: str
    sector: Optional[str] = None


class RoutingDecision(BaseModel):
    intent: str = Field(description="Classified intent of the query")
    sector: str = Field(description="Detected government sector")
    agent: str = Field(description="Selected specialist agent")
    requires_delegation: bool = Field(default=False, description="Whether query needs multiple agents")
    sub_questions: list[SubQuestion] = Field(default_factory=list, description="Sub-questions for delegation")
    wants_human_handoff: bool = Field(default=False, description="Whether user explicitly asks for human handoff")
    path: str = Field(default="single_agent_fast", description="single_agent_fast | multi_agent_orchestrated")
    confidence_hint: float = Field(default=0.5, description="Router's confidence in its classification")


# ─── Delegate ────────────────────────────────────────────────────────────────

class DelegateRequest(BaseModel):
    query: str
    agent: str
    sector: Optional[str] = None
    user_type: str = "citizen"
    language: str = "ar"


# ─── Validate ────────────────────────────────────────────────────────────────

class ValidateRequest(BaseModel):
    answer: str = Field(description="Answer to validate")
    source_ids: list[str] = Field(description="Source IDs to verify against")
    query: Optional[str] = Field(default=None, description="Original query for context")


class ValidateResponse(BaseModel):
    valid: bool
    issues: list[str] = Field(default_factory=list)
    corrected_answer: Optional[str] = None


# ─── Explain ─────────────────────────────────────────────────────────────────

class ExplainResponse(BaseModel):
    response_id: str
    routing_decision: RoutingDecision
    confidence_breakdown: dict = Field(default_factory=dict)


# ─── Health ──────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str = "healthy"
    service: str = "agent-service"
    llm_model: str
    knowledge_service: str = Field(description="'reachable' or 'unreachable'")
