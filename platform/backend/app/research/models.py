"""
SQLAlchemy models for the comparative EHR usability study.

Importing this module registers all tables with ``app.database.Base`` so that
``Base.metadata.create_all`` (called in ``main.py`` lifespan) provisions them.
"""
import enum
from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime,
    ForeignKey, Enum as SAEnum, JSON,
)
from sqlalchemy.orm import relationship

from app.database import Base


# ── Enums ──────────────────────────────────────────────────────────────────

class ParticipantRole(str, enum.Enum):
    physician = "physician"
    resident = "resident"
    nurse_practitioner = "nurse_practitioner"
    physician_assistant = "physician_assistant"
    registered_nurse = "registered_nurse"
    pharmacist = "pharmacist"
    other = "other"


class ConditionOrder(str, enum.Enum):
    """Counterbalancing assignment — which interface a participant sees first."""
    traditional_first = "traditional_first"
    relational_first = "relational_first"


class ParticipantStatus(str, enum.Enum):
    enrolled = "enrolled"
    in_progress = "in_progress"
    completed = "completed"
    withdrawn = "withdrawn"


class InterfaceArm(str, enum.Enum):
    traditional = "traditional"
    relational = "relational"


# ── Participant ─────────────────────────────────────────────────────────────

class ResearchParticipant(Base):
    __tablename__ = "research_participants"

    id = Column(Integer, primary_key=True, index=True)
    # Anonymized code shown to the participant (e.g. "P001").
    participant_code = Column(String, unique=True, index=True, nullable=False)

    # Identity / contact — used for return-login + study communications
    # (scheduling / compensation). Kept out of the analysis CSV export.
    full_name = Column(String, nullable=True)
    email = Column(String, index=True, nullable=True)

    # Demographics / background (collected post-consent)
    role = Column(SAEnum(ParticipantRole), nullable=True)
    specialty = Column(String, nullable=True)
    years_experience = Column(Float, nullable=True)
    primary_ehr = Column(String, nullable=True)
    ehr_hours_per_week = Column(Float, nullable=True)
    age_range = Column(String, nullable=True)

    # Forced-choice design preference from the exploration phase ('neon'|'generic')
    style_preference = Column(String, nullable=True)

    # Informed consent (IRB)
    consent_given = Column(Boolean, default=False, nullable=False)
    consent_signature = Column(String, nullable=True)   # typed full name
    consent_at = Column(DateTime, nullable=True)

    # Study design
    condition_order = Column(SAEnum(ConditionOrder), nullable=False)
    status = Column(SAEnum(ParticipantStatus), default=ParticipantStatus.enrolled, nullable=False)

    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    attempts = relationship(
        "TaskAttempt", back_populates="participant",
        cascade="all, delete-orphan",
    )
    events = relationship(
        "InteractionEvent", back_populates="participant",
        cascade="all, delete-orphan",
    )
    assessments = relationship(
        "WorkloadAssessment", back_populates="participant",
        cascade="all, delete-orphan",
    )
    responses = relationship(
        "QualitativeResponse", back_populates="participant",
        cascade="all, delete-orphan",
    )
    usability = relationship(
        "UsabilityAssessment", back_populates="participant",
        cascade="all, delete-orphan",
    )
    exploration = relationship(
        "ExplorationMetric", back_populates="participant",
        cascade="all, delete-orphan",
    )


# ── Quantitative: task performance ──────────────────────────────────────────

class TaskAttempt(Base):
    """One participant performing one task scenario under one interface arm."""
    __tablename__ = "research_task_attempts"

    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(ForeignKey("research_participants.id"), nullable=False, index=True)

    interface = Column(SAEnum(InterfaceArm), nullable=False)
    task_key = Column(String, nullable=False)
    task_title = Column(String, nullable=True)

    submitted_answer = Column(String, nullable=True)
    expected_answer = Column(String, nullable=True)
    correct = Column(Boolean, default=False, nullable=False)
    completed = Column(Boolean, default=False, nullable=False)

    duration_ms = Column(Integer, default=0, nullable=False)  # time-on-task
    click_count = Column(Integer, default=0, nullable=False)
    error_count = Column(Integer, default=0, nullable=False)  # wrong submissions

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    participant = relationship("ResearchParticipant", back_populates="attempts")


class InteractionEvent(Base):
    """Fine-grained interaction telemetry (clicks, tab switches, navigations)."""
    __tablename__ = "research_interaction_events"

    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(ForeignKey("research_participants.id"), nullable=False, index=True)
    task_attempt_id = Column(ForeignKey("research_task_attempts.id"), nullable=True, index=True)

    interface = Column(SAEnum(InterfaceArm), nullable=False)
    event_type = Column(String, nullable=False)   # click | navigate | tab_switch | expand | search
    target = Column(String, nullable=True)        # what was interacted with
    task_key = Column(String, nullable=True)
    t_offset_ms = Column(Integer, default=0, nullable=False)  # ms since task start

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    participant = relationship("ResearchParticipant", back_populates="events")


# ── Quantitative: cognitive workload (NASA-TLX) ─────────────────────────────

