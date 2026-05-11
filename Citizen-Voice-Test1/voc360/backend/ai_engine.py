import requests
import json
import os
import re
from uuid import UUID
from sqlalchemy.orm import Session
from models import Complaint, Cluster

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma4:31b")

# ── Jordanian Citizen Persona Taxonomy (10 archetypes from VOC sysprompt) ─────
PERSONAS = {
    "abu_mohammad": {
        "name": "أبو محمد — متقاعد / موظف حكومي",
        "keywords_ar": ["تقاعد", "معاش", "جيش", "خدمة عسكرية", "عشيرة", "مؤسسة عسكرية", "قوات مسلحة", "درك", "مخابرات"],
        "issue_clusters": ["pension", "military_healthcare", "tribal_mediation", "public_sector"],
    },
    "umm_ahmad": {
        "name": "أم أحمد — ربة بيت / أم",
        "keywords_ar": ["فاتورة", "كهرباء", "ماء", "أولاد", "توجيهي", "غلاء", "إيجار", "دواء الأطفال", "حليب", "ميزانية"],
        "issue_clusters": ["household_bills", "school_fees", "medication", "food_prices"],
    },
    "tareq": {
        "name": "طارق — شاب متعلم / باحث عن عمل",
        "keywords_ar": ["وظيفة", "خريج", "جامعة", "توظيف", "واسطة", "محسوبية", "مقابلة عمل", "سيرة ذاتية", "بطالة"],
        "issue_clusters": ["youth_unemployment", "wasta", "digital_services", "education"],
    },
    "hana": {
        "name": "هناء — موظفة / امرأة عاملة",
        "keywords_ar": ["تحرش", "إجازة أمومة", "طلاق", "حضانة", "نفقة", "تمييز", "حقوق المرأة", "عنف"],
        "issue_clusters": ["workplace_harassment", "family_law", "maternity", "womens_rights"],
    },
    "karim": {
        "name": "كريم — صاحب مشروع صغير / سائق",
        "keywords_ar": ["وقود", "جمرك", "ترخيص تجاري", "ضريبة", "دين", "سجن مديونية", "سياحة", "بضاعة"],
        "issue_clusters": ["fuel_prices", "customs", "business_licensing", "debt_imprisonment"],
    },
    "ghazi": {
        "name": "غازي — مزارع",
        "keywords_ar": ["زراعة", "محصول", "أرض", "ري", "بذور", "مياه زراعية", "مواشي", "دعم زراعي", "مزرعة"],
        "issue_clusters": ["agricultural_water", "crop_subsidies", "rural_infrastructure"],
    },
    "rania": {
        "name": "رانيا — أم عازبة / مطلقة",
        "keywords_ar": ["مطلقة", "حضانة", "نفقة", "دعم اجتماعي", "معونة", "أرمل", "أرملة", "إعاشة"],
        "issue_clusters": ["single_mother_support", "social_welfare", "custody", "alimony"],
    },
    "sami": {
        "name": "سامي — ناشط / صوت سياسي",
        "keywords_ar": ["فساد", "واسطة", "احتجاج", "مطالبة", "ديمقراطية", "حرية", "رأي عام", "شفافية", "محاسبة"],
        "issue_clusters": ["corruption", "political_voice", "transparency", "accountability"],
    },
    "yousef_fatima": {
        "name": "يوسف/فاطمة — لاجئ / مقيم",
        "keywords_ar": ["لاجئ", "مفوضية", "أونروا", "وثائق", "تصريح عمل", "مخيم", "إقامة", "جنسية", "غزة", "سوريا"],
        "issue_clusters": ["refugee_documentation", "work_permits", "camp_services", "stateless"],
    },
    "salma": {
        "name": "سلمى/أبو سامر — مسن / كبير السن",
        "keywords_ar": ["مسن", "كبير في السن", "مرض مزمن", "سكري", "ضغط الدم", "وحدة", "رعاية المسنين", "معاش تقاعد"],
        "issue_clusters": ["chronic_care", "elderly_pension", "medication_access", "isolation"],
    },
}

