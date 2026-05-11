"""
scripts/seed_demo_data.py — DEV/DEMO ONLY seed script.

Inserts 3 sample complaint + classification records into SQLite so that
GET /v1/classifications can be tested without running the live LLM.

Safe to run multiple times — skips any complaint_id that already exists.

Usage (from project root, with venv active):
    python scripts/seed_demo_data.py

Do NOT call this from app startup. It is a manual developer tool.
"""

import sys
from pathlib import Path

# Allow running from the project root without installing the package
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from datetime import datetime, timezone

from app.database import SessionLocal, init_db
from app.models import Classification, Complaint

# ---------------------------------------------------------------------------
# Sample classification data
# ---------------------------------------------------------------------------

_DEMO_RECORDS = [
    # -----------------------------------------------------------------
    # Record 1 — Strong Persona 2 (Umm Ahmad), P2, no escalation
    # -----------------------------------------------------------------
    {
        "complaint": {
            "complaint_id": "DEMO-2026-001",
            "payload": {
                "complaint_id": "DEMO-2026-001",
                "citizen_id": "JO-CITIZEN-001",
                "text": (
                    "والله العظيم تعبت، فاتورة الكهرباء اجت 87 دينار هاد الشهر، "
                    "وما عرفت ليش، وابني عنده توجيهي وما قدرنا ندفع رسوم المدرسة، "
                    "والمي ما اجت من 10 ايام. شو بدنا نسوي؟ بدي أعيش بكرامة."
                ),
                "channel": "call_center",
                "language": "Arabic",
                "governorate": "Zarqa",
                "district": "Russeifa",
                "service_type": "electricity",
                "age": 44,
                "gender": "female",
                "occupation": "housewife",
                "citizenship_or_status": "Jordanian",
                "prior_complaints_count": 4,
                "has_open_complaints": True,
                "submitted_at": "2026-04-15T10:23:00+03:00",
            },
            "source": "call_center",
            "submitted_at": datetime(2026, 4, 15, 7, 23, 0, tzinfo=timezone.utc),
        },
        "classification": {
            "complaint_id": "DEMO-2026-001",
            "model_used": "demo-precomputed",
            "classification_timestamp": datetime(2026, 5, 11, 9, 0, 0, tzinfo=timezone.utc),
            "persona_match_status": "strong",
            "composite_priority": "P2",
            "escalation_required": False,
            "evidence_strength": "strong",
            "classification_json": {
                "complaint_id": "DEMO-2026-001",
                "schema_version": "2.0",
                "classification_timestamp": "2026-05-11T09:00:00+03:00",
                "personas": [
                    {
                        "persona_id": "2",
                        "persona_name": "Umm Ahmad: The Worrying Mother / Household Comptroller",
                        "confidence": 0.91,
                        "rationale": (
                            "Speaker is the household financial manager surfacing the canonical "
                            "Umm Ahmad bundle: an unexpected electricity bill, tawjihi-related "
                            "school cost pressure, and a 10-day water cut."
                        ),
                        "matched_issue_clusters": [
                            "electricity_bills",
                            "water_access",
                            "education_tawjihi",
                        ],
                        "matched_behaviors": [
                            "household_financial_management",
                            "calls_to_call_center",
                            "frames_grievance_around_dignity",
                        ],
                        "evidence_quotes": [
                            "فاتورة الكهرباء اجت 87 دينار هاد الشهر",
                            "والمي ما اجت من 10 ايام",
                            "بدي أعيش بكرامة",
                        ],
                    }
                ],
                "persona_match_status": "strong",
                "out_of_taxonomy_reason": None,
                "issue_clusters": [
                    {
                        "cluster": "electricity_bills",
                        "intensity": "high",
                        "evidence_quote": "فاتورة الكهرباء اجت 87 دينار هاد الشهر، وما عرفت ليش",
                    },
                    {
                        "cluster": "water_access",
                        "intensity": "high",
                        "evidence_quote": "والمي ما اجت من 10 ايام",
                    },
                    {
                        "cluster": "education_tawjihi",
                        "intensity": "medium",
                        "evidence_quote": "ابني عنده توجيهي وما قدرنا ندفع رسوم المدرسة",
                    },
                ],
                "behavioral_signature": {
                    "complaint_channels_used": ["call_center"],
                    "tone": "exhausted",
                    "agency_level": "medium",
                    "expected_resolver": "ministry",
                },
                "emotional_drivers": ["exhaustion", "financial_anxiety", "karaameh_dignity"],
                "biases_and_heuristics": [
                    {
                        "bias": "anchoring",
                        "evidence": "Implicit comparison of the 87 JD bill to a prior expected baseline.",
                    },
                    {
                        "bias": "wallah_il_aazeem_intensity_signaling",
                        "evidence": "Opens with 'والله العظيم تعبت' to signal grievance intensity.",
                    },
                ],
                "representative_phrases_detected": ["بدي أعيش بكرامة"],
                "severity": {
                    "personal_urgency": "high",
                    "systemic_frequency": "endemic",
                    "political_volatility": "low",
                    "composite_priority": "P2",
                    "rationale": (
                        "Multiple simultaneous service failures affecting an Umm Ahmad household; "
                        "4 prior complaints indicate recurring pattern."
                    ),
                },
                "evidence_strength": "strong",
                "evidence_strength_rationale": (
                    "Three direct issue-cluster matches with verbatim quotes, canonical "
                    "Umm Ahmad framing, consistent metadata."
                ),
                "underlying_need": (
                    "Predictability of monthly outgoings and confidence that the "
                    "child's tawjihi is achievable."
                ),
                "suggested_pareto_levers": [
                    "electricity_bill_simplifier_in_sanad",
                    "published_water_rationing_calendar",
                    "tawjihi_calibration_publication",
                ],
                "recurring_complainer": {
                    "is_recurring": True,
                    "rationale": "4 prior complaints with current open complaint.",
                },
                "contains_identity_disclosure": False,
                "identity_disclosure_type": "none",
                "escalation": {"required": False, "reason": "none", "priority": "none"},
                "missing_information": [
                    "historic electricity consumption to confirm tier-cliff",
                    "neighborhood water schedule baseline",
                ],
                "responsible_handling_notes": (
                    "Routine Umm Ahmad case; route to Miyahuna and EDCO for service-level "
                    "response. Provide concrete next-step commitment given recurring history."
                ),
            },
        },
    },

    # -----------------------------------------------------------------
    # Record 2 — Strong Persona 10 (Salma/Abu Samir), P1, escalation required
    # -----------------------------------------------------------------
    {
        "complaint": {
            "complaint_id": "DEMO-2026-002",
            "payload": {
                "complaint_id": "DEMO-2026-002",
                "citizen_id": "JO-CITIZEN-002",
                "text": (
                    "أبو سمير، عمره 73 سنة، مريض سكري وضغط. دواء الانسولين ما متوفر "
                    "بمركز الصحة من شهرين. بكرا بكرا بقولوا. الراتب 420 دينار ما يكفي "
                    "أشتري من الصيدلية. ولادي بالغربة. ما قدرت أنام من الوجع."
                ),
                "channel": "call_center",
                "language": "Arabic",
                "governorate": "Irbid",
                "service_type": "health",
                "age": 73,
                "gender": "male",
                "occupation": "retired",
                "citizenship_or_status": "Jordanian",
                "prior_complaints_count": 5,
                "has_open_complaints": True,
                "submitted_at": "2026-05-10T23:45:00+03:00",
            },
            "source": "call_center",
            "submitted_at": datetime(2026, 5, 10, 20, 45, 0, tzinfo=timezone.utc),
        },
        "classification": {
            "complaint_id": "DEMO-2026-002",
            "model_used": "demo-precomputed",
            "classification_timestamp": datetime(2026, 5, 11, 9, 5, 0, tzinfo=timezone.utc),
            "persona_match_status": "strong",
            "composite_priority": "P1",
            "escalation_required": True,
            "evidence_strength": "strong",
            "classification_json": {
                "complaint_id": "DEMO-2026-002",
                "schema_version": "2.0",
                "classification_timestamp": "2026-05-11T09:05:00+03:00",
                "personas": [
                    {
                        "persona_id": "10",
                        "persona_name": "Salma and Abu Samir: The Elderly Pensioner / Chronic-Care Patient",
                        "confidence": 0.88,
                        "rationale": (
                            "73-year-old retired pensioner with insulin-dependent diabetes facing "
                            "a two-month medication stockout at an MoH health centre. Fixed pension "
                            "insufficient for private pharmacy. Canonical Archetype 10 bundle: "
                            "medication_stockout + pension_erosion + isolation."
                        ),
                        "matched_issue_clusters": [
                            "medication_stockout",
                            "healthcare_access",
                            "pension_erosion",
                        ],
                        "matched_behaviors": [
                            "elderly_in_person_complaint",
                            "absent_family_isolation",
                        ],
                        "evidence_quotes": [
                            "دواء الانسولين ما متوفر بمركز الصحة من شهرين",
                            "الراتب 420 دينار ما يكفي أشتري من الصيدلية",
                            "ما قدرت أنام من الوجع",
                        ],
                    }
                ],
                "persona_match_status": "strong",
                "out_of_taxonomy_reason": None,
                "issue_clusters": [
                    {
                        "cluster": "medication_stockout",
                        "intensity": "critical",
                        "evidence_quote": "دواء الانسولين ما متوفر بمركز الصحة من شهرين",
                    },
                    {
                        "cluster": "pension_erosion",
                        "intensity": "high",
                        "evidence_quote": "الراتب 420 دينار ما يكفي أشتري من الصيدلية",
                    },
                    {
                        "cluster": "healthcare_access",
                        "intensity": "critical",
                        "evidence_quote": "بكرا بكرا بقولوا",
                    },
                ],
                "behavioral_signature": {
                    "complaint_channels_used": ["call_center"],
                    "tone": "pleading",
                    "agency_level": "low",
                    "expected_resolver": "ministry",
                },
                "emotional_drivers": ["exhaustion", "fear_of_burden", "loneliness"],
                "biases_and_heuristics": [
                    {
                        "bias": "el_dawleh_wein_learned_helplessness",
                        "evidence": "'بكرا بكرا بقولوا' signals chronic resignation to repeated deferral.",
                    }
                ],
                "representative_phrases_detected": ["بكرا بكرا"],
                "severity": {
                    "personal_urgency": "critical",
                    "systemic_frequency": "endemic",
                    "political_volatility": "none",
                    "composite_priority": "P1",
                    "rationale": (
                        "Insulin-dependent diabetic without medication for two months. "
                        "Personal urgency is critical; escalation required."
                    ),
                },
                "evidence_strength": "strong",
                "evidence_strength_rationale": (
                    "Three verbatim quotes matching Archetype 10 issue clusters; "
                    "high-confidence classification."
                ),
                "underlying_need": (
                    "Uninterrupted supply of insulin and chronic-disease medication at "
                    "the nearest MoH health centre, and predictability of pension income."
                ),
                "suggested_pareto_levers": [
                    "chronic_disease_medication_guarantee",
                    "pension_indexation",
                ],
                "recurring_complainer": {
                    "is_recurring": True,
                    "rationale": "5 prior complaints; current open complaint.",
                },
                "contains_identity_disclosure": False,
                "identity_disclosure_type": "none",
                "escalation": {
                    "required": True,
                    "reason": "medical_emergency",
                    "priority": "immediate",
                },
                "missing_information": [
                    "specific health centre name",
                    "last successful prescription fill date",
                ],
                "responsible_handling_notes": (
                    "Medical emergency: insulin stockout for a 73-year-old diabetic. "
                    "Route immediately to MoH Primary Healthcare Directorate. "
                    "Do not send generic acknowledgment. Human review required."
                ),
            },
        },
    },

    # -----------------------------------------------------------------
    # Record 3 — out_of_taxonomy (no personas), P3, no escalation
    # -----------------------------------------------------------------
    {
        "complaint": {
            "complaint_id": "DEMO-2026-003",
            "payload": {
                "complaint_id": "DEMO-2026-003",
                "citizen_id": None,
                "text": (
                    "I want to complain about the new traffic roundabout near "
                    "the 5th circle in Amman. It was built in the wrong direction "
                    "and causes daily accidents. This is a pure infrastructure "
                    "engineering issue with no relation to any service."
                ),
                "channel": "web_portal",
                "language": "English",
                "governorate": "Amman",
                "service_type": "transport",
                "age": 38,
                "gender": "male",
                "citizenship_or_status": "Jordanian",
                "prior_complaints_count": 1,
                "has_open_complaints": False,
                "submitted_at": "2026-05-09T14:00:00+03:00",
            },
            "source": "web_portal",
            "submitted_at": datetime(2026, 5, 9, 11, 0, 0, tzinfo=timezone.utc),
        },
        "classification": {
            "complaint_id": "DEMO-2026-003",
            "model_used": "demo-precomputed",
            "classification_timestamp": datetime(2026, 5, 11, 9, 10, 0, tzinfo=timezone.utc),
            "persona_match_status": "out_of_taxonomy",
            "composite_priority": "P3",
            "escalation_required": False,
            "evidence_strength": "moderate",
            "classification_json": {
                "complaint_id": "DEMO-2026-003",
                "schema_version": "2.0",
                "classification_timestamp": "2026-05-11T09:10:00+03:00",
                "personas": [],
                "persona_match_status": "out_of_taxonomy",
                "out_of_taxonomy_reason": (
                    "Complaint is a specific road-engineering grievance about a traffic "
                    "roundabout. Does not match any of the 10 archetypes' issue clusters. "
                    "Maps to transport infrastructure but without any persona-level behavioral "
                    "or political framing."
                ),
                "issue_clusters": [
                    {
                        "cluster": "transport",
                        "intensity": "medium",
                        "evidence_quote": "traffic roundabout near the 5th circle causes daily accidents",
                    }
                ],
                "behavioral_signature": {
                    "complaint_channels_used": ["web_portal"],
                    "tone": "matter_of_fact",
                    "agency_level": "medium",
                    "expected_resolver": "ministry",
                },
                "emotional_drivers": ["other"],
                "biases_and_heuristics": [],
                "representative_phrases_detected": [],
                "severity": {
                    "personal_urgency": "medium",
                    "systemic_frequency": "isolated",
                    "political_volatility": "none",
                    "composite_priority": "P3",
                    "rationale": "Road-safety grievance; medium urgency, isolated incident.",
                },
                "evidence_strength": "moderate",
                "evidence_strength_rationale": (
                    "Clear issue cluster but no persona match; single complaint instance."
                ),
                "underlying_need": (
                    "Correction of the roundabout design or re-routing of traffic flow "
                    "to prevent accidents."
                ),
                "suggested_pareto_levers": [],
                "recurring_complainer": {
                    "is_recurring": False,
                    "rationale": "Only 1 prior complaint; does not meet recurring threshold.",
                },
                "contains_identity_disclosure": False,
                "identity_disclosure_type": "none",
                "escalation": {"required": False, "reason": "none", "priority": "none"},
                "missing_information": ["exact roundabout location", "accident report reference"],
                "responsible_handling_notes": (
                    "Out-of-taxonomy engineering complaint. Route to GAM (Greater Amman "
                    "Municipality) traffic engineering department. Flag for taxonomy review."
                ),
            },
        },
    },
]


