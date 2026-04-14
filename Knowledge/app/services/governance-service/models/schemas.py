"""
Governance Service — Pydantic Models
"""
from pydantic import BaseModel, Field
from typing import Optional


# ─── Guardrail Models ─────────────────────────────────────────────────────────

class GuardrailRequest(BaseModel):
    """Request body for POST /guardrail_check."""
    check_type: str = Field(..., description="'input' or 'output'")
    text: str = Field(..., description="The text to check (query for input, answer for output)")
    query: Optional[str] = Field(None, description="Original query (required for output checks)")
    user_type: str = Field("citizen", description="citizen | employee | admin")
    sector: Optional[str] = None
    language: str = Field("ar", description="ar | en")
    rule_only: bool = Field(False, description="If true, run only rule-based guardrails and skip LLM checks")


class GuardrailResult(BaseModel):
    """Response body for POST /guardrail_check."""
    passed: bool
    category: Optional[str] = None  # prompt_injection | off_topic | policy_violation | compliance_issue | visibility_leak
    reason: Optional[str] = None
    check_type: str
    latency_ms: float


# ─── Audit Models ─────────────────────────────────────────────────────────────

class AuditEntry(BaseModel):
    """Request body for POST /audit."""
    request_id: str
    session_id: Optional[str] = None
    query: str
    user_type: str = "citizen"
    intent: Optional[str] = None
    sector: Optional[str] = None
    agent_used: Optional[str] = None
    answer: Optional[str] = None
    confidence: Optional[float] = None
    has_amendments: bool = False
    escalated: bool = False
    escalation_reason: Optional[str] = None
    input_passed: bool = True
    input_category: Optional[str] = None
    input_reason: Optional[str] = None
    output_passed: bool = True
    output_category: Optional[str] = None
    output_reason: Optional[str] = None
    total_latency_ms: Optional[float] = None
    routing_latency_ms: Optional[float] = None
    retrieval_latency_ms: Optional[float] = None
    generation_latency_ms: Optional[float] = None
    citations_count: int = 0
    chunks_used: int = 0


class AuditRecord(AuditEntry):
    """Audit record as stored (includes DB fields)."""
    id: int
    created_at: str


class AuditQuery(BaseModel):
    """Query params for GET /audit (as body or query params)."""
    session_id: Optional[str] = None
    user_type: Optional[str] = None
    sector: Optional[str] = None
    escalated: Optional[bool] = None
    input_passed: Optional[bool] = None
    output_passed: Optional[bool] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    page: int = 1
    page_size: int = 50


# ─── Evaluation Models ────────────────────────────────────────────────────────

class EvaluateRequest(BaseModel):
    """Request body for POST /evaluate."""
    mode: str = Field(..., description="'single' | 'batch' | 'aggregate'")
    query: Optional[str] = None
    expected: Optional[str] = None
    actual: Optional[str] = None
    test_suite: Optional[list[dict]] = None
    period: Optional[str] = "24h"


class EvaluateResult(BaseModel):
    """Response body for POST /evaluate."""
    mode: str
    results: dict


# ─── Metrics Models ───────────────────────────────────────────────────────────

class MetricsResult(BaseModel):
    """Response body for GET /metrics."""
    period: str
    total_queries: int = 0
    avg_latency_ms: Optional[float] = None
    p95_latency_ms: Optional[float] = None
    avg_confidence: Optional[float] = None
    escalation_rate: Optional[float] = None
    guardrail_rejection_rate: Optional[float] = None
    sector_distribution: dict = {}
    agent_distribution: dict = {}


class TopicTrendPoint(BaseModel):
    date: str
    count: int


class TopicTrendSeries(BaseModel):
    topic_key: str
    label_en: str
    label_ar: str
    total: int
    points: list[TopicTrendPoint] = Field(default_factory=list)


class TopicStat(BaseModel):
    topic_key: str
    label_en: str
    label_ar: str
    count: int
    share: float
    avg_confidence: Optional[float] = None
    escalation_rate: float = 0.0
    guardrail_rejection_rate: float = 0.0
    avg_latency_ms: Optional[float] = None
    sample_queries: list[str] = Field(default_factory=list)


class RisingTopic(BaseModel):
    topic_key: str
    label_en: str
    label_ar: str
    current_count: int
    previous_count: int
    delta: int
    growth_rate: Optional[float] = None
    breakout: bool = False


class TopicRecommendation(BaseModel):
    target: str
    topic_key: str
    topic_label_en: str
    topic_label_ar: str
    priority: str
    title_en: str
    title_ar: str
    rationale_en: str
    rationale_ar: str
    suggested_rule: Optional[str] = None
    suggested_solution: Optional[str] = None


class TopicInsightsResult(BaseModel):
    period: str
    window_start: str
    window_end: str
    total_queries: int = 0
    analyzed_queries: int = 0
    top_topics: list[TopicStat] = Field(default_factory=list)
    rising_topics: list[RisingTopic] = Field(default_factory=list)
    trend_series: list[TopicTrendSeries] = Field(default_factory=list)
    recommendations_admin: list[TopicRecommendation] = Field(default_factory=list)
    recommendations_executive: list[TopicRecommendation] = Field(default_factory=list)


# ─── Health Models ────────────────────────────────────────────────────────────

class ServiceHealth(BaseModel):
    """Health status of a single service."""
    status: str  # healthy | unreachable
    url: str
    latency_ms: Optional[float] = None


class HealthResponse(BaseModel):
    """Response body for GET /health."""
    status: str  # healthy
    service: str = "governance-service"
    version: str = "1.0.0"
    audit_records: int = 0
    services: dict[str, ServiceHealth] = {}
