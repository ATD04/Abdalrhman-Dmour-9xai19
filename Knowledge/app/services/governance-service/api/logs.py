"""
Governance Service — Logs API (alias for audit with sensible defaults)
GET /logs — recent audit logs with simplified interface.
"""
from fastapi import APIRouter, Query
from typing import Optional
from core.audit_logger import AuditLogger

router = APIRouter(tags=["logs"])

audit_logger = AuditLogger()


@router.get("/logs")
async def get_logs(
    limit: int = Query(20, ge=1, le=200),
    escalated_only: bool = False,
    rejected_only: bool = False,
):
    """Get recent logs with simplified filtering."""
    filters = {
        "page": 1,
        "page_size": limit,
    }
    if escalated_only:
        filters["escalated"] = True
    if rejected_only:
        filters["input_passed"] = False

    records, total = audit_logger.query(filters)
    return {
        "logs": records,
        "total": total,
        "showing": len(records),
    }
