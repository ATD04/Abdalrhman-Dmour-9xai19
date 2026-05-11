"""
routers/stats.py — GET /v1/personas/stats

Aggregation endpoint powering the dashboard KPI header.
All data is read from SQLite (classifications + persona_definitions).

Aggregation is done in Python rather than SQL because:
  - persona counts and avg_confidence require parsing classification_json["personas"]
  - SQLite JSON functions over large arrays are verbose to write with SQLAlchemy
  - For a demo-scale dataset this is fast and robust against malformed JSON
"""

from collections import defaultdict

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import cast, Integer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Classification, PersonaDefinition

router = APIRouter(prefix="/v1", tags=["stats"])


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class PersonaDistributionItem(BaseModel):
    persona_id: str
    name_ar: str
    name_en: str
    count: int
    avg_confidence: float | None


class StatsResponse(BaseModel):
    total_classifications: int
    persona_distribution: list[PersonaDistributionItem]
    priority_distribution: dict[str, int]
    escalation_count: int
    out_of_taxonomy_count: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_persona_entries(classification_json: dict | None) -> list[tuple[str, float | None]]:
    """
    Return a list of (persona_id, confidence) tuples from a classification JSON blob.
    Skips entries where persona_id is missing.
    confidence may be None if missing or non-numeric.
    """
    try:
        personas = (classification_json or {}).get("personas", [])
        result = []
        for p in personas:
            pid = p.get("persona_id")
            if pid is None:
                continue
            raw_conf = p.get("confidence")
            try:
                conf: float | None = float(raw_conf) if raw_conf is not None else None
            except (TypeError, ValueError):
                conf = None
            result.append((str(pid), conf))
        return result
    except (AttributeError, TypeError):
        return []


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get(
    "/personas/stats",
    response_model=StatsResponse,
    summary="Dashboard KPI statistics",
    description=(
        "Returns aggregate statistics over all stored classification records: "
        "total count, persona distribution with avg confidence, priority breakdown, "
        "escalation count, and out-of-taxonomy count."
    ),
)
def get_personas_stats(db: Session = Depends(get_db)) -> StatsResponse:

    # ---- Fetch all required data in two queries ----------------------------

    classifications: list[Classification] = db.query(Classification).all()
    persona_defs: list[PersonaDefinition] = (
        db.query(PersonaDefinition)
        .order_by(cast(PersonaDefinition.persona_id, Integer))
        .all()
    )

    # ---- Simple scalar aggregations (avoid re-querying) --------------------

    total_classifications = len(classifications)
    escalation_count = sum(1 for c in classifications if c.escalation_required)
    out_of_taxonomy_count = sum(
        1 for c in classifications if c.persona_match_status == "out_of_taxonomy"
    )

    # ---- Priority distribution — always include all four keys ---------------

    priority_distribution: dict[str, int] = {"P1": 0, "P2": 0, "P3": 0, "P4": 0}
    for c in classifications:
        if c.composite_priority in priority_distribution:
            priority_distribution[c.composite_priority] += 1

    # ---- Persona distribution — parse JSON, accumulate per persona_id -------

    # persona_id → list of confidence values (float); missing confidence skipped
    persona_counts: dict[str, int] = defaultdict(int)
    persona_confidences: dict[str, list[float]] = defaultdict(list)

    for c in classifications:
        for pid, conf in _extract_persona_entries(c.classification_json):
            persona_counts[pid] += 1
            if conf is not None:
                persona_confidences[pid].append(conf)

    # Build distribution in persona_id order, one row per definition
    persona_distribution: list[PersonaDistributionItem] = []
    for pdef in persona_defs:
        pid = pdef.persona_id
        count = persona_counts.get(pid, 0)
        confidences = persona_confidences.get(pid, [])
        avg_conf: float | None = (
            round(sum(confidences) / len(confidences), 4) if confidences else None
        )
        persona_distribution.append(
            PersonaDistributionItem(
                persona_id=pid,
                name_ar=pdef.name_ar,
                name_en=pdef.name_en,
                count=count,
                avg_confidence=avg_conf,
            )
        )

    return StatsResponse(
        total_classifications=total_classifications,
        persona_distribution=persona_distribution,
        priority_distribution=priority_distribution,
        escalation_count=escalation_count,
        out_of_taxonomy_count=out_of_taxonomy_count,
    )
