import random
import uuid
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import Complaint, Cluster, KPI, Action, Simulation, AdvancedSignal

# ── Lookup tables ─────────────────────────────────────────────────────────────

GOVERNORATES = ["عمّان", "إربد", "الزرقاء", "العقبة", "المفرق", "جرش", "مادبا", "الكرك"]

SOURCES = ["bekhedmetkom", "call_center", "email", "survey", "app"]
SOURCE_WEIGHTS = [30, 25, 20, 15, 10]

STATUSES = ["open", "in_progress", "resolved"]
STATUS_WEIGHTS = [65, 20, 15]

ARCHETYPE_SENTIMENT = {
    "angry": "angry",
    "truncated": "negative",
    "formal": "neutral",
    "objective": "negative",
    "emotional": "angry",
    "job_misuse": "neutral",
}

URGENCY_MAP = {
    ("MOH", "angry"): "critical",
    ("MOH", "emotional"): "critical",
    ("MOH", "objective"): "high",
    ("MOH", "formal"): "medium",
    ("MOH", "truncated"): "low",
    ("GAM", "angry"): "high",
    ("GAM", "objective"): "medium",
    ("GAM", "truncated"): "low",
    ("CSPD", "angry"): "high",
    ("CSPD", "objective"): "medium",
    ("CSPD", "truncated"): "low",
    ("MOL", "objective"): "medium",
    ("MOL", "job_misuse"): "low",
    ("MOL", "angry"): "high",
    ("MOL", "truncated"): "low",
    ("MOE", "objective"): "medium",
    ("MOE", "angry"): "high",
    ("MOE", "truncated"): "low",
}

# Cluster indices (0-based) per entity — matches clusters_data order below
ENTITY_CLUSTER_IDX = {
    "MOH":  [0, 1, 8, 11, 13, 18],
    "GAM":  [5, 10, 12, 14, 17, 19],
    "CSPD": [2, 4, 7, 15],
    "MOL":  [3, 9],
    "MOE":  [6, 16],
}

# Archetype → preferred cluster indices (subset of ENTITY_CLUSTER_IDX per entity)
ARCHETYPE_CLUSTER_HINT = {
    "MOH":  {"objective": [0, 1],  "angry": [0, 18], "truncated": [0, 1],
             "formal": [13, 11],   "emotional": [0, 1]},
    "GAM":  {"objective": [10, 19, 14], "angry": [5, 10], "truncated": [10, 17]},
    "CSPD": {"objective": [2, 15, 4],   "angry": [2, 15], "truncated": [2, 7]},
    "MOL":  {"objective": [9, 3], "job_misuse": [3], "angry": [9], "truncated": [9]},
    "MOE":  {"objective": [6, 16], "angry": [16, 6], "truncated": [6, 16]},
}

ENTITY_CATEGORY = {
    "MOH":  {"objective": "healthcare_services", "angry": "medication_shortage",
             "truncated": "general_health",       "formal": "health_insurance",
             "emotional": "emergency_services"},
    "GAM":  {"objective": "municipal_services", "angry": "waste_management",
             "truncated": "urban_infrastructure"},
    "CSPD": {"objective": "document_processing", "angry": "digital_services",
             "truncated": "civil_services"},
    "MOL":  {"objective": "labor_licensing", "job_misuse": "employment_inquiry",
             "angry": "work_permits",       "truncated": "employment_general"},
    "MOE":  {"objective": "school_enrollment", "angry": "education_staff",
             "truncated": "education_resources"},
}