# ── Rule-based entity & category keywords ────────────────────────────────────
_ENTITY_KEYWORDS = {
    "MOH": ["دواء", "مستشفى", "طبيب", "مريض", "صحة", "علاج", "دكتور", "عيادة",
             "صيدلية", "حبوب", "حقنة", "تحليل", "أشعة", "تمريض", "طوارئ",
             "صحي", "مركز صحي", "رعاية صحية", "جراحة", "عملية"],
    "GAM": ["نظافة", "قمامة", "شارع", "طريق", "رصيف", "حديقة", "أمانة عمان",
            "ترخيص بناء", "مياه عمان", "صرف صحي", "إنارة", "حفرة", "بلاط",
            "نفايات", "تنظيم مدني", "بناء مخالف", "مواصلات", "باص"],
    "CSPD": ["هوية", "هوية وطنية", "جواز", "جواز سفر", "تسجيل", "شهادة ميلاد",
             "وثيقة", "جنسية", "إقامة", "أحوال مدنية", "سجل مدني", "بطاقة عائلة",
             "شهادة وفاة", "زواج", "طلاق"],
    "MOL": ["عمل", "تأمين اجتماعي", "تصريح عمل", "راتب", "توظيف", "فصل تعسفي",
            "موظف", "ضمان اجتماعي", "نقابة", "عقد عمل", "حوادث العمل", "بطالة"],
    "MOE": ["مدرسة", "معلم", "طالب", "كتاب", "منهج", "توجيهي", "تعليم",
            "تربية", "فصل دراسي", "مديرة", "مدير مدرسة", "حافلة مدرسية",
            "رسوم مدرسية", "امتحان"],
}

_CATEGORY_KEYWORDS = {
    "medication_shortage": ["نقص دواء", "ما في دواء", "نفد الدواء", "دواء غير متوفر", "صيدلية"],
    "waiting_times": ["انتظار", "ازدحام", "دور", "طابور", "ساعات", "وقت طويل", "دوام"],
    "digital_services": ["موقع", "تطبيق", "إلكتروني", "رابط", "كلمة مرور", "تسجيل دخول", "خدمة رقمية"],
    "document_processing": ["وثيقة", "هوية", "جواز", "ورقة", "معاملة", "استخراج", "تجديد"],
    "staff_behavior": ["موظف", "سلوك", "تعامل", "إهانة", "تجاهل", "مسؤول", "مدير", "تكبّر"],
    "waste_management": ["قمامة", "نفايات", "نظافة", "رائحة", "حاوية"],
    "municipal_services": ["طريق", "شارع", "إنارة", "رصيف", "حفرة", "بلاط", "حديقة"],
    "healthcare_services": ["مستشفى", "علاج", "طبيب", "طوارئ", "رعاية", "عيادة"],
    "labor_licensing": ["تصريح", "ترخيص", "عمل", "نقابة", "عقد", "فصل"],
    "school_services": ["مدرسة", "معلم", "كتاب", "منهج", "فصل", "مدير"],
}

_SENTIMENT_ANGRY = ["مسخرة", "والله", "ولله", "ما في أحد", "ما في حل", "حرام", "عيب", "شو هالـ", "بدنا نشكو", "مين يسمع"]
_URGENCY_HIGH = ["عاجل", "ضروري", "فوري", "حرج", "طارئ", "خطر", "وفاة", "مات", "يموت", "حرجة"]


