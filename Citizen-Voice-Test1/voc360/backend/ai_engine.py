import requests
import json
import os
import re
from uuid import UUID
from sqlalchemy.orm import Session
from models import Complaint, Cluster

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma4:31b")

_DEFAULT_CLASSIFICATION = {
    "category": "other",
    "sentiment": "negative",
    "urgency": "medium",
    "archetype": "objective",
    "entity": "MOH",
    "submitted_hour_estimate": 9,
}


def call_ollama(prompt: str) -> str:
    try:
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            headers={"Content-Type": "application/json"},
            data=json.dumps({
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.3, "num_predict": 500},
            }),
            timeout=60,
        )
        response.raise_for_status()
        return response.json().get("response", "")
    except Exception:
        return ""


def classify_complaint(text: str) -> dict:
    prompt = (
        "You are an AI assistant for a Jordanian government complaints platform.\n"
        "Analyze this citizen complaint and return ONLY a JSON object, no explanation.\n\n"
        f"Complaint: {text}\n\n"
        "Return this exact JSON structure:\n"
        '{\n'
        '  "category": "one of: medication_shortage, waiting_times, digital_services, '
        'document_processing, staff_behavior, waste_management, municipal_services, '
        'healthcare_services, labor_licensing, school_services, general_health, job_misuse, meta_complaint, other",\n'
        '  "sentiment": "one of: positive, neutral, negative, angry",\n'
        '  "urgency": "one of: low, medium, high, critical",\n'
        '  "archetype": "one of: objective, angry, truncated, formal, emotional, job_misuse",\n'
        '  "entity": "one of: MOH, GAM, CSPD, MOL, MOE",\n'
        '  "submitted_hour_estimate": 9\n'
        "}\n\n"
        "Rules:\n"
        "- medication, health, doctor -> entity: MOH\n"
        "- municipal, garbage, road -> entity: GAM\n"
        "- passport, identity, civil -> entity: CSPD\n"
        "- job, work, license -> entity: MOL\n"
        "- school, teacher, education -> entity: MOE\n"
        "- Short text under 20 chars -> archetype: truncated\n"
        "- Angry dialect text -> archetype: angry\n"
        "- Formal language -> archetype: formal\n"
        "- Job search questions -> archetype: job_misuse, category: job_misuse\n"
        "- Return ONLY the JSON, no markdown, no explanation\n"
    )

    raw = call_ollama(prompt)
    if not raw:
        return dict(_DEFAULT_CLASSIFICATION)

    try:
        return json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        pass

    try:
        start = raw.index("{")
        end = raw.rindex("}") + 1
        return json.loads(raw[start:end])
    except (ValueError, json.JSONDecodeError):
        pass

    return dict(_DEFAULT_CLASSIFICATION)


def find_best_cluster(
    complaint_text: str,
    entity: str,
    category: str,
    db: Session,
) -> "str | None":
    clusters = (
        db.query(Cluster)
        .filter(Cluster.entity == entity, Cluster.status == "active")
        .all()
    )
    if not clusters:
        return None

    cluster_list = "\n".join(
        f"ID: {c.id} | Title: {c.title_ar} | Type: {c.root_cause_type}"
        for c in clusters
    )

    prompt = (
        "You are matching a citizen complaint to the most relevant complaint cluster.\n\n"
        f"Complaint: {complaint_text}\n"
        f"Complaint category: {category}\n"
        f"Ministry: {entity}\n\n"
        "Available clusters:\n"
        f"{cluster_list}\n\n"
        "Return ONLY the ID of the best matching cluster.\n"
        'If no cluster matches well, return "none".\n'
        'Return only the ID string or "none", nothing else.\n'
    )

    raw = call_ollama(prompt).strip().strip("\"' \t\n\r")

    if not raw or "none" in raw.lower():
        return None

    for c in clusters:
        if str(c.id) in raw:
            return str(c.id)

    return None


def process_complaint(complaint_id: str, db: Session) -> dict:
    try:
        complaint = db.query(Complaint).filter(
            Complaint.id == UUID(complaint_id)
        ).first()
        if not complaint:
            return {"processed": False, "error": "Complaint not found"}

        result = classify_complaint(complaint.text)
        complaint.category = result.get("category", "other")
        complaint.sentiment = result.get("sentiment", "negative")
        complaint.urgency = result.get("urgency", "medium")
        complaint.archetype = result.get("archetype", "objective")
        complaint.entity = result.get("entity", complaint.entity or "MOH")
        db.flush()

        cluster_id = find_best_cluster(
            complaint.text,
            complaint.entity,
            complaint.category,
            db,
        )
        if cluster_id:
            complaint.cluster_id = UUID(cluster_id)
            cluster = db.query(Cluster).filter(
                Cluster.id == UUID(cluster_id)
            ).first()
            if cluster:
                cluster.size = (cluster.size or 0) + 1

        db.commit()

        return {
            "complaint_id": str(complaint_id),
            "category": complaint.category,
            "sentiment": complaint.sentiment,
            "urgency": complaint.urgency,
            "archetype": complaint.archetype,
            "entity": complaint.entity,
            "cluster_id": str(complaint.cluster_id) if complaint.cluster_id else None,
            "processed": True,
        }

    except Exception as e:
        db.rollback()
        return {"processed": False, "error": str(e)}
