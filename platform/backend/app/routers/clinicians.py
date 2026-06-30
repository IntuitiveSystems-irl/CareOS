"""
Clinician management layer.

Identity (NPI), role-based staff registry, simple session auth, and the
``clinician.<npi>`` audit-actor namespace wired into the tamper-evident chain.

  GET    /api/clinicians                 list / filter staff
  POST   /api/clinicians                 register a clinician
  GET    /api/clinicians/{id}            fetch one
  PATCH  /api/clinicians/{id}            update profile / role / status
  DELETE /api/clinicians/{id}            remove
  POST   /api/clinicians/login           email + password -> session token
  GET    /api/clinicians/me              resolve the current session token
  GET    /api/clinicians/roles           role catalogue (for the UI)
"""
from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Clinician, ClinicianRole, ClinicianStatus
from app.schemas import (
    ClinicianCreate, ClinicianUpdate, ClinicianOut,
    ClinicianLogin, ClinicianLoginOut,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/clinicians", tags=["clinicians"])

_PBKDF2_ITERS = 120_000


# ── password hashing (stdlib pbkdf2) ──────────────────────────────────────────

def hash_password(pw: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), _PBKDF2_ITERS)
    return f"pbkdf2${_PBKDF2_ITERS}${salt}${dk.hex()}"


def verify_password(pw: str, stored: Optional[str]) -> bool:
    if not stored:
        return False
    try:
        _algo, iters, salt, h = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), int(iters))
        return secrets.compare_digest(dk.hex(), h)
    except (ValueError, TypeError):
        return False


def _serialize(c: Clinician) -> ClinicianOut:
    out = ClinicianOut.model_validate(c)
    out.actor_name = c.actor_name
    return out


# ── session resolution ────────────────────────────────────────────────────────

def get_current_clinician(
    x_clinician_token: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Optional[Clinician]:
    """Resolve the clinician for a session token, or None. Never raises."""
    if not x_clinician_token:
        return None
    return (
        db.query(Clinician)
        .filter(Clinician.session_token == x_clinician_token)
        .first()
    )


def resolve_clinician(db: Session, token: Optional[str]) -> Optional[Clinician]:
    if not token:
        return None
    return db.query(Clinician).filter(Clinician.session_token == token).first()


# ── catalogue ─────────────────────────────────────────────────────────────────

@router.get("/roles")
def list_roles() -> dict:
    return {
        "roles": [r.value for r in ClinicianRole],
        "statuses": [s.value for s in ClinicianStatus],
    }


# ── auth ──────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=ClinicianLoginOut)
def login(payload: ClinicianLogin, db: Session = Depends(get_db)):
    c = db.query(Clinician).filter(Clinician.email == payload.email.strip().lower()).first()
    if not c or not verify_password(payload.password, c.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if c.status != ClinicianStatus.active:
        raise HTTPException(status_code=403, detail=f"Account is {c.status.value}")
    c.session_token = secrets.token_urlsafe(32)
    c.last_login_at = datetime.utcnow()
    db.commit()
    db.refresh(c)
    return ClinicianLoginOut(token=c.session_token, clinician=_serialize(c))


@router.get("/me", response_model=ClinicianOut)
def me(current: Optional[Clinician] = Depends(get_current_clinician)):
    if not current:
        raise HTTPException(status_code=401, detail="No valid clinician session")
    return _serialize(current)


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[ClinicianOut])
def list_clinicians(
    organization_id: Optional[int] = Query(None),
    role: Optional[ClinicianRole] = Query(None),
    status: Optional[ClinicianStatus] = Query(None),
    q: Optional[str] = Query(None, description="search name / email / NPI"),
    db: Session = Depends(get_db),
):
    query = db.query(Clinician)
    if organization_id is not None:
        query = query.filter(Clinician.organization_id == organization_id)
    if role is not None:
        query = query.filter(Clinician.role == role)
    if status is not None:
        query = query.filter(Clinician.status == status)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(
            Clinician.first_name.ilike(like),
            Clinician.last_name.ilike(like),
            Clinician.email.ilike(like),
            Clinician.npi.ilike(like),
        ))
    rows = query.order_by(Clinician.last_name, Clinician.first_name).all()
    return [_serialize(c) for c in rows]


@router.get("/{clinician_id}", response_model=ClinicianOut)
def get_clinician(clinician_id: int, db: Session = Depends(get_db)):
    c = db.query(Clinician).get(clinician_id)
    if not c:
        raise HTTPException(status_code=404, detail="Clinician not found")
    return _serialize(c)


@router.post("", response_model=ClinicianOut, status_code=201)
def create_clinician(payload: ClinicianCreate, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if db.query(Clinician).filter(Clinician.email == email).first():
        raise HTTPException(status_code=409, detail="A clinician with that email already exists")
    if payload.npi and db.query(Clinician).filter(Clinician.npi == payload.npi).first():
        raise HTTPException(status_code=409, detail="A clinician with that NPI already exists")

    c = Clinician(
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        email=email,
        npi=payload.npi or None,
        credential=payload.credential or None,
        specialty=payload.specialty or None,
        role=payload.role,
        status=payload.status,
        organization_id=payload.organization_id,
        password_hash=hash_password(payload.password) if payload.password else None,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return _serialize(c)


@router.patch("/{clinician_id}", response_model=ClinicianOut)
def update_clinician(clinician_id: int, payload: ClinicianUpdate, db: Session = Depends(get_db)):
    c = db.query(Clinician).get(clinician_id)
    if not c:
        raise HTTPException(status_code=404, detail="Clinician not found")
    data = payload.model_dump(exclude_unset=True)

    if "email" in data and data["email"]:
        data["email"] = data["email"].strip().lower()
        clash = db.query(Clinician).filter(
            Clinician.email == data["email"], Clinician.id != clinician_id,
        ).first()
        if clash:
            raise HTTPException(status_code=409, detail="Email already in use")
    if data.get("npi"):
        clash = db.query(Clinician).filter(
            Clinician.npi == data["npi"], Clinician.id != clinician_id,
        ).first()
        if clash:
            raise HTTPException(status_code=409, detail="NPI already in use")

    if "password" in data:
        pw = data.pop("password")
        if pw:
            c.password_hash = hash_password(pw)

    for key, value in data.items():
        setattr(c, key, value)
    db.commit()
    db.refresh(c)
    return _serialize(c)


@router.delete("/{clinician_id}", status_code=204)
def delete_clinician(clinician_id: int, db: Session = Depends(get_db)):
    c = db.query(Clinician).get(clinician_id)
    if not c:
        raise HTTPException(status_code=404, detail="Clinician not found")
    db.delete(c)
    db.commit()
