"""
Governance Service — Audit API Endpoints
POST /audit — log a query/response interaction
GET  /audit — query audit logs with filters
GET  /audit/{request_id} — get a single audit record
"""
import logging
from fastapi import APIRouter, Query
from typing import Optional
from models.schemas import AuditEntry, AuditRecord
from core.audit_logger import AuditLogger

logger = logging.getLogger("governance-service.audit")
router = APIRouter(tags=["audit"])

audit_logger = AuditLogger()


@router.post("/audit", status_code=201)
async def create_audit(entry: AuditEntry):
    """Log a query/response interaction from the agent service."""
    row_id = audit_logger.log(entry.model_dump())
    return {"status": "logged", "id": row_id, "request_id": entry.request_id}


@router.get("/audit")
async def query_audit(
    session_id: Optional[str] = None,
    user_type: Optional[str] = None,
    sector: Optional[str] = None,
    escalated: Optional[bool] = None,
    input_passed: Optional[bool] = None,
    output_passed: Optional[bool] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """Query audit logs with optional filters."""
    filters = {
        "session_id": session_id,
        "user_type": user_type,
        "sector": sector,
        "escalated": escalated,
        "input_passed": input_passed,
        "output_passed": output_passed,
        "date_from": date_from,
        "date_to": date_to,
        "page": page,
        "page_size": page_size,
    }
    records, total = audit_logger.query(filters)
    return {
        "records": records,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/audit/{request_id}")
async def get_audit(request_id: str):
    """Get a single audit record by request_id."""
    record = audit_logger.get(request_id)
    if record is None:
        return {"error": f"Audit record not found: {request_id}"}, 404
    return record


@router.post("/audit/cleanup")
async def cleanup_audit():
    """Delete audit records older than the retention period."""
    count = audit_logger.cleanup()
    return {"status": "cleaned", "deleted_count": count}
