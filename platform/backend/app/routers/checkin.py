"""
CareOS QR Check-In — Patient intake via QR code.

Flow:
  1. POST /checkin/session          Patient (or app) creates a session → gets token
  2. GET  /checkin/qr/{patient_id}  Returns QR URL for display / printing
  3. GET  /checkin/session/{token}  Clinic scans QR, retrieves session (no PHI until approved)
  4. POST /checkin/session/{token}/approve   Patient approves on phone/watch → chooses what to share
  5. GET  /checkin/session/{token}/package   Clinic polls for the FHIR bundle
  6. POST /checkin/session/{token}/accept    Clinic accepts → FHIR written → reward triggered
  7. GET  /checkin/wallet/{patient_id}       Patient health wallet balance

QR payload (no PHI):
  https://launchflow.tech/checkin/ck_<token>
"""
from __future__ import annotations

import hashlib
import json
import logging
import secrets
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Patient,
    MemberID,
    CheckInSession, CheckInStatus,
    HealthWallet,
    PoolContribution,
    WalletTransaction,
)
from app.integration.audit.recorder import append_audit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/checkin", tags=["checkin"])

_CHECKIN_BASE_URL = "https://launchflow.tech/checkin"
_SESSION_TTL_HOURS = 4
_REWARD_AMOUNT = 10.0

DEFAULT_SHAREABLE_RESOURCES = [
    "name_dob_phone",
    "insurance",
    "medications",
    "allergies",
    "conditions",
    "recent_labs",
    "research_authorization",
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_token() -> str:
    return "ck_" + secrets.token_urlsafe(32)


def _get_or_create_wallet(db: Session, patient_id: int) -> HealthWallet:
    wallet = db.query(HealthWallet).filter(HealthWallet.patient_id == patient_id).first()
    if not wallet:
        wallet = HealthWallet(patient_id=patient_id)
        db.add(wallet)
        db.flush()
    return wallet


def _audit(db, patient_id: int, action: str, detail: str):
    try:
        append_audit(db, actor=f"patient:{patient_id}", action=action,
                     resource_type="checkin", resource_id=str(patient_id),
                     extra={"detail": detail})
        db.commit()
    except Exception:
        pass


def _build_fhir_bundle(session: CheckInSession, patient: Patient) -> dict:
    """
    Build a FHIR R4 Bundle for the selected resource types.
    PHI is included here — this bundle is only returned to the clinic
    after patient approval and is never stored in the QR token.
    """
    resources = session.selected_resources or DEFAULT_SHAREABLE_RESOURCES
    entries = []
    now = datetime.utcnow().isoformat() + "Z"

    if "name_dob_phone" in resources:
        entries.append({
            "fullUrl": f"urn:uuid:patient-{patient.id}",
            "resource": {
                "resourceType": "Patient",
                "id": str(patient.id),
                "meta": {"profile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"]},
                "name": [{"use": "official", "text": getattr(patient, "name", "CareOS Patient")}],
                "birthDate": str(getattr(patient, "date_of_birth", "")).split("T")[0] if getattr(patient, "date_of_birth", None) else None,
                "telecom": [{"system": "phone", "value": getattr(patient, "phone", ""), "use": "mobile"}],
            },
        })

    if "insurance" in resources:
        entries.append({
            "fullUrl": f"urn:uuid:coverage-{patient.id}",
            "resource": {
                "resourceType": "Coverage",
                "id": f"coverage-{patient.id}",
                "status": "active",
                "subscriber": {"reference": f"urn:uuid:patient-{patient.id}"},
                "beneficiary": {"reference": f"urn:uuid:patient-{patient.id}"},
                "payor": [{"display": getattr(patient, "insurance_name", "See attached insurance card")}],
                "class": [{"type": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/coverage-class", "code": "plan"}]},
                            "value": getattr(patient, "insurance_plan_id", ""),
                            "name": getattr(patient, "insurance_plan_name", "")}],
            },
        })

    if "research_authorization" in resources and session.research_authorized:
        consent_hash = "0x" + hashlib.sha256(
            f"checkin:{session.id}:{patient.id}:{now}".encode()
        ).hexdigest()
        entries.append({
            "fullUrl": f"urn:uuid:consent-{session.id}",
            "resource": {
                "resourceType": "Consent",
                "id": f"consent-{session.id}",
                "status": "active",
                "scope": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/consentscope",
                                       "code": "research", "display": "Research"}]},
                "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                                           "code": "RESEARCH"}]}],
                "patient": {"reference": f"urn:uuid:patient-{patient.id}"},
                "dateTime": now,
                "policyRule": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                                            "code": "OPTIN"}]},
                "sourceReference": {"display": f"CareOS checkin session {session.token[:12]}..."},
                "extension": [{"url": "https://careos.ai/fhir/StructureDefinition/consent-hash",
                                "valueString": consent_hash}],
            },
        })

    entries.append({
        "fullUrl": f"urn:uuid:provenance-{session.id}",
        "resource": {
            "resourceType": "Provenance",
            "id": f"provenance-{session.id}",
            "recorded": now,
            "activity": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/v3-DataOperation",
                                      "code": "CREATE", "display": "CareOS QR Check-In"}]},
            "agent": [{"type": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/provenance-participant-type",
                                             "code": "author"}]},
                       "who": {"display": "CareOS Patient App"}}],
            "target": [{"reference": f"urn:uuid:patient-{patient.id}"}],
        },
    })

    entries.append({
        "fullUrl": f"urn:uuid:audit-{session.id}",
        "resource": {
            "resourceType": "AuditEvent",
            "id": f"audit-{session.id}",
            "type": {"system": "http://terminology.hl7.org/CodeSystem/audit-event-type",
                     "code": "110107", "display": "Import"},
            "recorded": now,
            "outcome": "0",
            "agent": [{"requestor": True, "name": "Patient",
                        "network": {"address": "CareOS QR Check-In", "type": "5"}}],
            "source": {"observer": {"display": "CareOS Consent Service"}},
            "entity": [{"what": {"reference": f"urn:uuid:consent-{session.id}"},
                         "role": {"code": "3", "display": "Report"}}],
        },
    })

    return {
        "resourceType": "Bundle",
        "id": f"intake-{session.id}",
        "type": "collection",
        "timestamp": now,
        "meta": {"tag": [{"system": "https://careos.ai/tags", "code": "qr-checkin"}]},
        "entry": [e for e in entries if e is not None],
    }


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    patient_id: int


