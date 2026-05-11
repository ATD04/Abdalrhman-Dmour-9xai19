"""
models.py — SQLAlchemy ORM models for the Persona Classification service.

Three tables:
  - complaints         Raw complaint payload, one row per incoming complaint.
  - classifications    Full LLM classification output + extracted key fields.
  - persona_definitions  Reference data for the 10 official Jordanian archetypes.

JSON columns use SQLAlchemy's built-in JSON type, which on SQLite is stored as
TEXT and round-tripped through Python's json module automatically.

All string columns are TEXT in SQLite; UTF-8 is enforced at the engine level
(see database.py PRAGMA encoding = 'UTF-8'), so Arabic content is preserved.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.database import Base


# ---------------------------------------------------------------------------
# Helper — timezone-aware UTC default
# ---------------------------------------------------------------------------

def _utcnow() -> datetime:
    """Return the current UTC time as a timezone-aware datetime."""
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# 1. complaints
# ---------------------------------------------------------------------------

class Complaint(Base):
    """
    Stores the original incoming complaint payload before classification.

    One row per unique complaint_id. If the same complaint is classified
    multiple times (e.g., retries), only one row exists here; multiple rows
    may exist in `classifications`.
    """

    __tablename__ = "complaints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Business key — echoed from the input payload (see sysprompt.md §3)
    complaint_id: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique complaint identifier, echoed from the input payload.",
    )

    # Full complaint payload as submitted to POST /v1/classify
    payload: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        comment="Raw complaint JSON as received from the caller.",
    )

    # Channel / source — maps to payload['channel'] for convenience queries
    source: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Complaint channel (e.g. call_center, Sanad, MP_office).",
    )

    # Original submission timestamp from the payload (may be null if omitted)
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Submission timestamp from the complaint payload.",
    )

    # DB insertion timestamp — set automatically, never overwritten
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
        comment="UTC timestamp when this row was inserted.",
    )

    # Relationship — one complaint → many classification attempts
    classifications: Mapped[list["Classification"]] = relationship(
        "Classification",
        back_populates="complaint",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Complaint id={self.id} complaint_id={self.complaint_id!r}>"


# ---------------------------------------------------------------------------
# 2. classifications
# ---------------------------------------------------------------------------

class Classification(Base):
    """
    Stores the full validated LLM classification output for a complaint,
    plus the key searchable/filterable fields extracted from that JSON.

    Key field mapping from sysprompt.md §4:
      persona_match_status  ← classification_json["persona_match_status"]
      composite_priority    ← classification_json["severity"]["composite_priority"]
      escalation_required   ← classification_json["escalation"]["required"]
      evidence_strength     ← classification_json["evidence_strength"]
      classification_timestamp ← classification_json["classification_timestamp"]

    Extraction into these columns is the responsibility of B-03 (the validator)
    and the POST /v1/classify handler, NOT of the model itself.
    """

    __tablename__ = "classifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # FK → complaints.complaint_id (the business key, not the PK integer)
    complaint_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("complaints.complaint_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="FK to complaints.complaint_id.",
    )

    # The complete classification JSON returned by the LLM and validated by B-03
    classification_json: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        comment="Full classification output conforming to sysprompt.md §4 schema.",
    )

    # Which LLM model produced this classification
    model_used: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="Model identifier (e.g. 'llama3:70b', 'gpt-4o').",
    )

    # Echoed from classification_json["classification_timestamp"]
    classification_timestamp: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="ISO-8601 timestamp from the LLM output.",
    )

    # Extracted from classification_json["persona_match_status"]
    # Allowed values: strong | partial | weak | none | out_of_taxonomy | error
    persona_match_status: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
        comment="Top-level match status from the classification output.",
    )

    # Extracted from classification_json["severity"]["composite_priority"]
    # Allowed values: P1 | P2 | P3 | P4
    composite_priority: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
        index=True,
        comment="Composite severity priority (P1–P4) per sysprompt.md §7.",
    )

    # Extracted from classification_json["escalation"]["required"]
    escalation_required: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        index=True,
        comment="True when human escalation is required per sysprompt.md §8.",
    )

    # Extracted from classification_json["evidence_strength"]
    # Allowed values: strong | moderate | weak | insufficient
    evidence_strength: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Overall evidence strength label per sysprompt.md §6.2.",
    )

    # DB insertion timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
        comment="UTC timestamp when this row was inserted.",
    )

    # Relationship back to the parent complaint
    complaint: Mapped["Complaint"] = relationship(
        "Complaint",
        back_populates="classifications",
    )

    def __repr__(self) -> str:
        return (
            f"<Classification id={self.id} complaint_id={self.complaint_id!r} "
            f"status={self.persona_match_status!r} priority={self.composite_priority!r}>"
        )


# ---------------------------------------------------------------------------
# 3. persona_definitions
# ---------------------------------------------------------------------------

class PersonaDefinition(Base):
    """
    Reference table for the 10 official Jordanian citizen archetypes defined
    in sysprompt.md §13.

    This table is static — it is seeded once by DB-02 (seed.py) and then only
    read by the API (GET /v1/classifications, GET /v1/personas/stats).

    persona_id holds the numeric string "1" through "10" as defined in §4:
      "persona_id": "1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10"
    """

    __tablename__ = "persona_definitions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Canonical persona ID — string "1"–"10" matching §4 output schema
    persona_id: Mapped[str] = mapped_column(
        String(10),
        unique=True,
        nullable=False,
        index=True,
        comment="Canonical persona ID string ('1'–'10') per sysprompt.md §4.",
    )

    # Arabic persona name (e.g. "أبو محمد الكركي")
    name_ar: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Official Arabic persona name.",
    )

    # English persona name (e.g. "Abu Mohammad: The Disillusioned Pension-Squeezed Patriot")
    name_en: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Official English persona name and tagline.",
    )

    # Ranked issue cluster identifiers from the closed list in sysprompt.md §4
    # Stored as a JSON array of strings, e.g.:
    #   ["pension_erosion", "unemployment", "healthcare_access", "wasta_corruption"]
    issue_clusters: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
        comment="Ranked issue cluster IDs for this persona (closed list from §4).",
    )

    # Bias/heuristic tag identifiers from the closed list in sysprompt.md §5
    # Stored as a JSON array of strings, e.g.:
    #   ["wasta_attribution", "royal_appeal_heuristic", "el_dawleh_wein_learned_helplessness"]
    bias_tags: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
        comment="Relevant bias/heuristic tags for this persona (closed list from §5).",
    )

    # Relative importance tier for dashboard ordering; populated by DB-02.
    # Not the same as composite_priority (P1–P4) in classifications.
    priority_tier: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Display/ordering tier for this persona on the dashboard.",
    )

    # Full description / profile summary in English
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="English description, tagline, and profile summary from §13.",
    )

    def __repr__(self) -> str:
        return (
            f"<PersonaDefinition persona_id={self.persona_id!r} "
            f"name_en={self.name_en!r}>"
        )


# ---------------------------------------------------------------------------
# Explicit composite indexes (supplements the column-level indexes above)
# ---------------------------------------------------------------------------

# Speeds up the most common B-04 filter: filter by priority + escalation together
Index(
    "ix_classifications_priority_escalation",
    Classification.composite_priority,
    Classification.escalation_required,
)