TEMPLATES = {
    "MOH": {
        "objective": [
            "لم يتوفر دواء ضغط الدم في مركز صحي {gov} منذ {n} أسابيع",
            "انتظرت {n} ساعة في {gov} للحصول على موعد طبي ولم أحصل عليه",
            "مركز صحي {gov} لا يوفر خدمة الأشعة منذ شهر كامل",
            "تم رفض طلب التأمين الصحي دون إبداء أسباب واضحة",
            "الدكتور المختص غير متوفر منذ أسبوعين في العيادة",
        ],
        "angry": [
            "هاد مش معقول! ثلاث مرات رحت على مركز {gov} وما لقيت دواء",
            "والله زهقت من هالأوضاع، كل يوم نفس المشكلة ولا حدا يهتم",
            "إلى متى هالإهمال؟ مريض ومحتاج دواء وما في حل",
            "شهرين وأنا أحاول وما في نتيجة، هاد مش عدل أبداً",
        ],
        "truncated": [
            "نقص دواء", "مشكلة موعد", "ما في دكتور", "محتاج مساعدة",
            "مركز مغلق", "دواء مزمن",
        ],
        "formal": [
            "أود الإشارة إلى تأخر صرف دوائي المزمن للمرة الثالثة خلال هذا الشهر",
            "يشرفني رفع شكوى رسمية بشأن غياب الكادر الطبي في مركز {gov} الصحي",
            "أتقدم بهذه الشكوى استناداً لحقي في الرعاية الصحية المكفولة بموجب القانون",
        ],
        "emotional": [
            "طفلي مريض من ساعتين وما في دكتور في الطوارئ، شو أعمل؟",
            "أنا أم وعندي ثلاث أطفال محتاجين دواء ولا قادرة توفره، ساعدوني",
            "والدي مريض قلب وما قدرنا نحصل على الدواء، الله يساعدنا",
        ],
    },
    "GAM": {
        "objective": [
            "تراكم النفايات في حي {gov} منذ {n} أيام دون رفع",
            "حفرة كبيرة في شارع رئيسي في {gov} تشكل خطراً على السيارات",
            "لم يتم تجديد ترخيص المحل منذ {n} أشهر رغم تقديم الطلب",
            "إنارة الشوارع معطلة في منطقة {gov} منذ أسبوع",
        ],
        "angry": [
            "كل يوم نفس المشكلة في شارعنا والبلدية ما تحرك ساكن",
            "دفعنا رسوم الترخيص وبعدين ما في رد، شو هاد؟",
            "الزبالة من أسبوع ولسا ما جاء أحد، مش معقول",
        ],
        "truncated": [
            "نفايات متراكمة", "حفرة في الطريق", "إنارة معطلة", "ترخيص متأخر",
        ],
    },
    "CSPD": {
        "objective": [
            "مضى {n} أشهر على تقديم طلب جواز السفر ولم أتسلمه",
            "البوابة الإلكترونية لا تعمل منذ {n} أيام",
            "تم رفض طلب تجديد الهوية دون توضيح السبب",
            "خدمة الحجز الإلكتروني للمواعيد لا تستجيب",
        ],
        "angry": [
            "البوابة ما بتشتغل من أيام وما في حدا يرد على الهاتف",
            "شهور وأنا أنتظر جواز سفري، هاد مش مقبول",
            "كل ما أحاول أجدد هويتي تقول لي النظام واقف",
        ],
        "truncated": [
            "جواز سفر متأخر", "بوابة لا تعمل", "هوية مرفوضة", "موعد إلكتروني",
        ],
    },
    "MOL": {
        "objective": [
            "تقدمت بطلب توظيف منذ {n} أشهر ولم أتلق أي رد",
            "رخصة مزاولة المهنة لم تُجدد رغم استيفاء جميع الشروط",
            "طلبت إجازة عمل منذ {n} أشهر ولم يُبت فيها حتى الآن",
        ],
        "job_misuse": [
            "أبحث عن وظيفة مناسبة في القطاع الحكومي، هل يوجد شواغر؟",
            "أريد التقديم على وظيفة في وزارة الصحة، كيف أتقدم؟",
            "خريج جديد أبحث عن فرصة عمل في {gov}",
            "هل هناك وظائف متاحة في مراكز الخدمة الحكومية؟",
        ],
        "angry": [
            "أشهر وأنا أنتظر تجديد رخصة المهنة وما في رد",
            "هاد وين العدالة؟ قدمت طلب وما في أي تواصل",
        ],
        "truncated": [
            "رخصة مهنة", "طلب توظيف", "إجازة عمل متأخرة",
        ],
    },
    "MOE": {
        "objective": [
            "لم يُقبل طلب تسجيل ابني في المدرسة رغم استيفاء الشروط",
            "نقص في معلمي مادة الرياضيات في مدرسة {gov}",
            "الكتب المدرسية لم توزع حتى الآن على الطلاب",
        ],
        "angry": [
            "ابني ما قدر يتسجل في المدرسة والسنة بدها تبدأ",
            "ما في معلم رياضيات من بداية الفصل، كيف يتعلم الأطفال؟",
        ],
        "truncated": [
            "تسجيل مدرسي", "نقص معلمين", "كتب مدرسية",
        ],
    },
}