def _rule_based_classify(text: str) -> dict:
    """Fast, offline rule-based classifier — works without Ollama."""
    tl = text.lower()

    # Entity scoring
    entity_scores = {e: sum(1 for kw in kws if kw in tl) for e, kws in _ENTITY_KEYWORDS.items()}
    entity = max(entity_scores, key=entity_scores.get) if max(entity_scores.values()) > 0 else None

    # Category scoring
    cat_scores = {c: sum(1 for kw in kws if kw in tl) for c, kws in _CATEGORY_KEYWORDS.items()}
    category = max(cat_scores, key=cat_scores.get) if max(cat_scores.values()) > 0 else "other"

    # Sentiment
    angry_hits = sum(1 for kw in _SENTIMENT_ANGRY if kw in tl)
    if angry_hits >= 2:
        sentiment = "angry"
    elif any(kw in tl for kw in ["سعيد", "ممتاز", "شكراً", "رائع", "جيد"]):
        sentiment = "positive"
    elif len(text.strip()) < 20:
        sentiment = "neutral"
    else:
        sentiment = "negative"

    # Urgency
    urgency = "high" if any(kw in tl for kw in _URGENCY_HIGH) else "medium"

    # Archetype
    if len(text.strip()) < 25:
        archetype = "truncated"
    elif angry_hits >= 2:
        archetype = "angry"
    elif any(kw in tl for kw in ["أود الإفادة", "بكل احترام", "بإجلال", "تقديراً"]):
        archetype = "formal"
    else:
        archetype = "objective"

    # Default entity map from category
    _cat_entity = {
        "medication_shortage": "MOH", "healthcare_services": "MOH",
        "waiting_times": "MOH", "waste_management": "GAM",
        "municipal_services": "GAM", "document_processing": "CSPD",
        "labor_licensing": "MOL", "school_services": "MOE",
        "digital_services": None, "staff_behavior": None,
    }

    if not entity:
        entity = _cat_entity.get(category) or "MOH"

    return {
        "category": category,
        "sentiment": sentiment,
        "urgency": urgency,
        "archetype": archetype,
        "entity": entity,
        "submitted_hour_estimate": 9,
    }


def _classify_persona(text: str) -> dict:
    """Map citizen text to Jordanian persona archetypes."""
    tl = text.lower()
    results = []
    for pid, pdata in PERSONAS.items():
        hits = [kw for kw in pdata["keywords_ar"] if kw in tl]
        if len(hits) >= 2:
            confidence = min(0.5 + len(hits) * 0.08, 0.92)
            results.append({
                "persona_id": pid,
                "persona_name": pdata["name"],
                "confidence": round(confidence, 2),
                "evidence_keywords": hits[:3],
            })
    results.sort(key=lambda x: x["confidence"], reverse=True)
    return {
        "personas": results[:2],  # top 2 only
        "primary_persona": results[0]["persona_id"] if results else "unclassified",
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
            timeout=15,
        )
        response.raise_for_status()
        return response.json().get("response", "")
    except Exception:
        return ""


def classify_complaint(text: str, existing_entity: str = None) -> dict:
    """Classify a complaint using Ollama if available, else rule-based fallback."""
    # Always run rule-based first
    rule_result = _rule_based_classify(text)

    # Try Ollama for enhanced classification
    prompt = (
        "You are an AI analyst for a Jordanian government complaints platform.\n"
        "Analyze this citizen complaint and return ONLY a JSON object.\n\n"
        f"Complaint: {text}\n\n"
        '{"category":"one of: medication_shortage,waiting_times,digital_services,'
        'document_processing,staff_behavior,waste_management,municipal_services,'
        'healthcare_services,labor_licensing,school_services,general_health,other",'
        '"sentiment":"one of: positive,neutral,negative,angry",'
        '"urgency":"one of: low,medium,high,critical",'
        '"archetype":"one of: objective,angry,truncated,formal,emotional",'
        '"entity":"one of: MOH,GAM,CSPD,MOL,MOE",'
        '"submitted_hour_estimate":9}\n\n'
        "MOH=health/medicine, GAM=municipality/roads/waste, CSPD=civil ID/passport, "
        "MOL=work/labor, MOE=education/schools\n"
        "Return ONLY valid JSON, no other text."
    )

    raw = call_ollama(prompt)
    if raw:
        try:
            llm_result = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            try:
                start = raw.index("{")
                end = raw.rindex("}") + 1
                llm_result = json.loads(raw[start:end])
            except Exception:
                llm_result = None

        if llm_result and isinstance(llm_result, dict):
            # Merge: LLM wins on category/sentiment/archetype, rule wins on entity if LLM is uncertain
            rule_result.update({k: v for k, v in llm_result.items() if v})
            return rule_result

    # Rule-based result — respect existing entity if already set and classification is ambiguous
    if existing_entity and rule_result["entity"] == "MOH" and max(
        sum(1 for kw in kws if kw in text.lower()) for kws in _ENTITY_KEYWORDS.values()
    ) < 2:
        rule_result["entity"] = existing_entity

    return rule_result


