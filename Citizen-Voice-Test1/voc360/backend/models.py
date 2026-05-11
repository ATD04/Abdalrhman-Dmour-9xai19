from sqlalchemy import Column, String, Integer, Float, Text, DateTime, JSON, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base
import uuid
from datetime import datetime


class Complaint(Base):
    __tablename__ = "complaints"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    text = Column(Text, nullable=False)
    source = Column(String(50))
    entity = Column(String(20))
    governorate = Column(String(50))
    category = Column(String(100))
    sentiment = Column(String(20))
    urgency = Column(String(20))
    status = Column(String(20), default="open")
    archetype = Column(String(50))
    submitted_hour = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    cluster_id = Column(UUID(as_uuid=True), ForeignKey("clusters.id"), nullable=True)


class Cluster(Base):
    __tablename__ = "clusters"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200))
    title_ar = Column(String(200))
    size = Column(Integer, default=0)
    root_cause = Column(Text)
    root_cause_ar = Column(Text)
    root_cause_type = Column(String(50))
    confidence_score = Column(Float, default=0.0)
    entity = Column(String(20))
    severity = Column(String(20))
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    complaints = relationship("Complaint", backref="cluster",
                              foreign_keys="Complaint.cluster_id")
    actions = relationship("Action", backref="cluster")


class KPI(Base):
    __tablename__ = "kpis"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity = Column(String(20))
    period_label = Column(String(20))
    period_month = Column(Integer)
    period_year = Column(Integer)
    total_complaints = Column(Integer, default=0)
    open_complaints = Column(Integer, default=0)
    resolved_complaints = Column(Integer, default=0)
    avg_response_time_hours = Column(Float, default=0.0)
    sla_compliance_rate = Column(Float, default=0.0)
    csat_score = Column(Float, default=0.0)
    nps_score = Column(Float, default=0.0)
    ces_score = Column(Float, default=0.0)
    sentiment_score = Column(Float, default=0.0)
    cxi_score = Column(Float, default=0.0)
    calculated_at = Column(DateTime, default=datetime.utcnow)


class Action(Base):
    __tablename__ = "actions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200))
    title_ar = Column(String(200))
    description = Column(Text)
    description_ar = Column(Text)
    cluster_id = Column(UUID(as_uuid=True), ForeignKey("clusters.id"))
    owner = Column(String(100))
    status = Column(String(30), default="proposed")
    priority = Column(String(20))
    expected_impact_percent = Column(Float)
    implementation_days = Column(Integer)
    due_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Simulation(Base):
    __tablename__ = "simulations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200))
    scenario_type = Column(String(50))
    description = Column(Text)
    status = Column(String(20), default="inactive")
    affected_entities = Column(JSON)
    kpi_effects = Column(JSON)
    triggered_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AdvancedSignal(Base):
    __tablename__ = "advanced_signals"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id = Column(String(100))
    signal_type = Column(String(50))
    entity = Column(String(20))
    service_id = Column(String(100))
    channel_id = Column(String(50))
    governorate = Column(String(50))
    signal_value = Column(Float)
    interpretation = Column(String(100))
    confidence = Column(Float)
    severity = Column(String(20))
    supporting_data = Column(JSON)
    is_simulation = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(200), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    password_hash = Column(String(200), nullable=False)
    role = Column(String(20), default="user")   # "admin" or "user"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
