from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from concurrent.futures import ThreadPoolExecutor
from uuid import UUID
import uuid as uuid_module
import os
from datetime import datetime
from dotenv import load_dotenv
from database import init_db, get_db, SessionLocal
from data_generator import generate_all_data
from models import Complaint, Cluster, KPI, Action, Simulation, AdvancedSignal, User
from ai_engine import process_complaint as ai_process
from auth import (
    verify_password, hash_password, create_access_token,
    get_current_user, get_current_user_optional, require_admin,
)

load_dotenv()

executor = ThreadPoolExecutor(max_workers=2)


def run_ai_processing(complaint_id: str):
    db = SessionLocal()
    try:
        ai_process(complaint_id, db)
    except Exception as e:
        print(f"AI processing error: {e}")
    finally:
        db.close()


app = FastAPI(title="Voice of Citizen 360", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _seed_default_admin():
    """Create a default admin account if none exists."""
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.role == "admin").first()
        if not existing:
            admin = User(
                id=uuid_module.uuid4(),
                email="admin@voc360.jo",
                username="admin",
                name="مدير النظام",
                password_hash=hash_password("Admin@2026"),
                role="admin",
                is_active=True,
            )
            db.add(admin)
            db.commit()
            print("[startup] Default admin created: admin@voc360.jo / Admin@2026")
    except Exception as e:
        print(f"[startup] Admin seed error: {e}")
    finally:
        db.close()


@app.on_event("startup")
def on_startup():
    init_db()
    _seed_default_admin()


@app.get("/")
def root():
    return {"message": "Voice of Citizen 360 API is running"}


@app.get("/health")
def health():
    return {"status": "ok", "database": "connected", "ai_model": "gemma4:31b"}


@app.post("/api/seed")
def seed(db: Session = Depends(get_db)):
    result = generate_all_data(db)
    return result


# ── Dashboard ─────────────────────────────────────────────────────────────────

MONTH_NAMES = {1: "يناير 2026", 2: "فبراير 2026", 3: "مارس 2026"}


@app.get("/api/dashboard/national")
def dashboard_national(db: Session = Depends(get_db)):
    total = db.query(func.count(Complaint.id)).scalar() or 0
    open_cnt = db.query(func.count(Complaint.id)).filter(Complaint.status == "open").scalar() or 0
    in_prog = db.query(func.count(Complaint.id)).filter(Complaint.status == "in_progress").scalar() or 0
    resolved = db.query(func.count(Complaint.id)).filter(Complaint.status == "resolved").scalar() or 0

    # Latest month = max period_month in kpis
    latest_month = db.query(func.max(KPI.period_month)).scalar() or 3
    latest_kpis = db.query(KPI).filter(KPI.period_month == latest_month).all()

    avg_response = (
        sum(k.avg_response_time_hours for k in latest_kpis) / len(latest_kpis)
        if latest_kpis else 0.0
    )
    avg_sla = (
        sum(k.sla_compliance_rate for k in latest_kpis) / len(latest_kpis) * 100
        if latest_kpis else 0.0
    )
    national_cxi = (
        sum(k.cxi_score for k in latest_kpis) / len(latest_kpis)
        if latest_kpis else 0.0
    )
    cxi_breakdown = {k.entity: round(k.cxi_score, 1) for k in latest_kpis}

    # Monthly trend from kpis grouped by period_month
    monthly_rows = (
        db.query(
            KPI.period_month,
            func.sum(KPI.total_complaints).label("total"),
            func.sum(KPI.open_complaints).label("open"),
            func.sum(KPI.resolved_complaints).label("resolved"),
        )
        .group_by(KPI.period_month)
        .order_by(KPI.period_month)
        .all()
    )
    monthly_trend = [
        {
            "month": MONTH_NAMES.get(r.period_month, str(r.period_month)),
            "period_month": r.period_month,
            "total": r.total or 0,
            "open": r.open or 0,
            "resolved": r.resolved or 0,
        }
        for r in monthly_rows
    ]

    # Category distribution — top 8
    cat_rows = (
        db.query(Complaint.category, func.count(Complaint.id).label("cnt"))
        .group_by(Complaint.category)
        .order_by(desc("cnt"))
        .limit(8)
        .all()
    )
    cat_total = sum(r.cnt for r in cat_rows) or 1
    category_distribution = [
        {"category": r.category, "count": r.cnt, "percentage": round(r.cnt / cat_total * 100, 1)}
        for r in cat_rows
    ]

    # Source distribution
    src_rows = (
        db.query(Complaint.source, func.count(Complaint.id).label("cnt"))
        .group_by(Complaint.source)
        .order_by(desc("cnt"))
        .all()
    )
    src_total = sum(r.cnt for r in src_rows) or 1
    source_distribution = [
        {"source": r.source, "count": r.cnt, "percentage": round(r.cnt / src_total * 100, 1)}
        for r in src_rows
    ]

    return {
        "total_complaints": total,
        "open_complaints": open_cnt,
        "in_progress_complaints": in_prog,
        "resolved_complaints": resolved,
        "avg_response_time_hours": round(avg_response, 1),
        "sla_compliance_rate": round(avg_sla, 2),
        "national_cxi": round(national_cxi, 1),
        "cxi_breakdown": cxi_breakdown,
        "monthly_trend": monthly_trend,
        "category_distribution": category_distribution,
        "source_distribution": source_distribution,
        "open_rate_percent": round(open_cnt / total * 100, 1) if total else 0.0,
        "complaint_rate_per_month": round(total / 3, 1),
    }


