from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ClinicalNote
from app.schemas import ClinicalNoteOut, ClinicalNoteUpdate

router = APIRouter(prefix="/api/clinical-notes", tags=["clinical-notes"])


@router.get("", response_model=list[ClinicalNoteOut])
def list_clinical_notes(
    patient_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(ClinicalNote)
    if patient_id is not None:
        q = q.filter(ClinicalNote.patient_id == patient_id)
    return q.order_by(ClinicalNote.date.desc()).all()


@router.get("/{note_id}", response_model=ClinicalNoteOut)
def get_clinical_note(note_id: int, db: Session = Depends(get_db)):
    note = db.query(ClinicalNote).filter(ClinicalNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Clinical note not found")
    return note


@router.patch("/{note_id}", response_model=ClinicalNoteOut)
def update_clinical_note(
    note_id: int,
    update: ClinicalNoteUpdate,
    db: Session = Depends(get_db),
):
    note = db.query(ClinicalNote).filter(ClinicalNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Clinical note not found")
    if update.status is not None:
        note.status = update.status
    if update.patient_comments is not None:
        note.patient_comments = update.patient_comments
    db.commit()
    db.refresh(note)
    return note
