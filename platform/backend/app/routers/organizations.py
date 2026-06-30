from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Organization, EhrVendor
from app.schemas import OrganizationOut, OrganizationCreate, OrganizationUpdate

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


def _coerce_vendor(value):
    """Accept an EhrVendor name/value string; default to 'other'."""
    if value is None:
        return None
    if isinstance(value, EhrVendor):
        return value
    try:
        return EhrVendor(value)
    except ValueError:
        return EhrVendor.other


@router.get("", response_model=list[OrganizationOut])
def list_organizations(db: Session = Depends(get_db)):
    return db.query(Organization).all()


@router.get("/{org_id}", response_model=OrganizationOut)
def get_organization(org_id: int, db: Session = Depends(get_db)):
    org = db.query(Organization).get(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.post("", response_model=OrganizationOut, status_code=201)
def create_organization(payload: OrganizationCreate, db: Session = Depends(get_db)):
    """Register a new EHR connection (org self-config for plug-and-play onboarding)."""
    data = payload.model_dump(exclude_unset=True)
    data["ehr_vendor"] = _coerce_vendor(data.get("ehr_vendor"))
    if not data.get("ehr_vendor"):
        data.pop("ehr_vendor", None)
    org = Organization(**data)
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


@router.patch("/{org_id}", response_model=OrganizationOut)
def update_organization(org_id: int, payload: OrganizationUpdate, db: Session = Depends(get_db)):
    org = db.query(Organization).get(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    data = payload.model_dump(exclude_unset=True)
    if "ehr_vendor" in data:
        data["ehr_vendor"] = _coerce_vendor(data["ehr_vendor"])
    for key, value in data.items():
        setattr(org, key, value)
    db.commit()
    db.refresh(org)
    return org


@router.delete("/{org_id}", status_code=204)
def delete_organization(org_id: int, db: Session = Depends(get_db)):
    org = db.query(Organization).get(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    db.delete(org)
    db.commit()