# ── Clusters ──────────────────────────────────────────────────────────────────

@app.get("/api/clusters")
def get_clusters(db: Session = Depends(get_db)):
    clusters = db.query(Cluster).order_by(desc(Cluster.size)).all()
    result = []
    for c in clusters:
        open_count = (
            db.query(func.count(Complaint.id))
            .filter(Complaint.cluster_id == c.id, Complaint.status == "open")
            .scalar() or 0
        )
        result.append({
            "id": str(c.id),
            "title": c.title,
            "title_ar": c.title_ar,
            "size": c.size,
            "root_cause": c.root_cause,
            "root_cause_ar": c.root_cause_ar,
            "root_cause_type": c.root_cause_type,
            "confidence_score": c.confidence_score,
            "entity": c.entity,
            "severity": c.severity,
            "status": c.status,
            "open_count": open_count,
            "open_rate": round(open_count / c.size * 100, 1) if c.size > 0 else 0.0,
        })
    return result


# ── Actions ───────────────────────────────────────────────────────────────────

@app.get("/api/actions")
def get_actions(db: Session = Depends(get_db)):
    actions = db.query(Action).order_by(Action.priority, Action.status).all()
    return [
        {
            "id": str(a.id),
            "title": a.title,
            "title_ar": a.title_ar,
            "description": a.description,
            "description_ar": a.description_ar,
            "owner": a.owner,
            "status": a.status,
            "priority": a.priority,
            "expected_impact_percent": a.expected_impact_percent,
            "implementation_days": a.implementation_days,
            "cluster_id": str(a.cluster_id) if a.cluster_id else None,
        }
        for a in actions
    ]


# ── KPIs per entity ───────────────────────────────────────────────────────────

VALID_ENTITIES = {"MOH", "GAM", "CSPD", "MOL", "MOE"}


@app.get("/api/kpis/{entity}")
def get_kpis_by_entity(entity: str, db: Session = Depends(get_db)):
    if entity not in VALID_ENTITIES:
        raise HTTPException(status_code=404, detail=f"Entity '{entity}' not found")
    kpis = (
        db.query(KPI)
        .filter(KPI.entity == entity)
        .order_by(KPI.period_month)
        .all()
    )
    return [
        {
            "entity": k.entity,
            "period_label": k.period_label,
            "period_month": k.period_month,
            "total_complaints": k.total_complaints,
            "open_complaints": k.open_complaints,
            "resolved_complaints": k.resolved_complaints,
            "avg_response_time_hours": k.avg_response_time_hours,
            "sla_compliance_rate": k.sla_compliance_rate,
            "csat_score": k.csat_score,
            "nps_score": k.nps_score,
            "cxi_score": k.cxi_score,
        }
        for k in kpis
    ]


# ── Simulations ───────────────────────────────────────────────────────────────

@app.get("/api/simulations")
def get_simulations(db: Session = Depends(get_db)):
    sims = db.query(Simulation).all()
    return [
        {
            "id": str(s.id),
            "name": s.name,
            "scenario_type": s.scenario_type,
            "description": s.description,
            "status": s.status,
            "affected_entities": s.affected_entities,
            "kpi_effects": s.kpi_effects,
            "triggered_at": s.triggered_at.isoformat() if s.triggered_at else None,
        }
        for s in sims
    ]


