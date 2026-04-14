"""
Workflow Service — Pydantic Models
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field

CaseStatus = Literal["open", "pending", "closed"]
CasePriority = Literal["low", "medium", "high", "urgent"]


class TimelineEvent(BaseModel):
    id: int
    case_id: str
    event_type: str
    actor: str
    note: Optional[str] = None
    metadata: dict = Field(default_factory=dict)
    created_at: str


class CaseCreateRequest(BaseModel):
    request_id: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    query: str
    user_type: str = "citizen"
    sector_primary: str = "general"
    sector_labels: list[str] = Field(default_factory=list)
    priority: CasePriority = "medium"
    escalation_reason: str = "low_confidence"
    confidence: Optional[float] = None
    source_response_id: Optional[str] = None
    query_embedding: Optional[list[float]] = None


class CaseUpdateRequest(BaseModel):
    status: Optional[CaseStatus] = None
    priority: Optional[CasePriority] = None
    assigned_to: Optional[str] = None
    sector_primary: Optional[str] = None
    sector_labels: Optional[list[str]] = None


class CaseNoteRequest(BaseModel):
    actor: str = "admin"
    note: str
    metadata: dict = Field(default_factory=dict)


class CaseResolveRequest(BaseModel):
    actor: str = "admin"
    resolution_answer: str
    resolution_note: Optional[str] = None


class AnsweredMatchRequest(BaseModel):
    query: str = Field(min_length=1)
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    query_embedding: Optional[list[float]] = None


class CaseRecord(BaseModel):
    case_id: str
    request_id: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    query: str
    query_hash: str
    user_type: str
    sector_primary: str
    sector_labels: list[str] = Field(default_factory=list)
    priority: CasePriority
    status: CaseStatus
    assigned_to: Optional[str] = None
    escalation_reason: str
    confidence: Optional[float] = None
    source_response_id: Optional[str] = None
    query_embedding: Optional[list[float]] = None
    resolution_answer: Optional[str] = None
    resolution_note: Optional[str] = None
    is_faq_candidate: bool = False
    created_at: str
    updated_at: str
    resolved_at: Optional[str] = None


class CaseDetails(CaseRecord):
    timeline: list[TimelineEvent] = Field(default_factory=list)


class CaseListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    cases: list[CaseRecord] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str = "healthy"
    service: str = "workflow-service"
    total_cases: int = 0


class UserRegisterRequest(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None
    role: str = "citizen"


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    user_id: str
    email: str
    full_name: Optional[str] = None
    role: str
    created_at: str
