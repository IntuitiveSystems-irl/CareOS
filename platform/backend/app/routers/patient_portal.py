"""
Patient portal endpoints:
  - Enriched access log view (with org name, use_type, token info)
  - Note review (Open Notes) — list, detail, submit review
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from app.database import get_db
from app.models import (
    AccessRequest, AccessToken, Organization, ClinicalNote,
    NoteReview, NoteReviewStatus, UseType,
)
from app.schemas import (
    PatientAccessLogOut, ClinicalNoteOut, NoteReviewCreate, NoteReviewOut,
)

router = APIRouter(prefix="/api/patient", tags=["patient-portal"])


# ── Enriched Access Log ──

@router.get("/{patient_id}/access-log", response_model=list[PatientAccessLogOut])
def patient_access_log(
    patient_id: int,
    use_type: Optional[UseType] = Query(None),
    organization_id: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
):
    q = (
        db.query(AccessRequest)
        .options(joinedload(AccessRequest.organization), joinedload(AccessRequest.access_token))
        .filter(AccessRequest.patient_id == patient_id)
    )
    if use_type is not None:
        q = q.filter(AccessRequest.use_type == use_type)
    if organization_id is not None:
        q = q.filter(AccessRequest.requesting_org_id == organization_id)
    if date_from is not None:
        q = q.filter(AccessRequest.created_at >= date_from)
    if date_to is not None:
        q = q.filter(AccessRequest.created_at <= date_to)

    rows = q.order_by(AccessRequest.created_at.desc()).all()

    return [
        PatientAccessLogOut(
            id=ar.id,
            patient_id=ar.patient_id,
            requesting_org_id=ar.requesting_org_id,
            organization_name=ar.organization.name if ar.organization else None,
            use_type=ar.use_type,
            secondary_purpose=ar.secondary_purpose,
            scopes=ar.scopes,
            status=ar.status,
            created_at=ar.created_at,
            resolved_at=ar.resolved_at,
            token_id=ar.access_token.id if ar.access_token else None,
        )
        for ar in rows
    ]


# ── Notes list & detail (reuses ClinicalNote model) ──

@router.get("/{patient_id}/notes", response_model=list[ClinicalNoteOut])
def patient_notes(patient_id: int, db: Session = Depends(get_db)):
    return (
        db.query(ClinicalNote)
        .filter(ClinicalNote.patient_id == patient_id)
        .order_by(ClinicalNote.date.desc())
        .all()
    )


@router.get("/{patient_id}/notes/{note_id}", response_model=ClinicalNoteOut)
def patient_note_detail(patient_id: int, note_id: int, db: Session = Depends(get_db)):
    note = (
        db.query(ClinicalNote)
        .filter(ClinicalNote.id == note_id, ClinicalNote.patient_id == patient_id)
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


# ── Note Review (Open Notes) ──

@router.post("/{patient_id}/notes/{note_id}/review", response_model=NoteReviewOut, status_code=201)
def submit_note_review(
    patient_id: int,
    note_id: int,
    payload: NoteReviewCreate,
    db: Session = Depends(get_db),
):
    note = (
        db.query(ClinicalNote)
        .filter(ClinicalNote.id == note_id, ClinicalNote.patient_id == patient_id)
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    review = NoteReview(
        note_id=note_id,
        patient_id=patient_id,
        status=payload.status,
        comment=payload.comment,
    )
    db.add(review)

    # Also update the ClinicalNote status to match
    from app.models import NoteStatus
    if payload.status == NoteReviewStatus.flagged:
        note.status = NoteStatus.flagged
        if payload.comment:
            note.patient_comments = payload.comment
    elif payload.status == NoteReviewStatus.approved:
        note.status = NoteStatus.approved

    db.commit()
    db.refresh(review)
    return review


@router.get("/{patient_id}/notes/{note_id}/reviews", response_model=list[NoteReviewOut])
def list_note_reviews(patient_id: int, note_id: int, db: Session = Depends(get_db)):
    return (
        db.query(NoteReview)
        .filter(NoteReview.note_id == note_id, NoteReview.patient_id == patient_id)
        .order_by(NoteReview.created_at.desc())
        .all()
    )
