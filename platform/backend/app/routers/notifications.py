from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Notification
from app.schemas import NotificationOut, NotificationUpdate

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    patient_id: int | None = Query(None),
    unread_only: bool = Query(False),
    db: Session = Depends(get_db),
):
    q = db.query(Notification)
    if patient_id is not None:
        q = q.filter(Notification.patient_id == patient_id)
    if unread_only:
        q = q.filter(Notification.read == False)
    return q.order_by(Notification.created_at.desc()).all()


@router.patch("/{notification_id}", response_model=NotificationOut)
def update_notification(
    notification_id: int,
    update: NotificationUpdate,
    db: Session = Depends(get_db),
):
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.read = update.read
    db.commit()
    db.refresh(notif)
    return notif
