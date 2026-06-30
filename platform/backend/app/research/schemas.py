"""Pydantic request/response schemas for the research API."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.research.models import (
    ParticipantRole, ConditionOrder, ParticipantStatus, InterfaceArm,
)


# ── Participant ──────────────────────────────────────────────────────────────

class RegisterIn(BaseModel):
    full_name: str = Field(min_length=1)
    email: str = Field(min_length=3)


class LoginIn(BaseModel):
    email: str = Field(min_length=3)


class ParticipantOut(BaseModel):
    id: int
    participant_code: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[ParticipantRole] = None
    specialty: Optional[str] = None
    years_experience: Optional[float] = None
    primary_ehr: Optional[str] = None
    ehr_hours_per_week: Optional[float] = None
    age_range: Optional[str] = None
    style_preference: Optional[str] = None
    consent_given: bool
    consent_at: Optional[datetime] = None
    condition_order: ConditionOrder
    status: ParticipantStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class ConsentIn(BaseModel):
    signature: str = Field(min_length=1)
    agreed: bool = True


class DemographicsIn(BaseModel):
    role: Optional[ParticipantRole] = None
    specialty: Optional[str] = None
    years_experience: Optional[float] = None
    primary_ehr: Optional[str] = None
    ehr_hours_per_week: Optional[float] = None
    age_range: Optional[str] = None


# ── Task attempts ────────────────────────────────────────────────────────────

class TaskAttemptIn(BaseModel):
    interface: InterfaceArm
    task_key: str
    submitted_answer: Optional[str] = None
    duration_ms: int = 0
    click_count: int = 0
    completed: bool = True


class TaskAttemptOut(BaseModel):
    id: int
    participant_id: int
    interface: InterfaceArm
    task_key: str
    task_title: Optional[str] = None
    submitted_answer: Optional[str] = None
    expected_answer: Optional[str] = None
    correct: bool
    completed: bool
    duration_ms: int
    click_count: int
    error_count: int
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Interaction telemetry ────────────────────────────────────────────────────

class EventIn(BaseModel):
    interface: InterfaceArm
    event_type: str
    target: Optional[str] = None
    task_key: Optional[str] = None
    t_offset_ms: int = 0
    task_attempt_id: Optional[int] = None


class EventsBulkIn(BaseModel):
    events: list[EventIn]


# ── NASA-TLX workload ────────────────────────────────────────────────────────

class WorkloadIn(BaseModel):
    interface: InterfaceArm
    mental_demand: int = Field(ge=0, le=100)
    physical_demand: int = Field(ge=0, le=100)
    temporal_demand: int = Field(ge=0, le=100)
    performance: int = Field(ge=0, le=100)
    effort: int = Field(ge=0, le=100)
    frustration: int = Field(ge=0, le=100)


class WorkloadOut(BaseModel):
    id: int
    participant_id: int
    interface: InterfaceArm
    mental_demand: int
    physical_demand: int
    temporal_demand: int
    performance: int
    effort: int
    frustration: int
    raw_tlx: float
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Qualitative ──────────────────────────────────────────────────────────────

class QualitativeIn(BaseModel):
    interface: Optional[InterfaceArm] = None
    prompt_key: str
    prompt: Optional[str] = None
    response: Optional[str] = None


class QualitativeBulkIn(BaseModel):
    responses: list[QualitativeIn]


class QualitativeOut(BaseModel):
    id: int
    participant_id: int
    interface: Optional[InterfaceArm] = None
    prompt_key: str
    prompt: Optional[str] = None
    response: Optional[str] = None
    code: Optional[str] = None
    theme: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class QualCodingIn(BaseModel):
    code: Optional[str] = None
    theme: Optional[str] = None


# ── Usability (SUS + Nielsen heuristics + design + function) ──────────────────

class UsabilityIn(BaseModel):
    target: str = "careos_relational"
    sus_responses: dict[str, int] = Field(default_factory=dict)
    heuristic_ratings: dict[str, int] = Field(default_factory=dict)
    heuristic_comments: dict[str, str] = Field(default_factory=dict)
    design_ratings: dict[str, int] = Field(default_factory=dict)
    most_valuable: Optional[str] = None
    missing_functions: Optional[str] = None
    friction: Optional[str] = None
    general_comments: Optional[str] = None


class StylePreferenceIn(BaseModel):
    choice: str


class ExplorationIn(BaseModel):
    style: str
    order_index: int = 0
    duration_ms: int = 0
    scroll_depth_pct: int = 0
    click_count: int = 0
    relational_clicks: int = 0
    nonrelational_clicks: int = 0
    relational_attention_ms: int = 0
    nonrelational_attention_ms: int = 0
    mouse_distance_px: int = 0
    gaze_available: bool = False
    gaze_relational_ms: Optional[int] = None
    gaze_nonrelational_ms: Optional[int] = None


class ExplorationOut(BaseModel):
    id: int
    participant_id: int
    style: str
    order_index: int
    duration_ms: int
    scroll_depth_pct: int
    click_count: int
    relational_clicks: int
    nonrelational_clicks: int
    relational_attention_ms: int
    nonrelational_attention_ms: int
    mouse_distance_px: int
    gaze_available: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class UsabilityOut(BaseModel):
    id: int
    participant_id: int
    target: str
    sus_responses: Optional[dict] = None
    sus_score: Optional[float] = None
    heuristic_ratings: Optional[dict] = None
    heuristic_comments: Optional[dict] = None
    design_ratings: Optional[dict] = None
    most_valuable: Optional[str] = None
    missing_functions: Optional[str] = None
    friction: Optional[str] = None
    general_comments: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Detailed participant view (for researcher) ───────────────────────────────

class ParticipantDetailOut(ParticipantOut):
    attempts: list[TaskAttemptOut] = []
    assessments: list[WorkloadOut] = []
    responses: list[QualitativeOut] = []
    usability: list[UsabilityOut] = []
    exploration: list[ExplorationOut] = []


class RosterOut(BaseModel):
    """Researcher roster row with progress counts (passcode-gated)."""
    id: int
    participant_code: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[ParticipantRole] = None
    specialty: Optional[str] = None
    status: ParticipantStatus
    condition_order: ConditionOrder
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    n_attempts: int
    n_workload: int
    n_qualitative: int
    n_usability: int = 0
    sus_score: Optional[float] = None
