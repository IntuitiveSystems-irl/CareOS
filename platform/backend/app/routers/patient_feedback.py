"""
Patient feedback — the patient's voice (Patient Fishbowl) that flows into CDS.

  GET   /api/patient/{patient_id}/feedback     list a patient's feedback
  POST  /api/patient/{patient_id}/feedback     patient submits feedback
  GET   /api/feedback                          clinician inbox (filterable)
  PATCH /api/feedback/{feedback_id}            acknowledge / resolve
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Patient, PatientFeedback, FeedbackStatus
from app.schemas import (
    PatientFeedbackCreate, PatientFeedbackUpdate, PatientFeedbackOut,
)
from app.routers.clinicians import resolve_clinician

logger = logging.getLogger(__name__)

router = APIRouter(tags=["patient-feedback"])


@router.get("/api/patient/{patient_id}/feedback", response_model=list[PatientFeedbackOut])
def list_patient_feedback(
    patient_id: int,
    status: Optional[FeedbackStatus] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(PatientFeedback).filter(PatientFeedback.patient_id == patient_id)
    if status is not None:
        q = q.filter(PatientFeedback.status == status)
    return q.order_by(desc(PatientFeedback.created_at)).all()


@router.post("/api/patient/{patient_id}/feedback", response_model=PatientFeedbackOut, status_code=201)
def create_patient_feedback(
    patient_id: int,
    payload: PatientFeedbackCreate,
    db: Session = Depends(get_db),
):
    if not db.query(Patient).get(patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Feedback message is required")

    fb = PatientFeedback(
        patient_id=patient_id,
        topic=payload.topic or None,
        target_kind=payload.target_kind or None,
        target_ref=payload.target_ref or None,
        target_label=payload.target_label or None,
        sentiment=payload.sentiment,
        message=payload.message.strip(),
        status=FeedbackStatus.open,
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return fb


@router.get("/api/feedback", response_model=list[PatientFeedbackOut])
def clinician_feedback_inbox(
    status: Optional[FeedbackStatus] = Query(None),
    patient_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(PatientFeedback)
    if status is not None:
        q = q.filter(PatientFeedback.status == status)
    if patient_id is not None:
        q = q.filter(PatientFeedback.patient_id == patient_id)
    return q.order_by(desc(PatientFeedback.created_at)).all()


@router.patch("/api/feedback/{feedback_id}", response_model=PatientFeedbackOut)
def update_feedback(
    feedback_id: int,
    payload: PatientFeedbackUpdate,
    db: Session = Depends(get_db),
    x_clinician_token: Optional[str] = Header(None),
):
    fb = db.query(PatientFeedback).get(feedback_id)
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")
    data = payload.model_dump(exclude_unset=True)
    if "status" in data:
        fb.status = data["status"]
    clinician = resolve_clinician(db, x_clinician_token)
    if clinician:
        fb.acknowledged_by = clinician.actor_name
    elif data.get("acknowledged_by"):
        fb.acknowledged_by = data["acknowledged_by"]
    db.commit()
    db.refresh(fb)
    return fb