# ---------------------------------------------------------------------------
# Seed function
# ---------------------------------------------------------------------------

def seed_demo_data() -> None:
    init_db()
    db = SessionLocal()
    try:
        inserted = 0
        skipped = 0
        for record in _DEMO_RECORDS:
            c_data = record["complaint"]
            cl_data = record["classification"]

            # Skip if already exists
            existing = (
                db.query(Complaint)
                .filter(Complaint.complaint_id == c_data["complaint_id"])
                .first()
            )
            if existing:
                print(f"  [demo-seed] Skipping {c_data['complaint_id']} — already exists.")
                skipped += 1
                continue

            # Insert complaint
            complaint = Complaint(
                complaint_id=c_data["complaint_id"],
                payload=c_data["payload"],
                source=c_data["source"],
                submitted_at=c_data["submitted_at"],
            )
            db.add(complaint)
            db.flush()  # get the PK without committing yet

            # Insert classification
            classification = Classification(
                complaint_id=c_data["complaint_id"],
                classification_json=cl_data["classification_json"],
                model_used=cl_data["model_used"],
                classification_timestamp=cl_data["classification_timestamp"],
                persona_match_status=cl_data["persona_match_status"],
                composite_priority=cl_data["composite_priority"],
                escalation_required=cl_data["escalation_required"],
                evidence_strength=cl_data["evidence_strength"],
            )
            db.add(classification)
            inserted += 1

        db.commit()
        print(f"[demo-seed] Done. Inserted {inserted} demo record(s), skipped {skipped}.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