# ── Private helpers ───────────────────────────────────────────────────────────

def _random_q1_2026_dt() -> datetime:
    start = datetime(2026, 1, 1)
    delta_s = int((datetime(2026, 3, 31, 23, 59, 59) - start).total_seconds())
    return start + timedelta(seconds=random.randint(0, delta_s))


def _fill(template: str) -> str:
    return (
        template
        .replace("{gov}", random.choice(GOVERNORATES))
        .replace("{n}", str(random.randint(2, 8)))
    )


def _pick_archetype(entity: str) -> str:
    options = {
        "MOH":  (["objective", "angry", "truncated", "formal", "emotional"], [35, 25, 20, 10, 10]),
        "GAM":  (["objective", "angry", "truncated"], [50, 35, 15]),
        "CSPD": (["objective", "angry", "truncated"], [55, 30, 15]),
        "MOL":  (["objective", "job_misuse", "angry", "truncated"], [40, 35, 15, 10]),
        "MOE":  (["objective", "angry", "truncated"], [60, 25, 15]),
    }
    opts, weights = options[entity]
    return random.choices(opts, weights=weights, k=1)[0]


def _pick_cluster_id(entity: str, archetype: str, cluster_ids: list) -> uuid.UUID:
    hints = ARCHETYPE_CLUSTER_HINT.get(entity, {}).get(archetype)
    idx = random.choice(hints) if hints else random.choice(ENTITY_CLUSTER_IDX[entity])
    return cluster_ids[idx]


# ── Main generator ────────────────────────────────────────────────────────────