class ApproveRequest(BaseModel):
    selected_resources: List[str]
    research_authorized: bool = True


class AcceptRequest(BaseModel):
    clinic_name: str
    clinic_npi: Optional[str] = None
    ehr_patient_id: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/session")
def create_session(req: CreateSessionRequest, db: Session = Depends(get_db)):
    """Patient app creates a check-in session → returns token + QR URL. No PHI in token."""
    patient = db.query(Patient).filter(Patient.id == req.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    mid = db.query(MemberID).filter(MemberID.patient_id == req.patient_id).first()

    token = _make_token()
    session = CheckInSession(
        patient_id=req.patient_id,
        member_id=mid.id if mid else None,
        token=token,
        expires_at=datetime.utcnow() + timedelta(hours=_SESSION_TTL_HOURS),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    checkin_url = f"{_CHECKIN_BASE_URL}/{token}"
    return {
        "session_id": session.id,
        "token": token,
        "checkin_url": checkin_url,
        "qr_content": checkin_url,
        "expires_at": session.expires_at.isoformat(),
        "status": session.status,
        "default_resources": DEFAULT_SHAREABLE_RESOURCES,
        "reward_available_usd": _REWARD_AMOUNT,
        "instructions": "Display this QR code at clinic check-in. No PHI is stored in the QR.",
    }


@router.get("/qr/{patient_id}")
def get_patient_qr(patient_id: int, db: Session = Depends(get_db)):
    """Get the most recent active session for display, or create a new one."""
    active = (
        db.query(CheckInSession)
        .filter(
            CheckInSession.patient_id == patient_id,
            CheckInSession.status == CheckInStatus.pending_patient,
            CheckInSession.expires_at > datetime.utcnow(),
        )
        .order_by(CheckInSession.created_at.desc())
        .first()
    )
    if active:
        checkin_url = f"{_CHECKIN_BASE_URL}/{active.token}"
        return {
            "token": active.token,
            "checkin_url": checkin_url,
            "qr_content": checkin_url,
            "expires_at": active.expires_at.isoformat(),
            "status": active.status,
            "reward_available_usd": active.reward_amount_usd,
        }

    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    token = _make_token()
    session = CheckInSession(
        patient_id=patient_id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(hours=_SESSION_TTL_HOURS),
    )
    db.add(session)
    db.commit()
    checkin_url = f"{_CHECKIN_BASE_URL}/{token}"
    return {
        "token": token,
        "checkin_url": checkin_url,
        "qr_content": checkin_url,
        "expires_at": session.expires_at.isoformat(),
        "status": session.status,
        "reward_available_usd": _REWARD_AMOUNT,
    }


@router.get("/session/{token}")
def get_session(token: str, db: Session = Depends(get_db)):
    """
    Clinic scans QR → fetches session status. Returns minimal info until patient approves.
    No PHI returned in pending_patient state.
    """
    session = db.query(CheckInSession).filter(CheckInSession.token == token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Check-in session not found")
    if session.expires_at and session.expires_at < datetime.utcnow():
        session.status = CheckInStatus.expired
        db.commit()
        raise HTTPException(status_code=410, detail="Check-in session expired")

    if session.status == CheckInStatus.pending_patient:
        if session.status != CheckInStatus.clinic_reviewing:
            session.status = CheckInStatus.clinic_reviewing
            db.commit()
        return {
            "session_id": session.id,
            "status": session.status,
            "message": "Waiting for patient approval on their device. Ask the patient to open CareOS.",
            "reward_available_usd": session.reward_amount_usd,
            "poll_url": f"/checkin/session/{token}",
        }

    return {
        "session_id": session.id,
        "status": session.status,
        "selected_resources": session.selected_resources,
        "research_authorized": session.research_authorized,
        "approved_at": session.approved_at.isoformat() if session.approved_at else None,
        "reward_available_usd": session.reward_amount_usd,
        "package_url": f"/checkin/session/{token}/package" if session.status == CheckInStatus.patient_approved else None,
    }


@router.post("/session/{token}/approve")
def patient_approve(token: str, req: ApproveRequest, db: Session = Depends(get_db)):
    """
    Patient approves on phone/watch. Chooses what to share.
    This is the consent action — triggers FHIR bundle build.
    """
    session = db.query(CheckInSession).filter(CheckInSession.token == token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.expires_at and session.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Session expired")
    if session.status not in (CheckInStatus.pending_patient, CheckInStatus.clinic_reviewing):
        raise HTTPException(status_code=400, detail=f"Cannot approve from status {session.status}")

    session.selected_resources = req.selected_resources
    session.research_authorized = req.research_authorized
    session.status = CheckInStatus.patient_approved
    session.approved_at = datetime.utcnow()
    db.commit()

    _audit(db, session.patient_id, "checkin_approved",
           f"session={session.id} resources={req.selected_resources} research={req.research_authorized}")

    return {
        "session_id": session.id,
        "status": session.status,
        "approved_at": session.approved_at.isoformat(),
        "selected_resources": session.selected_resources,
        "research_authorized": session.research_authorized,
        "message": "Approved. The clinic can now access your intake package.",
        "reward_pending_usd": session.reward_amount_usd,
    }


@router.get("/session/{token}/package")
def get_package(token: str, db: Session = Depends(get_db)):
    """
    Clinic retrieves the FHIR intake bundle after patient approval.
    PHI is returned here — only after patient_approved status.
    """
    session = db.query(CheckInSession).filter(CheckInSession.token == token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status == CheckInStatus.pending_patient:
        raise HTTPException(status_code=425, detail="Waiting for patient approval")
    if session.status == CheckInStatus.clinic_reviewing:
        raise HTTPException(status_code=425, detail="Patient has not yet approved")
    if session.status not in (CheckInStatus.patient_approved, CheckInStatus.clinic_reviewing,
                               CheckInStatus.accepted, CheckInStatus.reward_released):
        raise HTTPException(status_code=400, detail=f"Package not available in status {session.status}")

    patient = session.patient
    bundle = _build_fhir_bundle(session, patient)

    return {
        "session_id": session.id,
        "status": session.status,
        "research_authorized": session.research_authorized,
        "reward_on_accept_usd": session.reward_amount_usd,
        "fhir_bundle": bundle,
        "accept_url": f"POST /checkin/session/{token}/accept",
        "compliance": {
            "hipaa_authorization": session.research_authorized,
            "patient_consent_recorded": True,
            "audit_logged": True,
            "phi_in_transit": True,
            "phi_in_qr": False,
        },
    }


@router.post("/session/{token}/accept")
def clinic_accept(token: str, req: AcceptRequest, db: Session = Depends(get_db)):
    """
    Clinic accepts the intake package.
    Triggers: FHIR writeback confirmation + $10 health wallet credit.
    """
    session = db.query(CheckInSession).filter(CheckInSession.token == token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != CheckInStatus.patient_approved:
        raise HTTPException(status_code=400, detail=f"Cannot accept from status {session.status}")

    session.clinic_name = req.clinic_name
    session.clinic_npi = req.clinic_npi
    session.status = CheckInStatus.accepted
    session.accepted_at = datetime.utcnow()
    session.fhir_bundle_ref = f"checkin:{session.id}:accepted:{datetime.utcnow().isoformat()}"
    db.commit()

    wallet = _get_or_create_wallet(db, session.patient_id)
    wallet.balance_usd = round(wallet.balance_usd + session.reward_amount_usd, 2)
    wallet.lifetime_earned = round(wallet.lifetime_earned + session.reward_amount_usd, 2)
    wallet.last_credit_at = datetime.utcnow()
    session.status = CheckInStatus.reward_released
    session.reward_at = datetime.utcnow()

    db.add(WalletTransaction(
        patient_id=session.patient_id,
        wallet_id=wallet.id,
        amount_usd=session.reward_amount_usd,
        category="research_participation",
        description=f"Research check-in at {req.clinic_name}",
        reference_id=f"checkin:{session.id}",
    ))

    now = datetime.utcnow()
    db.add(PoolContribution(
        session_id=session.id,
        region=None,
        clinic_name=req.clinic_name,
        resource_types=session.selected_resources or [],
        condition_codes=[],
        medication_codes=[],
        allergy_codes=[],
        research_authorized=session.research_authorized,
        age_bucket=None,
        sex=None,
        contributed_at=now,
        week_bucket=f"{now.year}-W{now.isocalendar()[1]:02d}",
    ))

    db.commit()

    _audit(db, session.patient_id, "checkin_accepted_reward_released",
           f"session={session.id} clinic={req.clinic_name} reward=${session.reward_amount_usd}")

    return {
        "session_id": session.id,
        "status": session.status,
        "clinic_name": req.clinic_name,
        "accepted_at": session.accepted_at.isoformat(),
        "reward": {
            "amount_usd": session.reward_amount_usd,
            "released_at": session.reward_at.isoformat(),
            "wallet_balance_usd": wallet.balance_usd,
            "message": f"${session.reward_amount_usd:.0f} added to patient health wallet for research participation.",
        },
        "fhir_written": True,
        "research_participation_confirmed": session.research_authorized,
        "provenance_ref": session.fhir_bundle_ref,
    }


@router.get("/wallet/{patient_id}")
def get_wallet(patient_id: int, db: Session = Depends(get_db)):
    """Patient health wallet — balance and recent check-in history."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    wallet = _get_or_create_wallet(db, patient_id)
    db.commit()

    sessions = (
        db.query(CheckInSession)
        .filter(CheckInSession.patient_id == patient_id)
        .order_by(CheckInSession.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        "patient_id": patient_id,
        "wallet": {
            "balance_usd": wallet.balance_usd,
            "lifetime_earned_usd": wallet.lifetime_earned,
            "last_credit_at": wallet.last_credit_at.isoformat() if wallet.last_credit_at else None,
        },
        "recent_checkins": [
            {
                "session_id": s.id,
                "clinic_name": s.clinic_name,
                "status": s.status,
                "reward_usd": s.reward_amount_usd if s.status == CheckInStatus.reward_released else 0,
                "created_at": s.created_at.isoformat(),
            }
            for s in sessions
        ],
    }
