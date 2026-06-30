from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AccessLog
from app.schemas import AccessLogOut

router = APIRouter(prefix="/api/access-logs", tags=["access-logs"])


@router.get("", response_model=list[AccessLogOut])
def list_access_logs(
    patient_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(AccessLog)
    if patient_id is not None:
        q = q.filter(AccessLog.patient_id == patient_id)
    return q.order_by(AccessLog.timestamp.desc()).all()
