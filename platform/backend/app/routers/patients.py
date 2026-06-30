from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Patient
from app.schemas import PatientOut, PatientRecords, ClinicalNoteOut, DiagnosisOut, MedicationOut, AllergyOut, LabResultOut, EncounterOut

router = APIRouter(prefix="/api/patients", tags=["patients"])


@router.get("", response_model=list[PatientOut])
def list_patients(db: Session = Depends(get_db)):
    return db.query(Patient).all()


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.get("/{patient_id}/records", response_model=PatientRecords)
def get_patient_records(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return PatientRecords(
        patient=PatientOut.model_validate(patient),
        clinical_notes=[ClinicalNoteOut.model_validate(n) for n in patient.clinical_notes],
        diagnoses=[DiagnosisOut.model_validate(d) for d in patient.diagnoses],
        medications=[MedicationOut.model_validate(m) for m in patient.medications],
        allergies=[AllergyOut.model_validate(a) for a in patient.allergies],
        lab_results=[LabResultOut.model_validate(l) for l in patient.lab_results],
        encounters=[EncounterOut.model_validate(e) for e in patient.encounters],
    )