def generate_all_data(db: Session) -> dict:
    # ── Clear existing data (reverse FK order) ────────────────────────────
    db.query(AdvancedSignal).delete()
    db.query(Simulation).delete()
    db.query(Action).delete()
    db.query(KPI).delete()
    db.query(Complaint).delete()
    db.query(Cluster).delete()
    db.commit()

    # ── Step 1: Clusters ─────────────────────────────────────────────────
    clusters_data = [
        {"title": "Medication Stockouts",
         "title_ar": "نقص الأدوية في المراكز الصحية",
         "root_cause": "No automated inventory tracking or early warning system for medication levels",
         "root_cause_ar": "غياب نظام تتبع المخزون والتنبيه المبكر عند نقص الأدوية",
         "root_cause_type": "infrastructure_deficit", "entity": "MOH",
         "severity": "critical", "confidence_score": 0.91},
        {"title": "Long Waiting Times",
         "title_ar": "طول فترات الانتظار في المراكز الصحية",
         "root_cause": "Insufficient staff scheduling and no appointment management system",
         "root_cause_ar": "ضعف جدولة الكوادر الطبية وغياب نظام إدارة المواعيد",
         "root_cause_type": "process_failure", "entity": "MOH",
         "severity": "high", "confidence_score": 0.87},
        {"title": "Digital Portal Failures",
         "title_ar": "أعطال البوابة الإلكترونية",
         "root_cause": "Outdated portal infrastructure with no redundancy or failover system",
         "root_cause_ar": "بنية تحتية قديمة للبوابة الإلكترونية دون نسخ احتياطي",
         "root_cause_type": "infrastructure_deficit", "entity": "CSPD",
         "severity": "high", "confidence_score": 0.88},
        {"title": "Job Application Misrouting",
         "title_ar": "طلبات التوظيف في القناة الخطأ",
         "root_cause": "No clear channel guidance for citizens — complaints platform used for job applications",
         "root_cause_ar": "غياب التوجيه الواضح للمواطنين حول القنوات الصحيحة لكل طلب",
         "root_cause_type": "communication_breakdown", "entity": "MOL",
         "severity": "medium", "confidence_score": 0.94},
        {"title": "Document Processing Delays",
         "title_ar": "تأخر معالجة الوثائق الرسمية",
         "root_cause": "Manual processing workflow with no digital tracking or escalation rules",
         "root_cause_ar": "معالجة يدوية للوثائق دون تتبع رقمي أو قواعد تصعيد",
         "root_cause_type": "process_failure", "entity": "CSPD",
         "severity": "high", "confidence_score": 0.85},
        {"title": "Call Center Unresponsiveness",
         "title_ar": "عدم استجابة مركز الاتصال",
         "root_cause": "Understaffed call center with no callback system or queue management",
         "root_cause_ar": "نقص كوادر مركز الاتصال وغياب نظام إدارة قوائم الانتظار",
         "root_cause_type": "staff_capacity", "entity": "GAM",
         "severity": "high", "confidence_score": 0.82},
        {"title": "School Enrollment Issues",
         "title_ar": "مشاكل التسجيل المدرسي",
         "root_cause": "Enrollment system not integrated with civil registration data",
         "root_cause_ar": "عدم تكامل نظام التسجيل مع بيانات الأحوال المدنية",
         "root_cause_type": "infrastructure_deficit", "entity": "MOE",
         "severity": "medium", "confidence_score": 0.79},
        {"title": "Fee Payment Failures",
         "title_ar": "فشل عمليات دفع الرسوم",
         "root_cause": "Payment gateway instability and lack of alternative payment methods",
         "root_cause_ar": "عدم استقرار بوابة الدفع وغياب وسائل دفع بديلة",
         "root_cause_type": "infrastructure_deficit", "entity": "CSPD",
         "severity": "high", "confidence_score": 0.86},
        {"title": "Staff Behavior Complaints",
         "title_ar": "شكاوى سلوك الموظفين",
         "root_cause": "Lack of citizen service training and no performance accountability system",
         "root_cause_ar": "غياب تدريب خدمة المواطن وضعف منظومة المساءلة",
         "root_cause_type": "staff_capacity", "entity": "MOH",
         "severity": "medium", "confidence_score": 0.77},
        {"title": "License Renewal Delays",
         "title_ar": "تأخر تجديد التراخيص المهنية",
         "root_cause": "Multi-department approval dependency with no unified tracking system",
         "root_cause_ar": "اعتماد التجديد على موافقات متعددة الجهات دون نظام تتبع موحد",
         "root_cause_type": "process_failure", "entity": "MOL",
         "severity": "high", "confidence_score": 0.83},
        {"title": "Waste Collection Complaints",
         "title_ar": "شكاوى جمع النفايات",
         "root_cause": "Irregular collection schedules and no citizen reporting mechanism",
         "root_cause_ar": "عدم انتظام جداول جمع النفايات وغياب آلية إبلاغ المواطنين",
         "root_cause_type": "process_failure", "entity": "GAM",
         "severity": "medium", "confidence_score": 0.81},
        {"title": "Social Benefits Delays",
         "title_ar": "تأخر صرف المساعدات الاجتماعية",
         "root_cause": "Manual verification process with no integration to national database",
         "root_cause_ar": "عملية تحقق يدوية دون تكامل مع قاعدة البيانات الوطنية",
         "root_cause_type": "process_failure", "entity": "MOH",
         "severity": "critical", "confidence_score": 0.89},
        {"title": "Parking Fine Disputes",
         "title_ar": "اعتراضات مخالفات الوقوف",
         "root_cause": "No online dispute resolution channel — only in-person processing available",
         "root_cause_ar": "غياب قناة إلكترونية للاعتراض على المخالفات",
         "root_cause_type": "communication_breakdown", "entity": "GAM",
         "severity": "medium", "confidence_score": 0.76},
        {"title": "Health Insurance Coverage Gaps",
         "title_ar": "ثغرات التغطية التأمينية الصحية",
         "root_cause": "Policy gaps in coverage definitions not communicated to citizens",
         "root_cause_ar": "ثغرات في سياسة التغطية لم يتم إيصالها للمواطنين بوضوح",
         "root_cause_type": "policy_gap", "entity": "MOH",
         "severity": "high", "confidence_score": 0.84},
        {"title": "Building Permit Delays",
         "title_ar": "تأخر تراخيص البناء",
         "root_cause": "Sequential approval process between departments causing bottlenecks",
         "root_cause_ar": "عملية موافقة تسلسلية بين الأقسام تسبب اختناقات إدارية",
         "root_cause_type": "process_failure", "entity": "GAM",
         "severity": "high", "confidence_score": 0.80},
        {"title": "Passport Renewal Backlogs",
         "title_ar": "تراكم طلبات تجديد جوازات السفر",
         "root_cause": "Seasonal demand spikes not anticipated in staffing or appointment planning",
         "root_cause_ar": "عدم التخطيط للطلب الموسمي المرتفع في جدولة الكوادر والمواعيد",
         "root_cause_type": "process_failure", "entity": "CSPD",
         "severity": "high", "confidence_score": 0.87},
        {"title": "Teacher Shortage Complaints",
         "title_ar": "شكاوى نقص المعلمين",
         "root_cause": "Hiring freeze combined with retirement wave not addressed in workforce plan",
         "root_cause_ar": "تجميد التوظيف مع موجة تقاعد لم تُعالج في خطة القوى العاملة",
         "root_cause_type": "policy_gap", "entity": "MOE",
         "severity": "critical", "confidence_score": 0.92},
        {"title": "Water Supply Interruptions",
         "title_ar": "انقطاع إمدادات المياه",
         "root_cause": "Aging pipe infrastructure with no predictive maintenance program",
         "root_cause_ar": "بنية تحتية لأنابيب قديمة دون برنامج صيانة استباقية",
         "root_cause_type": "infrastructure_deficit", "entity": "GAM",
         "severity": "critical", "confidence_score": 0.90},
        {"title": "Meta Complaints About Platform",
         "title_ar": "شكاوى من المنصة ذاتها",
         "root_cause": "Complaints closed without resolution or citizen notification",
         "root_cause_ar": "إغلاق الشكاوى دون حل أو إخطار المواطن",
         "root_cause_type": "process_failure", "entity": "MOH",
         "severity": "high", "confidence_score": 0.95},
        {"title": "Road Maintenance Complaints",
         "title_ar": "شكاوى صيانة الطرق",
         "root_cause": "No proactive road condition monitoring — only reactive repairs",
         "root_cause_ar": "غياب مراقبة استباقية لحالة الطرق والاعتماد على الإصلاح التفاعلي",
         "root_cause_type": "process_failure", "entity": "GAM",
         "severity": "medium", "confidence_score": 0.78},
    ]

    cluster_objs = []
    for cd in clusters_data:
        c = Cluster(
            id=uuid.uuid4(),
            title=cd["title"],
            title_ar=cd["title_ar"],
            root_cause=cd["root_cause"],
            root_cause_ar=cd["root_cause_ar"],
            root_cause_type=cd["root_cause_type"],
            entity=cd["entity"],
            severity=cd["severity"],
            confidence_score=cd["confidence_score"],
            size=0,
            status="active",
            created_at=datetime(2026, 1, 1),
        )
        db.add(c)
        cluster_objs.append(c)

    db.flush()
    cluster_ids = [c.id for c in cluster_objs]

    # ── Step 2: Complaints ───────────────────────────────────────────────
    entity_counts = {
        "MOH": 525, "GAM": 375, "CSPD": 300, "MOL": 180, "MOE": 120,
    }

    for entity, count in entity_counts.items():
        entity_templates = TEMPLATES[entity]
        for _ in range(count):
            archetype = _pick_archetype(entity)
            pool = entity_templates.get(archetype, entity_templates.get("objective"))
            text = _fill(random.choice(pool))

            sentiment = ARCHETYPE_SENTIMENT.get(archetype, "negative")
            urgency = URGENCY_MAP.get((entity, archetype), "medium")
            source = random.choices(SOURCES, weights=SOURCE_WEIGHTS, k=1)[0]
            status = random.choices(STATUSES, weights=STATUS_WEIGHTS, k=1)[0]
            cluster_id = _pick_cluster_id(entity, archetype, cluster_ids)
            created_at = _random_q1_2026_dt()
            category = ENTITY_CATEGORY.get(entity, {}).get(archetype, "general")

            if archetype in ("emotional", "angry") and random.random() < 0.3:
                submitted_hour = random.choice([22, 23, 0, 1, 2])
            else:
                submitted_hour = random.randint(8, 17)

            db.add(Complaint(
                id=uuid.uuid4(),
                text=text,
                source=source,
                entity=entity,
                governorate=random.choice(GOVERNORATES),
                category=category,
                sentiment=sentiment,
                urgency=urgency,
                status=status,
                archetype=archetype,
                submitted_hour=submitted_hour,
                created_at=created_at,
                cluster_id=cluster_id,
            ))

    db.flush()

    # Back-fill cluster sizes
    for c_obj in cluster_objs:
        c_obj.size = db.query(Complaint).filter(Complaint.cluster_id == c_obj.id).count()
    db.flush()

    # ── Step 3: KPIs ────────────────────────────────────────────────────
    kpi_baseline = {
        "MOH":  {"total": 175, "open_rate": 0.35, "avg_response": 71.0,
                 "sla": 0.94, "csat": 3.2, "nps": -15.0, "cxi": 58.0},
        "GAM":  {"total": 125, "open_rate": 0.25, "avg_response": 48.0,
                 "sla": 0.97, "csat": 3.5, "nps":   5.0, "cxi": 63.0},
        "CSPD": {"total": 100, "open_rate": 0.15, "avg_response": 24.0,
                 "sla": 0.99, "csat": 3.8, "nps":  20.0, "cxi": 71.0},
        "MOL":  {"total":  60, "open_rate": 0.40, "avg_response": 96.0,
                 "sla": 0.91, "csat": 3.0, "nps": -25.0, "cxi": 55.0},
        "MOE":  {"total":  40, "open_rate": 0.20, "avg_response": 36.0,
                 "sla": 0.96, "csat": 3.6, "nps":  10.0, "cxi": 67.0},
    }

    for entity, base in kpi_baseline.items():
        for month in range(1, 4):
            var = 1 + random.uniform(-0.05, 0.05)
            if entity == "MOH" and month == 2:
                var *= 1.08          # Feb medication peak
            total = int(base["total"] * var)
            open_cnt = int(total * base["open_rate"])
            resolved_cnt = int(total * (1 - base["open_rate"]) * 0.8)
            db.add(KPI(
                id=uuid.uuid4(),
                entity=entity,
                period_label=f"2026-{month:02d}",
                period_month=month,
                period_year=2026,
                total_complaints=total,
                open_complaints=open_cnt,
                resolved_complaints=resolved_cnt,
                avg_response_time_hours=round(base["avg_response"] * var, 1),
                sla_compliance_rate=round(min(1.0, base["sla"] * var), 4),
                csat_score=round(base["csat"] * var, 2),
                nps_score=round(base["nps"] * var, 1),
                ces_score=round(random.uniform(3.0, 4.5), 2),
                sentiment_score=round(random.uniform(0.35, 0.65), 2),
                cxi_score=round(base["cxi"] * var, 1),
                calculated_at=datetime(2026, month, 28),
            ))

    db.flush()

    # ── Step 4: Actions ──────────────────────────────────────────────────
    actions_data = [
        {"title": "Proactive Medication Refill Alert T-7",
         "title_ar": "نظام التنبيه الاستباقي لإعادة تعبئة الدواء",
         "description": "Automated alert system notifying health centers 7 days before medication stockout",
         "description_ar": "نظام تنبيه آلي يُخطر المراكز الصحية قبل 7 أيام من نفاد الأدوية",
         "owner": "وزارة الصحة - إدارة الصيدلة", "priority": "gold", "status": "approved",
         "expected_impact_percent": 45.0, "implementation_days": 60, "cluster_idx": 0},
        {"title": "Real-time Inventory Dashboard",
         "title_ar": "لوحة قيادة المخزون اللحظية",
         "description": "Live dashboard showing medication stock levels across all health centers",
         "description_ar": "لوحة تحكم حية تعرض مستويات مخزون الأدوية في جميع المراكز الصحية",
         "owner": "وزارة الصحة - تقنية المعلومات", "priority": "gold", "status": "in_progress",
         "expected_impact_percent": 30.0, "implementation_days": 120, "cluster_idx": 0},
        {"title": "Smart Appointment Scheduling",
         "title_ar": "نظام الجدولة الذكية للمواعيد",
         "description": "AI-powered appointment system reducing waiting times by 60%",
         "description_ar": "نظام مواعيد مدعوم بالذكاء الاصطناعي يقلل أوقات الانتظار بنسبة 60%",
         "owner": "وزارة الصحة - الخدمات الطبية", "priority": "gold", "status": "proposed",
         "expected_impact_percent": 35.0, "implementation_days": 45, "cluster_idx": 1},
        {"title": "Digital Portal Redundancy System",
         "title_ar": "نظام النسخ الاحتياطي للبوابة الإلكترونية",
         "description": "Failover infrastructure ensuring 99.9% portal uptime",
         "description_ar": "بنية تحتية احتياطية تضمن توافر البوابة بنسبة 99.9%",
         "owner": "دائرة الأحوال المدنية - تقنية المعلومات", "priority": "gold", "status": "in_progress",
         "expected_impact_percent": 55.0, "implementation_days": 90, "cluster_idx": 2},
        {"title": "Citizen Channel Guidance Campaign",
         "title_ar": "حملة توعية قنوات الخدمة",
         "description": "National awareness campaign directing citizens to correct service channels",
         "description_ar": "حملة توعية وطنية لتوجيه المواطنين نحو القنوات الصحيحة لكل طلب",
         "owner": "وزارة العمل - التواصل المؤسسي", "priority": "quick_win", "status": "approved",
         "expected_impact_percent": 40.0, "implementation_days": 14, "cluster_idx": 3},
        {"title": "Call Center Workforce Expansion",
         "title_ar": "توسيع كوادر مركز الاتصال",
         "description": "Hire 50 additional call center agents and implement callback system",
         "description_ar": "توظيف 50 موظف إضافي وتطبيق نظام الاتصال العكسي",
         "owner": "أمانة عمان الكبرى - خدمة المواطن", "priority": "silver", "status": "proposed",
         "expected_impact_percent": 38.0, "implementation_days": 60, "cluster_idx": 5},
        {"title": "Passport Express Lane for Seniors",
         "title_ar": "مسار سريع لجوازات السفر لكبار السن",
         "description": "Dedicated fast-track service for citizens above 60 and special needs",
         "description_ar": "خدمة مسار سريع مخصص لكبار السن وذوي الاحتياجات الخاصة",
         "owner": "دائرة الأحوال المدنية - الخدمات", "priority": "quick_win", "status": "completed",
         "expected_impact_percent": 20.0, "implementation_days": 7, "cluster_idx": 15},
        {"title": "Teacher Emergency Hiring Program",
         "title_ar": "برنامج التوظيف الطارئ للمعلمين",
         "description": "Emergency hiring of 2000 teachers to address critical shortage",
         "description_ar": "توظيف طارئ لـ 2000 معلم لمعالجة النقص الحرج",
         "owner": "وزارة التربية والتعليم - الموارد البشرية", "priority": "gold", "status": "in_progress",
         "expected_impact_percent": 60.0, "implementation_days": 90, "cluster_idx": 16},
        {"title": "Online Dispute Resolution Portal",
         "title_ar": "بوابة تسوية النزاعات الإلكترونية",
         "description": "Digital platform for contesting fines and decisions without in-person visits",
         "description_ar": "منصة رقمية للاعتراض على الغرامات والقرارات دون زيارة شخصية",
         "owner": "أمانة عمان الكبرى - الخدمات الرقمية", "priority": "silver", "status": "proposed",
         "expected_impact_percent": 42.0, "implementation_days": 75, "cluster_idx": 12},
        {"title": "Predictive Road Maintenance System",
         "title_ar": "نظام الصيانة الاستباقية للطرق",
         "description": "IoT sensors and AI to predict road deterioration before citizen complaints",
         "description_ar": "مستشعرات إنترنت الأشياء والذكاء الاصطناعي للتنبؤ بتدهور الطرق",
         "owner": "أمانة عمان الكبرى - البنية التحتية", "priority": "silver", "status": "proposed",
         "expected_impact_percent": 35.0, "implementation_days": 180, "cluster_idx": 19},
    ]

    for ad in actions_data:
        db.add(Action(
            id=uuid.uuid4(),
            title=ad["title"],
            title_ar=ad["title_ar"],
            description=ad["description"],
            description_ar=ad["description_ar"],
            cluster_id=cluster_ids[ad["cluster_idx"]],
            owner=ad["owner"],
            status=ad["status"],
            priority=ad["priority"],
            expected_impact_percent=ad["expected_impact_percent"],
            implementation_days=ad["implementation_days"],
            due_date=None,
            created_at=datetime(2026, 1, 15),
        ))

    db.flush()

    # ── Step 5: Simulations ──────────────────────────────────────────────
    simulations_data = [
        {"name": "Demand Overload — Ramadan Peak",
         "scenario_type": "demand_overload",
         "description": "Simulates 40% spike in complaints during Ramadan due to service center overcrowding",
         "affected_entities": ["MOH", "CSPD", "GAM"],
         "kpi_effects": {"complaint_spike_percent": 40, "sla_drop_percent": 15, "cxi_drop": 8},
         "status": "inactive"},
        {"name": "Digital Portal Cascade Failure",
         "scenario_type": "digital_channel_failure",
         "description": "CSPD portal fails, citizens flood call centers, call center blamed but root cause is portal",
         "affected_entities": ["CSPD", "GAM"],
         "kpi_effects": {"portal_complaints_spike": 180, "callcenter_complaints_spike": 120,
                         "real_cause": "portal_infrastructure",
                         "misleading_symptom": "call_center_performance"},
         "status": "inactive"},
        {"name": "Wicked Problem — Health System Cascade",
         "scenario_type": "wicked_problem",
         "description": "Medication shortage causes patients to overload emergency rooms. ER complaints rise. System initially blames ER staff. Real cause is pharmacy supply chain failure.",
         "affected_entities": ["MOH"],
         "kpi_effects": {"er_complaints_spike": 95, "pharmacy_complaints_spike": 60,
                         "real_cause": "pharmacy_supply_chain",
                         "misleading_symptom": "er_staff_performance",
                         "cascade_delay_hours": 48},
         "status": "inactive"},
    ]

    for sd in simulations_data:
        db.add(Simulation(
            id=uuid.uuid4(),
            name=sd["name"],
            scenario_type=sd["scenario_type"],
            description=sd["description"],
            status=sd["status"],
            affected_entities=sd["affected_entities"],
            kpi_effects=sd["kpi_effects"],
            triggered_at=None,
            ended_at=None,
            created_at=datetime(2026, 1, 1),
        ))

    db.flush()

    # ── Step 6: Advanced signals ─────────────────────────────────────────
    signals_data = [
        {"source_id": "vision_queue_engine_001", "signal_type": "queue_stress",
         "entity": "MOH", "service_id": "patient_registration",
         "channel_id": "physical_service_center", "governorate": "إربد",
         "signal_value": 87.0, "interpretation": "high_queue_stress",
         "confidence": 0.82, "severity": "high",
         "supporting_data": {"estimated_queue_length": 64, "avg_waiting_minutes": 48}},
        {"source_id": "audio_escalation_engine_002", "signal_type": "interaction_escalation",
         "entity": "GAM", "service_id": "municipal_complaints",
         "channel_id": "call_center", "governorate": "عمّان",
         "signal_value": 72.0, "interpretation": "elevated_frustration",
         "confidence": 0.76, "severity": "medium_high",
         "supporting_data": {"tone_escalation_count": 18, "avg_call_duration_change": "+34%"}},
        {"source_id": "mobility_signal_engine_003", "signal_type": "access_congestion",
         "entity": "CSPD", "service_id": "passport_services",
         "channel_id": "physical_service_center", "governorate": "عمّان",
         "signal_value": 91.0, "interpretation": "severe_access_congestion",
         "confidence": 0.88, "severity": "critical",
         "supporting_data": {"estimated_delay_minutes": 37, "arrival_rate_drop": "22%"}},
    ]

    for sig in signals_data:
        db.add(AdvancedSignal(
            id=uuid.uuid4(),
            source_id=sig["source_id"],
            signal_type=sig["signal_type"],
            entity=sig["entity"],
            service_id=sig["service_id"],
            channel_id=sig["channel_id"],
            governorate=sig["governorate"],
            signal_value=sig["signal_value"],
            interpretation=sig["interpretation"],
            confidence=sig["confidence"],
            severity=sig["severity"],
            supporting_data=sig["supporting_data"],
            is_simulation=False,
            created_at=datetime(2026, 3, 15),
        ))

    db.commit()

    return {
        "clusters": 20,
        "complaints": 1500,
        "kpis": 15,
        "actions": 10,
        "simulations": 3,
        "signals": 3,
    }
