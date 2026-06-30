from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import (
    AccessRequest, AccessRequestStatus, Notification, AccessLog, Patient, Organization,
)
from app.schemas import AccessRequestCreate, AccessRequestOut, AccessRequestUpdate

router = APIRouter(prefix="/api/access-requests", tags=["access-requests"])


@router.post("", response_model=AccessRequestOut, status_code=201)
def create_access_request(
    payload: AccessRequestCreate,
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.id == payload.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    org = db.query(Organization).filter(Organization.id == payload.requesting_org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    request = AccessRequest(
        patient_id=payload.patient_id,
        requesting_org_id=payload.requesting_org_id,
        purpose=payload.purpose,
        scopes=payload.scopes or "patient/*.read",
        use_type=payload.use_type,
        secondary_purpose=payload.secondary_purpose,
    )
    db.add(request)
    db.flush()

    use_label = "primary care" if payload.use_type.value == "primary_care" else f"secondary use ({payload.secondary_purpose.value if payload.secondary_purpose else 'unspecified'})"
    notification = Notification(
        patient_id=payload.patient_id,
        type="access_request",
        message=f"{org.name} is requesting access to your health records for {use_label}. Purpose: {payload.purpose or 'Not specified'}",
        access_request_id=request.id,
    )
    db.add(notification)

    log = AccessLog(
        patient_id=payload.patient_id,
        requesting_org_id=payload.requesting_org_id,
        action="access_requested",
        details=f"Access request created by {org.name}",
    )
    db.add(log)

    db.commit()
    db.refresh(request)
    return db.query(AccessRequest).options(joinedload(AccessRequest.organization)).filter(AccessRequest.id == request.id).first()


@router.get("", response_model=list[AccessRequestOut])
def list_access_requests(
    patient_id: int | None = Query(None),
    status: AccessRequestStatus | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(AccessRequest).options(joinedload(AccessRequest.organization))
    if patient_id is not None:
        q = q.filter(AccessRequest.patient_id == patient_id)
    if status is not None:
        q = q.filter(AccessRequest.status == status)
    return q.order_by(AccessRequest.created_at.desc()).all()


@router.get("/{request_id}", response_model=AccessRequestOut)
def get_access_request(request_id: int, db: Session = Depends(get_db)):
    ar = (
        db.query(AccessRequest)
        .options(joinedload(AccessRequest.organization))
        .filter(AccessRequest.id == request_id)
        .first()
    )
    if not ar:
        raise HTTPException(status_code=404, detail="Access request not found")
    return ar


@router.put("/{request_id}", response_model=AccessRequestOut)
def update_access_request_put(
    request_id: int,
    update: AccessRequestUpdate,
    db: Session = Depends(get_db),
):
    """PUT alias for PATCH — used by AI layer."""
    return update_access_request(request_id, update, db)


@router.patch("/{request_id}", response_model=AccessRequestOut)
def update_access_request(
    request_id: int,
    update: AccessRequestUpdate,
    db: Session = Depends(get_db),
):
    ar = db.query(AccessRequest).filter(AccessRequest.id == request_id).first()
    if not ar:
        raise HTTPException(status_code=404, detail="Access request not found")

    if ar.status != AccessRequestStatus.pending:
        raise HTTPException(status_code=400, detail="Request has already been resolved")

    ar.status = update.status
    ar.resolved_at = datetime.utcnow()
    if update.approved_time_window is not None:
        ar.approved_time_window = update.approved_time_window
    if update.approved_duration is not None:
        ar.approved_duration = update.approved_duration
    if update.approved_categories is not None:
        ar.approved_categories = update.approved_categories

    action = "access_approved" if update.status == AccessRequestStatus.approved else "access_denied"
    log = AccessLog(
        patient_id=ar.patient_id,
        requesting_org_id=ar.requesting_org_id,
        action=action,
        details=f"Patient {'approved' if update.status == AccessRequestStatus.approved else 'denied'} access request #{ar.id}",
    )
    db.add(log)

    db.commit()
    return (
        db.query(AccessRequest)
        .options(joinedload(AccessRequest.organization))
        .filter(AccessRequest.id == request_id)
        .first()
    )
