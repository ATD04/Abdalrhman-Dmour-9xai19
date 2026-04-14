"""
Workflow Service — Case APIs
"""
from __future__ import annotations
import uuid
from fastapi import APIRouter, HTTPException, Query
from models.schemas import (
    CaseCreateRequest,
    CaseUpdateRequest,
    CaseNoteRequest,
    CaseResolveRequest,
    AnsweredMatchRequest,
    CaseDetails,
    CaseListResponse,
    CaseRecord,
)
from storage.database import Database

router = APIRouter(tags=["cases"])
db = Database()


@router.post("/cases", response_model=CaseDetails)
async def create_case(req: CaseCreateRequest):
    payload = req.model_dump()
    payload["case_id"] = uuid.uuid4().hex[:10]
    created = db.create_case(payload)
    if not created:
        raise HTTPException(status_code=500, detail="Failed to create case")
    return CaseDetails(**created)


@router.get("/cases", response_model=CaseListResponse)
async def list_cases(
    status: str | None = Query(default=None),
    sector: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    assignee: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    cases, total = db.list_cases(
        {
            "status": status,
            "sector": sector,
            "priority": priority,
            "assignee": assignee,
            "user_id": user_id,
            "page": page,
            "page_size": page_size,
        }
    )
    return CaseListResponse(total=total, page=page, page_size=page_size, cases=[CaseRecord(**c) for c in cases])


@router.get("/cases/{case_id}", response_model=CaseDetails)
async def get_case(case_id: str):
    case = db.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return CaseDetails(**case)


@router.patch("/cases/{case_id}", response_model=CaseDetails)
async def update_case(case_id: str, req: CaseUpdateRequest, actor: str = Query(default="admin")):
    case = db.update_case(case_id, req.model_dump(), actor=actor)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return CaseDetails(**case)


@router.post("/cases/{case_id}/notes", response_model=CaseDetails)
async def add_note(case_id: str, req: CaseNoteRequest):
    if not db.get_case(case_id):
        raise HTTPException(status_code=404, detail="Case not found")
    db.add_timeline_event(
        case_id=case_id,
        event_type="note",
        actor=req.actor,
        note=req.note,
        metadata=req.metadata,
    )
    case = db.get_case(case_id)
    return CaseDetails(**case)


@router.post("/cases/{case_id}/resolve", response_model=CaseDetails)
async def resolve_case(case_id: str, req: CaseResolveRequest):
    case = db.resolve_case(
        case_id=case_id,
        resolution_answer=req.resolution_answer,
        resolution_note=req.resolution_note,
        actor=req.actor,
    )
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return CaseDetails(**case)


@router.delete("/cases/{case_id}")
async def delete_case(case_id: str):
    if not db.get_case(case_id):
        raise HTTPException(status_code=404, detail="Case not found")
    db.delete_case(case_id)
    return {"deleted": True, "case_id": case_id}


@router.get("/users/{user_id}/cases", response_model=CaseListResponse)
async def list_user_cases(
    user_id: str,
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    cases, total = db.list_cases(
        {
            "user_id": user_id,
            "status": status,
            "page": page,
            "page_size": page_size,
        }
    )
    return CaseListResponse(total=total, page=page, page_size=page_size, cases=[CaseRecord(**c) for c in cases])


@router.post("/cases/{case_id}/faq_candidate", response_model=CaseDetails)
async def mark_faq_candidate(case_id: str, actor: str = Query(default="admin")):
    case = db.mark_faq_candidate(case_id, actor=actor)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return CaseDetails(**case)


@router.get("/cases/answered/match")
async def find_answered_case_match(
    query: str = Query(..., min_length=1),
    user_id: str | None = Query(default=None),
    session_id: str | None = Query(default=None),
    query_embedding: str | None = Query(default=None),
):
    embedding_vec = None
    if query_embedding:
        try:
            embedding_vec = [float(v) for v in query_embedding.split(",") if v.strip()]
        except Exception:
            embedding_vec = None

    case = db.find_resolved_answer(
        query=query,
        user_id=user_id,
        session_id=session_id,
        query_embedding=embedding_vec,
    )
    if not case:
        return {"found": False}
    return {
        "found": True,
        "case_id": case["case_id"],
        "resolution_answer": case.get("resolution_answer"),
        "resolved_at": case.get("resolved_at"),
        "query": case.get("query"),
        "match_score": case.get("match_score"),
        "match_scope": case.get("match_scope"),
    }


@router.post("/cases/answered/match")
async def find_answered_case_match_post(req: AnsweredMatchRequest):
    case = db.find_resolved_answer(
        query=req.query,
        user_id=req.user_id,
        session_id=req.session_id,
        query_embedding=req.query_embedding,
    )
    if not case:
        return {"found": False}
    return {
        "found": True,
        "case_id": case["case_id"],
        "resolution_answer": case.get("resolution_answer"),
        "resolved_at": case.get("resolved_at"),
        "query": case.get("query"),
        "match_score": case.get("match_score"),
        "match_scope": case.get("match_scope"),
    }
