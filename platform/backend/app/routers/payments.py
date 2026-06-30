from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.models import Payment, PaymentStatus, AccessRequest, AccessRequestStatus, AccessLog
from app.schemas import PaymentOut, PaymentCreate

router = APIRouter(prefix="/api/payments", tags=["payments"])


@router.post("", response_model=PaymentOut, status_code=201)
def create_payment(payload: PaymentCreate, db: Session = Depends(get_db)):
    ar = db.query(AccessRequest).filter(AccessRequest.id == payload.access_request_id).first()
    if not ar:
        raise HTTPException(status_code=404, detail="Access request not found")
    if ar.status != AccessRequestStatus.approved:
        raise HTTPException(status_code=400, detail="Access request is not approved")

    existing = db.query(Payment).filter(Payment.access_request_id == ar.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Payment already exists for this request")

    payment = Payment(
        access_request_id=ar.id,
        amount=settings.ACCESS_FEE_AMOUNT,
        status=PaymentStatus.completed,
    )
    db.add(payment)

    log = AccessLog(
        patient_id=ar.patient_id,
        requesting_org_id=ar.requesting_org_id,
        action="payment_completed",
        details=f"Access fee of ${settings.ACCESS_FEE_AMOUNT:.2f} paid for request #{ar.id}",
    )
    db.add(log)

    db.commit()
    db.refresh(payment)
    return payment


@router.get("/{payment_id}", response_model=PaymentOut)
def get_payment(payment_id: int, db: Session = Depends(get_db)):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment
