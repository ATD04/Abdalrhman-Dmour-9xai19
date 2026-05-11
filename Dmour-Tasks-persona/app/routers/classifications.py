"""
routers/classifications.py — GET /v1/classifications

Returns a paginated list of stored classification records from SQLite,
with optional filters and joined persona_definitions metadata.

Filtering strategy:
  - complaint_id, composite_priority: applied as SQL WHERE clauses against
    indexed columns — fast even at scale.
  - persona_id: applied in Python after the SQL fetch, because SQLite JSON
    functions require a junction table or raw text() subquery; for a demo
    service this is simpler and correct. The tradeoff is that total count
    and pagination are computed after the Python filter step.

Error behaviour:
  - Invalid composite_priority  → HTTP 400
  - page < 1                    → HTTP 400
  - page_size out of [1, 100]   → HTTP 400
  - Malformed classification_json → skips persona extraction, not a 500
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Classification, PersonaDefinition
from app.schemas import ClassificationItem, ClassificationsResponse, PersonaMetaItem

router = APIRouter(prefix="/v1", tags=["classifications"])

_VALID_PRIORITIES: frozenset[str] = frozenset({"P1", "P2", "P3", "P4"})


# ---------------------------------------------------------------------------
# Helper — extract persona IDs from a classification JSON blob safely
# ---------------------------------------------------------------------------

def _extract_persona_ids(classification_json: dict | None) -> list[str]:
    """Return the list of persona_id strings from classification_json["personas"]."""
    try:
        personas = (classification_json or {}).get("personas", [])
        return [str(p["persona_id"]) for p in personas if "persona_id" in p]
    except (AttributeError, TypeError, KeyError):
        return []


def _row_matches_persona_id(row: Classification, persona_id: str) -> bool:
    """True if the given persona_id appears in this classification's personas array."""
    return persona_id in _extract_persona_ids(row.classification_json)


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get(
    "/classifications",
    response_model=ClassificationsResponse,
    summary="List stored classification records",
    description=(
        "Returns a paginated list of classifications stored in SQLite. "
        "Supports filtering by complaint_id, persona_id, and composite_priority."
    ),
)
def list_classifications(
    complaint_id: str | None = Query(
        default=None,
        description="Filter by exact complaint_id.",
    ),
    persona_id: str | None = Query(
        default=None,
        description='Filter by persona ID ("1"–"10") present in classification_json["personas"].',
    ),
    composite_priority: str | None = Query(
        default=None,
        description="Filter by composite priority. Allowed: P1, P2, P3, P4.",
    ),
    page: int = Query(
        default=1,
        description="Page number (1-based).",
    ),
    page_size: int = Query(
        default=20,
        description="Items per page (1–100).",
    ),
    db: Session = Depends(get_db),
) -> ClassificationsResponse:

    # ---- Input validation → HTTP 400 ----------------------------------------

    if page < 1:
        raise HTTPException(status_code=400, detail="page must be >= 1")

    if page_size < 1 or page_size > 100:
        raise HTTPException(
            status_code=400, detail="page_size must be between 1 and 100"
        )

    if composite_priority is not None and composite_priority not in _VALID_PRIORITIES:
        raise HTTPException(
            status_code=400,
            detail=f"composite_priority must be one of: {', '.join(sorted(_VALID_PRIORITIES))}",
        )

    # ---- SQL-level filters (indexed columns) --------------------------------

    query = db.query(Classification)

    if complaint_id is not None:
        query = query.filter(Classification.complaint_id == complaint_id)

    if composite_priority is not None:
        query = query.filter(Classification.composite_priority == composite_priority)

    # Consistent ordering: most recent first
    query = query.order_by(Classification.created_at.desc())

    rows: list[Classification] = query.all()

    # ---- Python-level persona_id filter -------------------------------------
    # Applied after SQL fetch because persona IDs are embedded inside the JSON
    # blob rather than in a dedicated indexed column.

    if persona_id is not None:
        rows = [r for r in rows if _row_matches_persona_id(r, persona_id)]

    # ---- Pagination ---------------------------------------------------------

    total = len(rows)
    start = (page - 1) * page_size
    page_rows = rows[start : start + page_size]

    # ---- Persona definition join --------------------------------------------
    # Collect all persona IDs referenced in this result page, then fetch them
    # in a single query to avoid N+1.

    needed_ids: set[str] = set()
    for row in page_rows:
        needed_ids.update(_extract_persona_ids(row.classification_json))

    persona_map: dict[str, PersonaDefinition] = {}
    if needed_ids:
        defs = (
            db.query(PersonaDefinition)
            .filter(PersonaDefinition.persona_id.in_(needed_ids))
            .all()
        )
        persona_map = {d.persona_id: d for d in defs}

    # ---- Build response items -----------------------------------------------

    items: list[ClassificationItem] = []
    for row in page_rows:
        persona_ids_in_json = _extract_persona_ids(row.classification_json)

        persona_metadata: list[PersonaMetaItem] = []
        for pid in persona_ids_in_json:
            if pid in persona_map:
                persona_metadata.append(
                    PersonaMetaItem.model_validate(persona_map[pid])
                )

        items.append(
            ClassificationItem(
                id=row.id,
                complaint_id=row.complaint_id,
                classification_json=row.classification_json or {},
                persona_match_status=row.persona_match_status,
                composite_priority=row.composite_priority,
                escalation_required=row.escalation_required,
                evidence_strength=row.evidence_strength,
                classification_timestamp=row.classification_timestamp,
                created_at=row.created_at,
                persona_metadata=persona_metadata,
            )
        )

    return ClassificationsResponse(
        page=page,
        page_size=page_size,
        total=total,
        items=items,
    )
