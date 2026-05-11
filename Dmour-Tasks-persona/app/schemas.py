"""
schemas.py — Pydantic response models for the Persona Classification API.

Only response/output schemas are defined here.
Input validation lives in the router query parameters.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Shared config mixin — lets Pydantic read directly from SQLAlchemy ORM objects
# ---------------------------------------------------------------------------

class _OrmBase(BaseModel):
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Persona definition sub-object (joined metadata returned inside each item)
# ---------------------------------------------------------------------------

class PersonaMetaItem(_OrmBase):
    persona_id: str
    name_ar: str
    name_en: str
    issue_clusters: list[str]
    bias_tags: list[str]
    priority_tier: str | None
    description: str | None


# ---------------------------------------------------------------------------
# Single classification item in the paginated list response
# ---------------------------------------------------------------------------

class ClassificationItem(_OrmBase):
    id: int
    complaint_id: str
    classification_json: dict[str, Any]
    persona_match_status: str | None
    composite_priority: str | None
    escalation_required: bool
    evidence_strength: str | None
    classification_timestamp: datetime | None
    created_at: datetime
    # Joined from persona_definitions — built at query time, not an ORM field
    persona_metadata: list[PersonaMetaItem]


# ---------------------------------------------------------------------------
# Paginated list response
# ---------------------------------------------------------------------------

class ClassificationsResponse(BaseModel):
    page: int
    page_size: int
    total: int
    items: list[ClassificationItem]
