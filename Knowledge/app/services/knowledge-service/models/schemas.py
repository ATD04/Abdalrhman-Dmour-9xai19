"""
Knowledge & Retrieval Microservice — Pydantic Schemas
All request/response models in one place.
"""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


# ─── Ingest ───────────────────────────────────────────────────────────────────

class ClassificationResult(BaseModel):
    doc_type: str = Field(description="'regulation' or 'general'")
    title: Optional[str] = Field(default=None, description="Extracted official title")
    document_year: Optional[str] = Field(default=None)
    document_number: Optional[str] = Field(default=None)
    legal_category: Optional[str] = Field(default=None)
    is_amendment: bool = Field(default=False)
    amends_target: Optional[str] = Field(default=None)
    sector: str = Field(default="general", description="Government sector")
    knowledge_level: str = Field(default="L2_sectoral", description="L1-L4 knowledge level")
    visibility: str = Field(default="public", description="public / internal / confidential")
    topic_keywords: list[str] = Field(default_factory=list, description="1-3 topic keywords")
    owner_entity: Optional[str] = Field(default=None, description="Owning ministry/entity")
    date_of_the_constitution: Optional[str] = Field(default=None)
    ministry_type: str = Field(default="general")


class IngestResponse(BaseModel):
    source_id: str
    filename: str
    source_name: str
    chunks_created: int
    version: int
    status: str = "completed"
    doc_type: str = Field(default="general", description="'regulation' or 'general'")
    source_group_id: Optional[str] = None
    source_group_name: Optional[str] = None
    group_role: str = "primary"
    ministry_name: Optional[str] = None
    date_of_the_constitution: Optional[str] = None
    classification: ClassificationResult = None


# ─── Retrieve ─────────────────────────────────────────────────────────────────

class RetrieveRequest(BaseModel):
    query: str
    query_embedding: Optional[list[float]] = Field(default=None, description="Optional precomputed query embedding")
    top_k: int = Field(default=5, ge=1, le=50)
    source_ids: Optional[list[str]] = None
    tags: Optional[list[str]] = None
    doc_type: Optional[str] = None
    sector: Optional[str] = Field(default=None, description="Filter by sector (e.g. 'water', 'health')")
    ministry_name: Optional[str] = Field(default=None, description="Filter by ministry/agent ownership")
    visibility: str = Field(default="public", description="Max visibility level: public / internal / confidential")
    min_score: float = Field(default=0.0, ge=0.0, le=1.0)


class ChunkResult(BaseModel):
    chunk_id: str
    source_id: str
    source_name: str
    filename: str
    page: int
    text: str = ""
    score: float
    version: int
    chunk_type: str
    metadata: dict = {}


class RetrieveResponse(BaseModel):
    results: list[ChunkResult]
    query: str
    total_searched: int
    embedding_dim: int


# ─── Sources ──────────────────────────────────────────────────────────────────

class SourceInfo(BaseModel):
    source_id: str
    source_name: str
    filename: str
    file_type: str
    doc_type: str = "general"
    total_chunks: int
    current_version: int
    tags: list[str] = []
    language: str = "auto"
    visibility: str = "public"
    approval_status: str = "approved"
    date_of_the_constitution: Optional[str] = None
    ministry_name: Optional[str] = None
    ministry_type: str = "general"
    source_group_id: Optional[str] = None
    source_group_name: Optional[str] = None
    group_role: str = "primary"
    created_at: str
    updated_at: str
    metadata: dict = Field(default_factory=dict)


class SourceListResponse(BaseModel):
    sources: list[SourceInfo]
    total: int


# ─── Versions ─────────────────────────────────────────────────────────────────

class VersionInfo(BaseModel):
    version: int
    chunks_created: int
    created_at: str
    is_active: bool


class VersionListResponse(BaseModel):
    source_id: str
    source_name: str
    source_group_id: Optional[str] = None
    source_group_name: Optional[str] = None
    versions: list[VersionInfo]


class SourceChunksResponse(BaseModel):
    source_id: str
    source_name: str
    total_chunks: int
    chunks: list[dict] = Field(default_factory=list, description="All text chunks ordered by page")


class SourceLabelsUpdateRequest(BaseModel):
    date_of_the_constitution: Optional[str] = None
    ministry_name: Optional[str] = None
    source_group_name: Optional[str] = None
    group_role: Optional[str] = Field(default=None, description="primary | amendment | related")


# ─── Health ───────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str = "healthy"
    service: str = "knowledge-service"
    embedding_model: str
    total_sources: int
    total_chunks: int
    storage_path: str