@app.post("/api/simulations/{sim_id}/trigger")
def trigger_simulation(sim_id: str, db: Session = Depends(get_db)):
    sim = db.query(Simulation).filter(Simulation.id == sim_id).first()
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    sim.status = "running"
    sim.triggered_at = datetime.utcnow()
    db.commit()
    return {"message": "Simulation triggered", "simulation_id": sim_id, "status": "running"}


@app.post("/api/simulations/{sim_id}/reset")
def reset_simulation(sim_id: str, db: Session = Depends(get_db)):
    sim = db.query(Simulation).filter(Simulation.id == sim_id).first()
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    sim.status = "inactive"
    sim.triggered_at = None
    sim.ended_at = None
    db.commit()
    return {"message": "Simulation reset", "simulation_id": sim_id, "status": "inactive"}


# ── Advanced signals ──────────────────────────────────────────────────────────

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium_high": 2, "medium": 3, "low": 4}


@app.get("/api/signals")
def get_signals(db: Session = Depends(get_db)):
    signals = db.query(AdvancedSignal).order_by(desc(AdvancedSignal.signal_value)).all()
    signals.sort(key=lambda s: SEVERITY_ORDER.get(s.severity, 99))
    return [
        {
            "id": str(s.id),
            "source_id": s.source_id,
            "signal_type": s.signal_type,
            "entity": s.entity,
            "governorate": s.governorate,
            "signal_value": s.signal_value,
            "interpretation": s.interpretation,
            "confidence": s.confidence,
            "severity": s.severity,
            "supporting_data": s.supporting_data,
            "created_at": s.created_at.isoformat(),
        }
        for s in signals
    ]


# ── Complaint submission ──────────────────────────────────────────────────────

# ── Auth schemas ─────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    name: str
    email: str
    username: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/api/auth/signup")
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="البريد الإلكتروني مسجّل مسبقاً")
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="اسم المستخدم محجوز مسبقاً")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="كلمة المرور يجب أن تكون 6 أحرف على الأقل")
    user = User(
        id=uuid_module.uuid4(),
        email=body.email.lower().strip(),
        username=body.username.strip(),
        name=body.name.strip(),
        password_hash=hash_password(body.password),
        role="user",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id), user.role, user.name, user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": str(user.id), "name": user.name, "email": user.email, "role": user.role},
    }


