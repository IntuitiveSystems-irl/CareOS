"""
Research API — comparative EHR usability study.

Endpoints for participant enrollment (counterbalanced), informed consent,
demographics, task-attempt scoring, interaction telemetry, NASA-TLX workload,
qualitative responses, and researcher-side analytics + data export.
"""
import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.research import study as study_def
from app.research import analytics
from app.research.auth import require_researcher
from app.research.models import (
    ResearchParticipant, TaskAttempt, InteractionEvent,
    WorkloadAssessment, QualitativeResponse, UsabilityAssessment, ExplorationMetric,
    ResearcherAuditLog, ConditionOrder, ParticipantStatus, InterfaceArm,
)
from app.research.schemas import (
    ParticipantOut, ParticipantDetailOut, ConsentIn, DemographicsIn,
    TaskAttemptIn, TaskAttemptOut, EventsBulkIn, WorkloadIn, WorkloadOut,
    QualitativeBulkIn, QualitativeOut, QualCodingIn,
    RegisterIn, LoginIn, RosterOut, UsabilityIn, UsabilityOut,
    ExplorationIn, ExplorationOut, StylePreferenceIn,
)

router = APIRouter(prefix="/api/research", tags=["research"])


# ── Helpers ──────────────────────────────────────────────────────────────────

def _next_code(db: Session) -> tuple[str, int]:
    """Generate a unique participant code + return current participant count."""
    count = db.query(func.count(ResearchParticipant.id)).scalar() or 0
    n = count + 1
    while db.query(ResearchParticipant.id).filter(
        ResearchParticipant.participant_code == f"P{n:03d}"
    ).first():
        n += 1
    return f"P{n:03d}", count


def _get_participant(db: Session, pid: int) -> ResearchParticipant:
    p = db.query(ResearchParticipant).filter(ResearchParticipant.id == pid).first()
    if not p:
        raise HTTPException(status_code=404, detail="Participant not found")
    return p


# ── Study definition ─────────────────────────────────────────────────────────

@router.get("/study")
def get_study():
    """Public study protocol (synthetic patient, tasks, instruments, consent).
    Task expected-answers are intentionally omitted."""
    return study_def.public_study()


# ── Enrollment & participant lifecycle ───────────────────────────────────────