class WorkloadAssessment(Base):
    """
    NASA Task Load Index for one interface arm. Six 0-100 subscales; we store
    the unweighted ``raw_tlx`` (mean of the six), the widely-used Raw TLX.
    """
    __tablename__ = "research_workload_assessments"

    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(ForeignKey("research_participants.id"), nullable=False, index=True)
    interface = Column(SAEnum(InterfaceArm), nullable=False)

    mental_demand = Column(Integer, nullable=False)
    physical_demand = Column(Integer, nullable=False)
    temporal_demand = Column(Integer, nullable=False)
    performance = Column(Integer, nullable=False)   # 0 = perfect, 100 = failure
    effort = Column(Integer, nullable=False)
    frustration = Column(Integer, nullable=False)
    raw_tlx = Column(Float, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    participant = relationship("ResearchParticipant", back_populates="assessments")


# ── Qualitative: open-ended / interview responses ───────────────────────────

class QualitativeResponse(Base):
    """Open-ended responses (think-aloud / post-condition interview)."""
    __tablename__ = "research_qualitative_responses"

    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(ForeignKey("research_participants.id"), nullable=False, index=True)
    # interface may be null for overall/closing questions
    interface = Column(SAEnum(InterfaceArm), nullable=True)

    prompt_key = Column(String, nullable=False)
    prompt = Column(Text, nullable=True)
    response = Column(Text, nullable=True)

    # Researcher thematic coding (convergent analysis)
    code = Column(String, nullable=True)
    theme = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    participant = relationship("ResearchParticipant", back_populates="responses")


# ── Usability: CareOS evaluation (SUS + Nielsen heuristics + design) ─────────

class UsabilityAssessment(Base):
    """
    Post-study usability evaluation of CareOS (the relational interface the
    participant used): the System Usability Scale (SUS), Nielsen's 10 heuristics,
    design ratings, and open-ended function/design feedback. JSON columns keep
    the instrument flexible; ``sus_score`` is the scored 0-100 SUS.
    """
    __tablename__ = "research_usability_assessments"

    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(ForeignKey("research_participants.id"), nullable=False, index=True)
    target = Column(String, default="careos_relational", nullable=False)

    # System Usability Scale (10 items, 1-5) + scored 0-100
    sus_responses = Column(JSON, nullable=True)   # {"sus1": 1-5, ...}
    sus_score = Column(Float, nullable=True)       # 0-100

    # Nielsen's 10 usability heuristics (1-5) + optional per-heuristic comments
    heuristic_ratings = Column(JSON, nullable=True)   # {"h1": 1-5, ...}
    heuristic_comments = Column(JSON, nullable=True)  # {"h1": "..."}

    # Design ratings (1-5) — visual appeal, clarity, density, trust
    design_ratings = Column(JSON, nullable=True)

    # Open-ended function / design feedback
    most_valuable = Column(Text, nullable=True)
    missing_functions = Column(Text, nullable=True)
    friction = Column(Text, nullable=True)
    general_comments = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    participant = relationship("ResearchParticipant", back_populates="usability")


# ── Exploration: instrumented free-exploration pages (neon vs generic) ─────

class ExplorationMetric(Base):
    """
    One instrumented free-exploration page. Captures engagement with a styled
    page (neon vs generic) that contains a relational and a non-relational
    section: time, scroll depth, clicks, and per-section attention (viewport +
    hover dwell). Gaze columns are reserved for an optional future webcam layer.
    """
    __tablename__ = "research_exploration_metrics"

    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(ForeignKey("research_participants.id"), nullable=False, index=True)

    style = Column(String, nullable=False)            # 'neon' | 'generic'
    order_index = Column(Integer, default=0, nullable=False)  # page order shown

    duration_ms = Column(Integer, default=0, nullable=False)
    scroll_depth_pct = Column(Integer, default=0, nullable=False)
    click_count = Column(Integer, default=0, nullable=False)
    relational_clicks = Column(Integer, default=0, nullable=False)
    nonrelational_clicks = Column(Integer, default=0, nullable=False)
    relational_attention_ms = Column(Integer, default=0, nullable=False)
    nonrelational_attention_ms = Column(Integer, default=0, nullable=False)
    mouse_distance_px = Column(Integer, default=0, nullable=False)

    # Optional webcam gaze (off by default — blocked by current CSP/permissions)
    gaze_available = Column(Boolean, default=False, nullable=False)
    gaze_relational_ms = Column(Integer, nullable=True)
    gaze_nonrelational_ms = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    participant = relationship("ResearchParticipant", back_populates="exploration")


# ── Researcher access audit (integrity / zero-trust monitoring) ──────────────

class ResearcherAuditLog(Base):
    """
    Append-only log of authenticated researcher access and data exports.

    Supports the policy's Integrity (§6) and Zero-Trust (§7) requirements: every
    gated request — success or failure — is recorded so unusual access can be
    reviewed and incidents investigated.
    """
    __tablename__ = "research_access_audit"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String, nullable=False)         # e.g. "GET /api/research/results/export.csv"
    ok = Column(Boolean, default=True, nullable=False)
    detail = Column(String, nullable=True)          # e.g. "invalid_key", "not_configured"
    ip = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