def find_best_cluster(complaint_text: str, entity: str, category: str, db: Session) -> "str | None":
    clusters = (
        db.query(Cluster)
        .filter(Cluster.entity == entity, Cluster.status == "active")
        .all()
    )
    if not clusters:
        return None

    # Rule-based: pick cluster with matching root_cause_type
    _cat_to_root = {
        "medication_shortage": "infrastructure_deficit",
        "waiting_times": "staff_capacity",
        "digital_services": "process_failure",
        "document_processing": "process_failure",
        "staff_behavior": "staff_capacity",
        "waste_management": "infrastructure_deficit",
        "municipal_services": "infrastructure_deficit",
        "healthcare_services": "infrastructure_deficit",
        "labor_licensing": "policy_gap",
        "school_services": "staff_capacity",
    }
    target_root = _cat_to_root.get(category)
    if target_root:
        for c in clusters:
            if c.root_cause_type == target_root:
                return str(c.id)

    # Try Ollama for smarter matching
    cluster_list = "\n".join(
        f"ID: {c.id} | Title: {c.title_ar} | Type: {c.root_cause_type}"
        for c in clusters[:8]
    )
    prompt = (
        f"Match this complaint to the best cluster.\n"
        f"Complaint: {complaint_text[:200]}\nCategory: {category}\nMinistry: {entity}\n\n"
        f"Clusters:\n{cluster_list}\n\n"
        'Return ONLY the UUID of the best match, or "none".'
    )
    raw = call_ollama(prompt).strip().strip("\"' \t\n\r")
    if raw and "none" not in raw.lower():
        for c in clusters:
            if str(c.id) in raw:
                return str(c.id)

    # Fallback: first cluster for this entity
    return str(clusters[0].id) if clusters else None


def process_complaint(complaint_id: str, db: Session) -> dict:
    try:
        complaint = db.query(Complaint).filter(
            Complaint.id == UUID(complaint_id)
        ).first()
        if not complaint:
            return {"processed": False, "error": "Complaint not found"}

        existing_entity = complaint.entity
        result = classify_complaint(complaint.text, existing_entity=existing_entity)

        complaint.category = result.get("category", "other")
        complaint.sentiment = result.get("sentiment", "negative")
        complaint.urgency = result.get("urgency", "medium")
        complaint.archetype = result.get("archetype", "objective")

        # Only override entity if classification has strong evidence
        new_entity = result.get("entity", existing_entity)
        complaint.entity = new_entity if new_entity else existing_entity
        db.flush()

        cluster_id = find_best_cluster(
            complaint.text, complaint.entity, complaint.category, db
        )
        if cluster_id:
            complaint.cluster_id = UUID(cluster_id)
            cluster = db.query(Cluster).filter(Cluster.id == UUID(cluster_id)).first()
            if cluster:
                cluster.size = (cluster.size or 0) + 1

        db.commit()

        # Persona classification (no DB write needed — informational)
        persona_info = _classify_persona(complaint.text)

        return {
            "complaint_id": str(complaint_id),
            "category": complaint.category,
            "sentiment": complaint.sentiment,
            "urgency": complaint.urgency,
            "archetype": complaint.archetype,
            "entity": complaint.entity,
            "cluster_id": str(complaint.cluster_id) if complaint.cluster_id else None,
            "persona": persona_info,
            "processed": True,
        }

    except Exception as e:
        db.rollback()
        return {"processed": False, "error": str(e)}