@router.post("/participants", response_model=ParticipantOut)
def enroll(db: Session = Depends(get_db)):
    """Enroll a new participant with counterbalanced condition order
    (alternating traditional-first / relational-first)."""
    code, count = _next_code(db)
    order = (
        ConditionOrder.traditional_first if count % 2 == 0
        else ConditionOrder.relational_first
    )
    p = ResearchParticipant(participant_code=code, condition_order=order)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.post("/participants/register", response_model=ParticipantOut)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    """Sign up a participant (name + email). Re-registering with a known email
    returns the existing record; the client locks it if already started."""
    email = body.email.strip().lower()
    existing = (
        db.query(ResearchParticipant)
        .filter(func.lower(ResearchParticipant.email) == email)
        .first()
    )
    if existing:
        if existing.status == ParticipantStatus.enrolled and not existing.full_name:
            existing.full_name = body.full_name.strip()
            db.commit()
            db.refresh(existing)
        return existing

    code, count = _next_code(db)
    order = (
        ConditionOrder.traditional_first if count % 2 == 0
        else ConditionOrder.relational_first
    )
    p = ResearchParticipant(
        participant_code=code,
        condition_order=order,
        full_name=body.full_name.strip(),
        email=email,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.post("/participants/login", response_model=ParticipantOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    """Return-login by email. The client decides whether to resume (enrolled,
    not yet started) or show the locked/finished screen (in_progress/completed)."""
    email = body.email.strip().lower()
    p = (
        db.query(ResearchParticipant)
        .filter(func.lower(ResearchParticipant.email) == email)
        .first()
    )
    if not p:
        raise HTTPException(
            status_code=404,
            detail="No participant found for that email. Please sign up.",
        )
    return p


@router.get("/participants", response_model=list[ParticipantOut])
def list_participants(
    db: Session = Depends(get_db),
    _: bool = Depends(require_researcher),
):
    return (
        db.query(ResearchParticipant)
        .order_by(ResearchParticipant.created_at.desc())
        .all()
    )


@router.get("/participants/roster", response_model=list[RosterOut])
def roster(
    db: Session = Depends(get_db),
    _: bool = Depends(require_researcher),
):
    """Participant roster with progress counts (researcher-only)."""
    parts = (
        db.query(ResearchParticipant)
        .options(
            selectinload(ResearchParticipant.attempts),
            selectinload(ResearchParticipant.assessments),
            selectinload(ResearchParticipant.responses),
            selectinload(ResearchParticipant.usability),
            selectinload(ResearchParticipant.exploration),
        )
        .order_by(ResearchParticipant.created_at.desc())
        .all()
    )
    return [
        RosterOut(
            id=p.id,
            participant_code=p.participant_code,
            full_name=p.full_name,
            email=p.email,
            role=p.role,
            specialty=p.specialty,
            status=p.status,
            condition_order=p.condition_order,
            started_at=p.started_at,
            completed_at=p.completed_at,
            created_at=p.created_at,
            n_attempts=len(p.attempts),
            n_workload=len(p.assessments),
            n_qualitative=len(p.responses),
            n_usability=len(p.usability),
            sus_score=next((u.sus_score for u in p.usability if u.sus_score is not None), None),
        )
        for p in parts
    ]


@router.get("/participants/{pid}", response_model=ParticipantDetailOut)
def get_participant(
    pid: int,
    db: Session = Depends(get_db),
    _: bool = Depends(require_researcher),
):
    p = (
        db.query(ResearchParticipant)
        .options(
            selectinload(ResearchParticipant.attempts),
            selectinload(ResearchParticipant.assessments),
            selectinload(ResearchParticipant.responses),
            selectinload(ResearchParticipant.usability),
            selectinload(ResearchParticipant.exploration),
        )
        .filter(ResearchParticipant.id == pid)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Participant not found")
    return p


@router.post("/participants/{pid}/consent", response_model=ParticipantOut)
def give_consent(pid: int, body: ConsentIn, db: Session = Depends(get_db)):
    p = _get_participant(db, pid)
    if not body.agreed:
        raise HTTPException(status_code=400, detail="Consent not agreed")
    p.consent_given = True
    p.consent_signature = body.signature
    p.consent_at = datetime.utcnow()
    if p.status == ParticipantStatus.enrolled:
        p.status = ParticipantStatus.in_progress
        p.started_at = datetime.utcnow()
    db.commit()
    db.refresh(p)
    return p


@router.patch("/participants/{pid}/demographics", response_model=ParticipantOut)
def set_demographics(pid: int, body: DemographicsIn, db: Session = Depends(get_db)):
    p = _get_participant(db, pid)
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(p, field, val)
    db.commit()
    db.refresh(p)
    return p


@router.post("/participants/{pid}/complete", response_model=ParticipantOut)
def complete(pid: int, db: Session = Depends(get_db)):
    p = _get_participant(db, pid)
    p.status = ParticipantStatus.completed
    p.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(p)
    return p


@router.post("/participants/{pid}/withdraw", response_model=ParticipantOut)
def withdraw(
    pid: int,
    db: Session = Depends(get_db),
    _: bool = Depends(require_researcher),
):
    """Honor a participant withdrawal (Policy §11/§13, R-9): erase direct
    identifiers while preserving the coded response dataset, and mark withdrawn.
    Researcher-gated — the study team actions a participant's request."""
    p = _get_participant(db, pid)
    p.full_name = None
    p.email = None
    p.consent_signature = None
    p.status = ParticipantStatus.withdrawn
    db.commit()
    db.refresh(p)
    return p


# ── Data capture: task attempts, telemetry, workload, qualitative ────────────

@router.post("/participants/{pid}/task-attempts", response_model=TaskAttemptOut)
def record_attempt(pid: int, body: TaskAttemptIn, db: Session = Depends(get_db)):
    """Record a task attempt. Answer is scored server-side against the protocol."""
    p = _get_participant(db, pid)

    expected = study_def.expected_answer(body.task_key)
    submitted = (body.submitted_answer or "").strip()
    correct = bool(expected and submitted.lower() == expected.strip().lower())

    if p.status == ParticipantStatus.enrolled:
        p.status = ParticipantStatus.in_progress
        p.started_at = p.started_at or datetime.utcnow()

    attempt = TaskAttempt(
        participant_id=p.id,
        interface=body.interface,
        task_key=body.task_key,
        task_title=study_def.task_title(body.task_key),
        submitted_answer=submitted or None,
        expected_answer=expected,
        correct=correct,
        completed=body.completed,
        duration_ms=max(0, body.duration_ms),
        click_count=max(0, body.click_count),
        error_count=0 if correct else 1,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


@router.post("/participants/{pid}/events")
def record_events(pid: int, body: EventsBulkIn, db: Session = Depends(get_db)):
    """Bulk-ingest interaction telemetry events for a participant."""
    _get_participant(db, pid)
    for e in body.events:
        db.add(InteractionEvent(
            participant_id=pid,
            task_attempt_id=e.task_attempt_id,
            interface=e.interface,
            event_type=e.event_type,
            target=e.target,
            task_key=e.task_key,
            t_offset_ms=max(0, e.t_offset_ms),
        ))
    db.commit()
    return {"ingested": len(body.events)}


@router.post("/participants/{pid}/workload", response_model=WorkloadOut)
def record_workload(pid: int, body: WorkloadIn, db: Session = Depends(get_db)):
    """Record a NASA-TLX assessment for one interface; computes Raw TLX."""
    _get_participant(db, pid)
    subscales = [
        body.mental_demand, body.physical_demand, body.temporal_demand,
        body.performance, body.effort, body.frustration,
    ]
    raw_tlx = round(sum(subscales) / len(subscales), 2)
    wa = WorkloadAssessment(
        participant_id=pid,
        interface=body.interface,
        mental_demand=body.mental_demand,
        physical_demand=body.physical_demand,
        temporal_demand=body.temporal_demand,
        performance=body.performance,
        effort=body.effort,
        frustration=body.frustration,
        raw_tlx=raw_tlx,
    )
    db.add(wa)
    db.commit()
    db.refresh(wa)
    return wa


@router.post("/participants/{pid}/qualitative")
def record_qualitative(pid: int, body: QualitativeBulkIn, db: Session = Depends(get_db)):
    """Bulk-store open-ended responses."""
    _get_participant(db, pid)
    saved = 0
    for r in body.responses:
        if not (r.response and r.response.strip()):
            continue
        db.add(QualitativeResponse(
            participant_id=pid,
            interface=r.interface,
            prompt_key=r.prompt_key,
            prompt=r.prompt,
            response=r.response.strip(),
        ))
        saved += 1
    db.commit()
    return {"saved": saved}


@router.post("/participants/{pid}/usability", response_model=UsabilityOut)
def record_usability(pid: int, body: UsabilityIn, db: Session = Depends(get_db)):
    """Store the post-study CareOS usability evaluation. SUS is scored
    server-side (0-100); empty fields are dropped."""
    _get_participant(db, pid)

    def clean(s):
        s = (s or "").strip()
        return s or None

    sus = {k: int(v) for k, v in (body.sus_responses or {}).items()}
    heur = {k: int(v) for k, v in (body.heuristic_ratings or {}).items()}
    heur_c = {k: v.strip() for k, v in (body.heuristic_comments or {}).items() if v and v.strip()}
    design = {k: int(v) for k, v in (body.design_ratings or {}).items()}

    ua = UsabilityAssessment(
        participant_id=pid,
        target=body.target or "careos_relational",
        sus_responses=sus or None,
        sus_score=study_def.score_sus(sus) if sus else None,
        heuristic_ratings=heur or None,
        heuristic_comments=heur_c or None,
        design_ratings=design or None,
        most_valuable=clean(body.most_valuable),
        missing_functions=clean(body.missing_functions),
        friction=clean(body.friction),
        general_comments=clean(body.general_comments),
    )
    db.add(ua)
    db.commit()
    db.refresh(ua)
    return ua


@router.post("/participants/{pid}/exploration", response_model=ExplorationOut)
def record_exploration(pid: int, body: ExplorationIn, db: Session = Depends(get_db)):
    """Record one instrumented free-exploration page (engagement + per-section attention)."""
    _get_participant(db, pid)
    style = body.style if body.style in ("neon", "generic") else "generic"
    em = ExplorationMetric(
        participant_id=pid,
        style=style,
        order_index=max(0, body.order_index),
        duration_ms=max(0, body.duration_ms),
        scroll_depth_pct=max(0, min(100, body.scroll_depth_pct)),
        click_count=max(0, body.click_count),
        relational_clicks=max(0, body.relational_clicks),
        nonrelational_clicks=max(0, body.nonrelational_clicks),
        relational_attention_ms=max(0, body.relational_attention_ms),
        nonrelational_attention_ms=max(0, body.nonrelational_attention_ms),
        mouse_distance_px=max(0, body.mouse_distance_px),
        gaze_available=body.gaze_available,
        gaze_relational_ms=body.gaze_relational_ms,
        gaze_nonrelational_ms=body.gaze_nonrelational_ms,
    )
    db.add(em)
    db.commit()
    db.refresh(em)
    return em


@router.post("/participants/{pid}/style-preference", response_model=ParticipantOut)
def set_style_preference(pid: int, body: StylePreferenceIn, db: Session = Depends(get_db)):
    """Record the forced-choice design preference (neon vs generic)."""
    p = _get_participant(db, pid)
    p.style_preference = body.choice if body.choice in ("neon", "generic") else None
    db.commit()
    db.refresh(p)
    return p


# ── Retention & disposal (researcher) ──────────────────────────────────────
# (Participant withdrawal lives with the participant lifecycle routes above.)

@router.post("/maintenance/purge-identifiers")
def purge_identifiers(
    db: Session = Depends(get_db),
    _: bool = Depends(require_researcher),
):
    """End-of-study secure disposal (Policy §13, R-9): strip direct identifiers
    (name, email, typed signature) from ALL participants, leaving the coded
    analysis dataset intact. Irreversible."""
    rows = (
        db.query(ResearchParticipant)
        .filter(
            (ResearchParticipant.full_name.isnot(None))
            | (ResearchParticipant.email.isnot(None))
            | (ResearchParticipant.consent_signature.isnot(None))
        )
        .all()
    )
    for p in rows:
        p.full_name = None
        p.email = None
        p.consent_signature = None
    db.commit()
    return {"purged": len(rows)}


# ── Qualitative coding (researcher) ──────────────────────────────────────────

@router.get("/qualitative", response_model=list[QualitativeOut])
def list_qualitative(
    db: Session = Depends(get_db),
    _: bool = Depends(require_researcher),
):
    return (
        db.query(QualitativeResponse)
        .order_by(QualitativeResponse.created_at.desc())
        .all()
    )


@router.patch("/qualitative/{qid}/coding", response_model=QualitativeOut)
def code_qualitative(
    qid: int,
    body: QualCodingIn,
    db: Session = Depends(get_db),
    _: bool = Depends(require_researcher),
):
    q = db.query(QualitativeResponse).filter(QualitativeResponse.id == qid).first()
    if not q:
        raise HTTPException(status_code=404, detail="Response not found")
    if body.code is not None:
        q.code = body.code
    if body.theme is not None:
        q.theme = body.theme
    db.commit()
    db.refresh(q)
    return q


# ── Analytics & export (researcher) ──────────────────────────────────

@router.get("/auth/check")
def auth_check(_: bool = Depends(require_researcher)):
    """Validate a researcher passcode (used by the dashboard login)."""
    return {"ok": True}


@router.get("/results/summary")
def results_summary(
    db: Session = Depends(get_db),
    _: bool = Depends(require_researcher),
):
    """Descriptive + paired (within-subject) statistics for both arms."""
    return analytics.compute_summary(db)


@router.get("/results/usability")
def results_usability(
    db: Session = Depends(get_db),
    _: bool = Depends(require_researcher),
):
    """Aggregated CareOS usability metrics (SUS, heuristics, design)."""
    return analytics.compute_usability(db)


@router.get("/results/exploration")
def results_exploration(
    db: Session = Depends(get_db),
    _: bool = Depends(require_researcher),
):
    """Aggregated exploration engagement (neon vs generic; relational vs non-relational)."""
    return analytics.compute_exploration(db)


@router.get("/results/audit")
def results_audit(
    limit: int = 200,
    db: Session = Depends(get_db),
    _: bool = Depends(require_researcher),
):
    """Recent researcher access/export audit entries (most recent first, R-6)."""
    rows = (
        db.query(ResearcherAuditLog)
        .order_by(ResearcherAuditLog.created_at.desc())
        .limit(max(1, min(1000, limit)))
        .all()
    )
    return [
        {
            "id": r.id, "action": r.action, "ok": r.ok,
            "detail": r.detail, "ip": r.ip, "created_at": r.created_at,
        }
        for r in rows
    ]


@router.get("/results/export.csv")
def export_csv(
    db: Session = Depends(get_db),
    _: bool = Depends(require_researcher),
):
    """Tidy one-row-per-participant CSV for analysis in R/SPSS/Python."""
    headers, rows = analytics.csv_rows(db)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    writer.writerows(rows)
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=ehr_study_results.csv"},
    )


@router.get("/results/export.json", response_model=list[ParticipantDetailOut])
def export_json(
    db: Session = Depends(get_db),
    _: bool = Depends(require_researcher),
):
    """Full per-participant dump (attempts, workload, qualitative)."""
    return (
        db.query(ResearchParticipant)
        .options(
            selectinload(ResearchParticipant.attempts),
            selectinload(ResearchParticipant.assessments),
            selectinload(ResearchParticipant.responses),
            selectinload(ResearchParticipant.usability),
            selectinload(ResearchParticipant.exploration),
        )
        .order_by(ResearchParticipant.id)
        .all()
    )