@app.post("/api/auth/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower().strip()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="البريد الإلكتروني أو كلمة المرور غير صحيحة")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="الحساب معطّل")
    token = create_access_token(str(user.id), user.role, user.name, user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": str(user.id), "name": user.name, "email": user.email, "role": user.role},
    }


@app.get("/api/auth/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "name": current_user.name,
        "email": current_user.email,
        "username": current_user.username,
        "role": current_user.role,
    }


@app.get("/api/admin/users")
def list_users(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {"id": str(u.id), "name": u.name, "email": u.email,
         "username": u.username, "role": u.role, "is_active": u.is_active,
         "created_at": u.created_at.isoformat()}
        for u in users
    ]


# ── Complaint submission ──────────────────────────────────────────────────────

class ComplaintSubmission(BaseModel):
    text: str
    entity: str = "MOH"
    source: str = "bekhedmetkom"
    governorate: str = "\u0639\u0645\u0651\u0627\u0646"
    name: Optional[str] = "\u0645\u0648\u0627\u0637\u0646"
    phone: Optional[str] = None
    language: str = "ar"


@app.post("/api/complaints/submit")
def submit_complaint(body: ComplaintSubmission, db: Session = Depends(get_db)):
    if not body.text or len(body.text.strip()) < 3:
        raise HTTPException(
            status_code=400,
            detail="\u0646\u0635 \u0627\u0644\u0634\u0643\u0648\u0649 \u0645\u0637\u0644\u0648\u0628 \u0648\u064a\u062c\u0628 \u0623\u0646 \u064a\u0643\u0648\u0646 \u0623\u0643\u062b\u0631 \u0645\u0646 3 \u0623\u062d\u0631\u0641",
        )

    new_complaint = Complaint(
        id=uuid_module.uuid4(),
        text=body.text.strip(),
        source=body.source,
        governorate=body.governorate,
        status="open",
        category="pending",
        sentiment="neutral",
        urgency="medium",
        archetype="objective",
        entity=body.entity,
        submitted_hour=datetime.utcnow().hour,
        created_at=datetime.utcnow(),
    )

    db.add(new_complaint)
    db.commit()
    db.refresh(new_complaint)

    complaint_id = str(new_complaint.id)
    executor.submit(run_ai_processing, complaint_id)

    tracking = "VOC-" + complaint_id[:8].upper()

    return {
        "success": True,
        "complaint_id": complaint_id,
        "tracking_number": tracking,
        "message": "\u062a\u0645 \u0627\u0633\u062a\u0644\u0627\u0645 \u0634\u0643\u0648\u0627\u0643 \u0628\u0646\u062c\u0627\u062d. \u0633\u064a\u062a\u0645 \u0645\u0639\u0627\u0644\u062c\u062a\u0647\u0627 \u0628\u0648\u0627\u0633\u0637\u0629 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a \u062e\u0644\u0627\u0644 \u062f\u0642\u064a\u0642\u062a\u064a\u0646.",
        "message_en": "Your complaint has been received successfully. AI will process it within 2 minutes.",
        "estimated_processing_minutes": 2,
    }


@app.get("/api/complaints/track/{tracking_id}")
def track_complaint(tracking_id: str, db: Session = Depends(get_db)):
    clean_id = tracking_id.replace("VOC-", "").lower()

    complaints = db.query(Complaint).all()
    complaint = None
    for c in complaints:
        if str(c.id).startswith(clean_id) or str(c.id) == clean_id:
            complaint = c
            break

    if not complaint:
        raise HTTPException(
            status_code=404,
            detail="\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0634\u0643\u0648\u0649",
        )

    entity_map = {
        "MOH": "\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u0635\u062d\u0629",
        "GAM": "\u0623\u0645\u0627\u0646\u0629 \u0639\u0645\u0627\u0646 \u0627\u0644\u0643\u0628\u0631\u0649",
        "CSPD": "\u062f\u0627\u0626\u0631\u0629 \u0627\u0644\u0623\u062d\u0648\u0627\u0644 \u0627\u0644\u0645\u062f\u0646\u064a\u0629",
        "MOL": "\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u0639\u0645\u0644",
        "MOE": "\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u062a\u0631\u0628\u064a\u0629 \u0648\u0627\u0644\u062a\u0639\u0644\u064a\u0645",
    }
    status_map = {
        "open": "\u0645\u0641\u062a\u0648\u062d\u0629",
        "in_progress": "\u0642\u064a\u062f \u0627\u0644\u0645\u0639\u0627\u0644\u062c\u0629",
        "resolved": "\u0645\u062d\u0644\u0648\u0644\u0629",
    }

    text_preview = (
        complaint.text[:100] + "..." if len(complaint.text) > 100 else complaint.text
    )

    return {
        "complaint_id": str(complaint.id),
        "tracking_number": "VOC-" + str(complaint.id)[:8].upper(),
        "status": complaint.status,
        "status_ar": status_map.get(complaint.status, complaint.status),
        "category": complaint.category,
        "sentiment": complaint.sentiment,
        "urgency": complaint.urgency,
        "entity": complaint.entity,
        "entity_ar": entity_map.get(complaint.entity, complaint.entity),
        "cluster_id": str(complaint.cluster_id) if complaint.cluster_id else None,
        "submitted_at": complaint.created_at.isoformat(),
        "processed_by_ai": complaint.category != "pending",
        "text_preview": text_preview,
    }


@app.get("/api/complaints/recent")
def recent_complaints(db: Session = Depends(get_db)):
    complaints = (
        db.query(Complaint)
        .order_by(Complaint.created_at.desc())
        .limit(20)
        .all()
    )

    result = []
    for c in complaints:
        text_preview = c.text[:80] + "..." if len(c.text) > 80 else c.text
        result.append(
            {
                "id": str(c.id),
                "tracking_number": "VOC-" + str(c.id)[:8].upper(),
                "text_preview": text_preview,
                "status": c.status,
                "category": c.category,
                "sentiment": c.sentiment,
                "urgency": c.urgency,
                "entity": c.entity,
                "governorate": c.governorate,
                "source": c.source,
                "submitted_at": c.created_at.isoformat() if c.created_at else None,
            }
        )

    return result
