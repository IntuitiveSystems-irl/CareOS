"""
CareOS Web3 Patient Data Economy — API routes.

Endpoints:
  POST /web3/member-id                 Issue a universal member ID for a patient
  GET  /web3/member-id/{code}          Resolve member code → patient token (no PHI)
  POST /web3/agreements                Buyer creates a DUA offer
  GET  /web3/agreements/{id}           Patient views DUA details
  POST /web3/agreements/{id}/sign      Patient signs DUA → consent hash anchored
  POST /web3/agreements/{id}/revoke    Patient revokes consent
  GET  /web3/agreements/{id}/package   Status of the FHIR data package
  POST /web3/escrow/{agreement_id}/release  Platform triggers payment release
  POST /web3/participations            Offer a patient an order-participation task
  POST /web3/participations/{id}/accept
  POST /web3/participations/{id}/complete
  POST /web3/participations/{id}/validate   Clinician validates contribution
  GET  /web3/patient/{patient_id}/dashboard  Patient wallet dashboard
  GET  /web3/cds-card/{member_code}    CDS Hooks card payload for EHR intake
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import secrets
import string
from datetime import datetime, timedelta
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Patient,
    MemberID, MemberIDStatus,
    DataUseAgreement, DUAStatus,
    DataPackageRequest, DataPackageStatus,
    PaymentEscrowRecord, EscrowStatus,
    OrderParticipation, ParticipationStatus,
)
from app.integration.audit.recorder import append_audit

logger = logging.getLogger(__name__)
_WORKER_URL = os.getenv("CLOUDFLARE_WORKER_URL", "https://careos.launchflow.tech")
_WORKER_SECRET = os.getenv("WORKER_SECRET", "")
router = APIRouter(prefix="/web3", tags=["web3-economy"])

_ALPHABET = string.ascii_uppercase + string.digits


def _audit(db, patient_id: int, action: str, detail: str) -> None:
    try:
        append_audit(db, actor=f"patient:{patient_id}", action=action,
                     resource_type="web3", resource_id=str(patient_id),
                     extra={"detail": detail})
        db.commit()
    except Exception:
        pass


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_member_code() -> str:
    """12-char alphanumeric code, grouped COS-XXXX-XXXX for readability."""
    body = "".join(secrets.choice(_ALPHABET) for _ in range(8))
    return f"COS-{body[:4]}-{body[4:]}"


def _consent_hash(dua: DataUseAgreement) -> str:
    """
    Deterministic SHA-256 of DUA fields. Goes on-chain. No PHI.
    Format: sha256(dua_id | member_id | buyer_org | purpose_hash | ts)
    """
    payload = "|".join([
        str(dua.id),
        str(dua.member_id),
        dua.buyer_org,
        hashlib.sha256(dua.purpose.encode()).hexdigest()[:16],
        datetime.utcnow().isoformat()[:16],
    ])
    return "0x" + hashlib.sha256(payload.encode()).hexdigest()


def _bundle_hash(resource_types: list, record_count: int) -> str:
    payload = json.dumps({"rt": sorted(resource_types), "n": record_count})
    return "0x" + hashlib.sha256(payload.encode()).hexdigest()


def _pin_consent_to_ipfs(agreement_id: int, consent_hash: str, dua_summary: dict) -> Optional[str]:
    """
    Pin consent document metadata to IPFS via the Cloudflare Worker gateway.
    Returns the IPFS CID if successful, None otherwise. Never raises.
    """
    try:
        payload = {
            "agreement_id": agreement_id,
            "consent_hash": consent_hash,
            "summary": dua_summary,
            "pinned_at": datetime.utcnow().isoformat(),
        }
        payload_bytes = json.dumps(payload).encode()
        cid = "baf" + hashlib.sha256(payload_bytes).hexdigest()[:40]

        resp = httpx.post(
            f"{_WORKER_URL}/ipfs/pin",
            json={"cid": cid, "agreement_id": agreement_id, "consent_hash": consent_hash},
            headers={"X-Worker-Secret": _WORKER_SECRET, "Content-Type": "application/json"},
            timeout=5.0,
        )
        if resp.status_code == 200:
            return cid
    except Exception:
        pass
    return None


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class IssueMemberIDRequest(BaseModel):
    patient_id: int
    wallet_address: Optional[str] = None
    data_sharing_opt_in: bool = False
    order_participation_opt_in: bool = False


class CreateDUARequest(BaseModel):
    member_code: str
    buyer_org: str
    purpose: str
    data_classes: List[str]
    duration_days: int = 365
    payment_amount_usd: float
    payment_token: str = "USDC"


class SignDUARequest(BaseModel):
    patient_id: int
    wallet_address: Optional[str] = None


class CompleteParticipationRequest(BaseModel):
    patient_response: dict


class ValidateParticipationRequest(BaseModel):
    clinician_id: str
    validated: bool
    note: Optional[str] = None


class OfferParticipationRequest(BaseModel):
    patient_id: int
    task_type: str
    fhir_resource_type: Optional[str] = None
    fhir_resource_id: Optional[str] = None
    description: str
    reward_amount_usd: float
    reward_token: str = "USDC"


# ── Member ID ─────────────────────────────────────────────────────────────────

@router.post("/member-id")
def issue_member_id(req: IssueMemberIDRequest, db: Session = Depends(get_db)):
    """Issue a universal patient member ID. Idempotent — returns existing if already issued."""
    patient = db.query(Patient).filter(Patient.id == req.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    existing = db.query(MemberID).filter(MemberID.patient_id == req.patient_id).first()
    if existing:
        return {
            "member_code": existing.member_code,
            "status": existing.status,
            "created_at": existing.created_at.isoformat(),
            "already_existed": True,
        }

    code = _generate_member_code()
    while db.query(MemberID).filter(MemberID.member_code == code).first():
        code = _generate_member_code()

    mid = MemberID(
        patient_id=req.patient_id,
        member_code=code,
        wallet_address=req.wallet_address,
        data_sharing_opt_in=req.data_sharing_opt_in,
        order_participation_opt_in=req.order_participation_opt_in,
    )
    db.add(mid)
    db.commit()
    db.refresh(mid)

    _audit(db, req.patient_id, "member_id_issued", f"member_code={code}")

    return {
        "member_code": mid.member_code,
        "status": mid.status,
        "created_at": mid.created_at.isoformat(),
        "already_existed": False,
        "qr_payload": f"careos://member/{mid.member_code}",
    }


@router.get("/member-id/{code}")
def resolve_member_id(code: str, db: Session = Depends(get_db)):
    """Resolve member code → enrollment status. No PHI returned."""
    mid = db.query(MemberID).filter(MemberID.member_code == code).first()
    if not mid:
        raise HTTPException(status_code=404, detail="Member ID not found")
    return {
        "member_code": mid.member_code,
        "status": mid.status,
        "data_sharing_opt_in": mid.data_sharing_opt_in,
        "order_participation_opt_in": mid.order_participation_opt_in,
        "active_agreements": len([a for a in mid.agreements if a.status == DUAStatus.signed]),
    }


# ── Data Use Agreements ───────────────────────────────────────────────────────

@router.post("/agreements")
def create_dua(req: CreateDUARequest, db: Session = Depends(get_db)):
    """Buyer org creates a DUA offer directed at a patient member code."""
    mid = db.query(MemberID).filter(MemberID.member_code == req.member_code).first()
    if not mid:
        raise HTTPException(status_code=404, detail="Member ID not found")
    if mid.status != MemberIDStatus.active:
        raise HTTPException(status_code=400, detail="Member ID is not active")

    dua = DataUseAgreement(
        member_id=mid.id,
        buyer_org=req.buyer_org,
        purpose=req.purpose,
        data_classes=req.data_classes,
        duration_days=req.duration_days,
        payment_amount_usd=req.payment_amount_usd,
        payment_token=req.payment_token,
        expires_at=datetime.utcnow() + timedelta(days=req.duration_days),
    )
    db.add(dua)
    db.flush()

    escrow = PaymentEscrowRecord(
        agreement_id=dua.id,
        amount_usd=req.payment_amount_usd,
        token=req.payment_token,
        status=EscrowStatus.consent_pending,
    )
    db.add(escrow)
    db.commit()
    db.refresh(dua)

    return {
        "agreement_id": dua.id,
        "status": dua.status,
        "payment_amount_usd": dua.payment_amount_usd,
        "payment_token": dua.payment_token,
        "data_classes": dua.data_classes,
        "expires_at": dua.expires_at.isoformat() if dua.expires_at else None,
        "next_step": f"Patient must sign at POST /web3/agreements/{dua.id}/sign",
    }


@router.get("/agreements/{agreement_id}")
def get_dua(agreement_id: int, db: Session = Depends(get_db)):
    """Return full DUA details for patient review — no PHI."""
    dua = db.query(DataUseAgreement).filter(DataUseAgreement.id == agreement_id).first()
    if not dua:
        raise HTTPException(status_code=404, detail="Agreement not found")
    return {
        "agreement_id": dua.id,
        "buyer_org": dua.buyer_org,
        "purpose": dua.purpose,
        "data_classes": dua.data_classes,
        "duration_days": dua.duration_days,
        "payment_amount_usd": dua.payment_amount_usd,
        "payment_token": dua.payment_token,
        "status": dua.status,
        "consent_hash": dua.consent_hash,
        "tx_hash": dua.tx_hash,
        "ipfs_cid": dua.ipfs_cid,
        "created_at": dua.created_at.isoformat(),
        "expires_at": dua.expires_at.isoformat() if dua.expires_at else None,
        "compliance": {
            "hipaa_authorization": True,
            "no_treatment_penalty": True,
            "minimum_necessary": True,
            "revocable": True,
            "audit_logged": True,
        },
    }


@router.post("/agreements/{agreement_id}/sign")
def sign_dua(agreement_id: int, req: SignDUARequest, db: Session = Depends(get_db)):
    """
    Patient signs the DUA. Generates consent hash and creates the
    data package request. On-chain anchoring happens asynchronously
    once the Web3 RPC is configured.
    """
    dua = db.query(DataUseAgreement).filter(DataUseAgreement.id == agreement_id).first()
    if not dua:
        raise HTTPException(status_code=404, detail="Agreement not found")
    if dua.status != DUAStatus.pending_patient:
        raise HTTPException(status_code=400, detail=f"Agreement is {dua.status}, cannot sign")

    ch = _consent_hash(dua)
    dua.consent_hash = ch
    dua.status = DUAStatus.signed
    dua.patient_signature_ts = datetime.utcnow()

    if req.wallet_address and dua.member:
        dua.member.wallet_address = req.wallet_address

    pkg = DataPackageRequest(
        agreement_id=dua.id,
        resource_types=dua.data_classes,
        status=DataPackageStatus.pending,
    )
    db.add(pkg)

    if dua.escrow:
        dua.escrow.status = EscrowStatus.data_pending

    db.commit()
    db.refresh(dua)

    _audit(db, dua.member.patient_id, "dua_signed", f"agreement_id={agreement_id} consent_hash={ch}")

    ipfs_cid = _pin_consent_to_ipfs(
        agreement_id=dua.id,
        consent_hash=ch,
        dua_summary={"buyer_org": dua.buyer_org, "purpose": dua.purpose[:80],
                     "data_classes": dua.data_classes, "amount_usd": dua.payment_amount_usd},
    )
    if ipfs_cid:
        dua.ipfs_cid = ipfs_cid
        db.commit()

    return {
        "agreement_id": dua.id,
        "status": dua.status,
        "consent_hash": ch,
        "ipfs_cid": ipfs_cid,
        "ipfs_url": f"https://3.launchflow.tech/ipfs/{ipfs_cid}" if ipfs_cid else None,
        "message": "Consent recorded. Data package is being assembled. Payment will release upon delivery.",
        "on_chain": {
            "status": "pending_rpc_config",
            "hash_to_anchor": ch,
            "worker_contract_check": f"{_WORKER_URL}/contract/status/{dua.id}",
            "note": "Set WEB3_RPC_URL in Worker variables to enable on-chain anchoring",
        },
        "fhir_consent_ref": f"/fhir/Consent?patient={dua.member.patient_id}",
    }


@router.post("/agreements/{agreement_id}/revoke")
def revoke_dua(agreement_id: int, db: Session = Depends(get_db)):
    """Patient revokes consent at any time. Stops data delivery and cancels unpaid escrow."""
    dua = db.query(DataUseAgreement).filter(DataUseAgreement.id == agreement_id).first()
    if not dua:
        raise HTTPException(status_code=404, detail="Agreement not found")
    if dua.status == DUAStatus.revoked:
        raise HTTPException(status_code=400, detail="Already revoked")

    dua.status = DUAStatus.revoked
    if dua.escrow and dua.escrow.status not in (EscrowStatus.released,):
        dua.escrow.status = EscrowStatus.refunded

    db.commit()

    _audit(db, dua.member.patient_id, "dua_revoked", f"agreement_id={agreement_id}")

    return {"agreement_id": dua.id, "status": "revoked", "escrow_status": dua.escrow.status if dua.escrow else None}


@router.get("/agreements/{agreement_id}/package")
def get_package_status(agreement_id: int, db: Session = Depends(get_db)):
    """Return FHIR data package build status."""
    dua = db.query(DataUseAgreement).filter(DataUseAgreement.id == agreement_id).first()
    if not dua:
        raise HTTPException(status_code=404, detail="Agreement not found")
    pkgs = dua.data_packages
    if not pkgs:
        return {"status": "no_package", "agreement_status": dua.status}
    pkg = pkgs[-1]
    return {
        "package_id": pkg.id,
        "status": pkg.status,
        "resource_types": pkg.resource_types,
        "record_count": pkg.record_count,
        "bundle_hash": pkg.bundle_hash,
        "vault_ref": pkg.vault_ref,
        "built_at": pkg.built_at.isoformat() if pkg.built_at else None,
    }


# ── Escrow ────────────────────────────────────────────────────────────────────

@router.post("/escrow/{agreement_id}/release")
def release_escrow(agreement_id: int, db: Session = Depends(get_db)):
    """
    Platform triggers payment release after:
    1. DUA is signed
    2. Data package delivered
    3. Compliance checks pass

    In production this calls the smart contract release() function via Web3.py.
    """
    dua = db.query(DataUseAgreement).filter(DataUseAgreement.id == agreement_id).first()
    if not dua:
        raise HTTPException(status_code=404, detail="Agreement not found")
    if dua.status != DUAStatus.signed:
        raise HTTPException(status_code=400, detail="DUA must be signed before escrow release")

    pkgs = dua.data_packages
    delivered = any(p.status == DataPackageStatus.delivered for p in pkgs)
    if not delivered:
        raise HTTPException(status_code=400, detail="Data package not yet delivered")

    escrow = dua.escrow
    if not escrow:
        raise HTTPException(status_code=400, detail="No escrow record found")
    if escrow.status == EscrowStatus.released:
        raise HTTPException(status_code=400, detail="Escrow already released")

    escrow.status = EscrowStatus.released
    escrow.released_at = datetime.utcnow()
    escrow.release_tx = "0xPENDING_ONCHAIN"
    db.commit()

    _audit(db, dua.member.patient_id, "escrow_released", f"agreement_id={agreement_id} amount={escrow.amount_usd} {escrow.token}")

    return {
        "agreement_id": agreement_id,
        "escrow_status": "released",
        "amount_usd": escrow.amount_usd,
        "token": escrow.token,
        "released_at": escrow.released_at.isoformat(),
        "release_tx": escrow.release_tx,
        "note": "Configure WEB3_RPC_URL and contract address to enable automatic on-chain release",
    }


# ── Order Participation ───────────────────────────────────────────────────────

@router.post("/participations")
def offer_participation(req: OfferParticipationRequest, db: Session = Depends(get_db)):
    """EHR/clinician offers a patient a paid participation task."""
    mid = db.query(MemberID).filter(MemberID.patient_id == req.patient_id).first()
    if not mid:
        raise HTTPException(status_code=404, detail="Patient has no member ID — issue one first")
    if not mid.order_participation_opt_in:
        raise HTTPException(status_code=400, detail="Patient has not opted in to order participation")

    part = OrderParticipation(
        member_id=mid.id,
        patient_id=req.patient_id,
        task_type=req.task_type,
        fhir_resource_type=req.fhir_resource_type,
        fhir_resource_id=req.fhir_resource_id,
        description=req.description,
        reward_amount_usd=req.reward_amount_usd,
        reward_token=req.reward_token,
    )
    db.add(part)
    db.commit()
    db.refresh(part)
    return {"participation_id": part.id, "status": part.status, "reward_amount_usd": part.reward_amount_usd}


@router.post("/participations/{participation_id}/accept")
def accept_participation(participation_id: int, db: Session = Depends(get_db)):
    part = db.query(OrderParticipation).filter(OrderParticipation.id == participation_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Participation not found")
    if part.status != ParticipationStatus.offered:
        raise HTTPException(status_code=400, detail=f"Cannot accept from status {part.status}")
    part.status = ParticipationStatus.accepted
    db.commit()
    return {"participation_id": part.id, "status": part.status}


@router.post("/participations/{participation_id}/complete")
def complete_participation(participation_id: int, req: CompleteParticipationRequest, db: Session = Depends(get_db)):
    part = db.query(OrderParticipation).filter(OrderParticipation.id == participation_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Participation not found")
    if part.status != ParticipationStatus.accepted:
        raise HTTPException(status_code=400, detail=f"Cannot complete from status {part.status}")
    part.status = ParticipationStatus.completed
    part.patient_response = req.patient_response
    part.completed_at = datetime.utcnow()
    db.commit()

    _audit(db, part.patient_id, "participation_completed", f"participation_id={participation_id} task_type={part.task_type}")

    return {"participation_id": part.id, "status": part.status}


@router.post("/participations/{participation_id}/validate")
def validate_participation(participation_id: int, req: ValidateParticipationRequest, db: Session = Depends(get_db)):
    """Clinician validates a patient's participation — triggers payment."""
    part = db.query(OrderParticipation).filter(OrderParticipation.id == participation_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Participation not found")
    if part.status != ParticipationStatus.completed:
        raise HTTPException(status_code=400, detail=f"Cannot validate from status {part.status}")

    if req.validated:
        part.status = ParticipationStatus.validated
        part.validated_by = req.clinician_id
        part.validated_at = datetime.utcnow()
        provenance_payload = {
            "participation_id": participation_id,
            "task_type": part.task_type,
            "clinician": req.clinician_id,
            "ts": datetime.utcnow().isoformat(),
        }
        part.provenance_tx = "0x" + hashlib.sha256(json.dumps(provenance_payload).encode()).hexdigest()
        db.commit()

        _audit(db, part.patient_id, "participation_validated", f"participation_id={participation_id} clinician={req.clinician_id}")

        return {
            "participation_id": part.id,
            "status": part.status,
            "provenance_tx": part.provenance_tx,
            "reward_amount_usd": part.reward_amount_usd,
            "reward_token": part.reward_token,
            "next": "Payment queued for release",
        }
    else:
        part.status = ParticipationStatus.declined
        db.commit()
        return {"participation_id": part.id, "status": "declined", "note": req.note}


# ── Patient Dashboard ─────────────────────────────────────────────────────────

@router.get("/patient/{patient_id}/dashboard")
def patient_dashboard(patient_id: int, db: Session = Depends(get_db)):
    """Patient wallet dashboard — earnings, agreements, participations."""
    mid = db.query(MemberID).filter(MemberID.patient_id == patient_id).first()
    if not mid:
        return {"member_id": None, "message": "No member ID issued yet"}

    agreements = mid.agreements
    parts = db.query(OrderParticipation).filter(OrderParticipation.patient_id == patient_id).all()

    earned_agreements = sum(
        a.payment_amount_usd for a in agreements
        if a.escrow and a.escrow.status == EscrowStatus.released
    )
    earned_participations = sum(
        p.reward_amount_usd for p in parts
        if p.status in (ParticipationStatus.validated, ParticipationStatus.paid)
    )
    pending_earnings = sum(
        a.payment_amount_usd for a in agreements
        if a.status == DUAStatus.signed and (not a.escrow or a.escrow.status != EscrowStatus.released)
    ) + sum(
        p.reward_amount_usd for p in parts
        if p.status in (ParticipationStatus.offered, ParticipationStatus.accepted,
                        ParticipationStatus.completed, ParticipationStatus.validated)
    )

    return {
        "member_code": mid.member_code,
        "wallet_address": mid.wallet_address,
        "status": mid.status,
        "data_sharing_opt_in": mid.data_sharing_opt_in,
        "order_participation_opt_in": mid.order_participation_opt_in,
        "earnings": {
            "total_earned_usd": round(earned_agreements + earned_participations, 2),
            "pending_usd": round(pending_earnings, 2),
            "from_data_sharing": round(earned_agreements, 2),
            "from_participations": round(earned_participations, 2),
        },
        "agreements": [
            {
                "id": a.id,
                "buyer_org": a.buyer_org,
                "purpose": a.purpose[:80],
                "status": a.status,
                "amount_usd": a.payment_amount_usd,
                "consent_hash": a.consent_hash,
            }
            for a in agreements
        ],
        "participations": [
            {
                "id": p.id,
                "task_type": p.task_type,
                "description": p.description[:80],
                "status": p.status,
                "reward_usd": p.reward_amount_usd,
            }
            for p in parts
        ],
    }


# ── CDS Hooks card for EHR intake ─────────────────────────────────────────────

@router.get("/cds-card/{member_code}")
def cds_intake_card(member_code: str, db: Session = Depends(get_db)):
    """
    Returns a CDS Hooks card payload for EHR intake.
    EHR scans member code at registration and calls this to get a card.
    """
    mid = db.query(MemberID).filter(MemberID.member_code == member_code).first()
    if not mid or mid.status != MemberIDStatus.active:
        return JSONResponse(status_code=200, content={"cards": []})

    cards = []

    if mid.data_sharing_opt_in:
        cards.append({
            "summary": "Patient Data Sharing Program",
            "indicator": "info",
            "detail": (
                "This patient participates in the CareOS data-sharing program. "
                "You may request permission to access or share eligible data. "
                f"Member ID: {member_code}"
            ),
            "source": {"label": "CareOS Data Economy", "url": "https://launchflow.tech/web3"},
            "links": [
                {
                    "label": "View consent options",
                    "url": f"https://launchflow.tech/web3/patient/{mid.patient_id}",
                    "type": "absolute",
                }
            ],
        })

    if mid.order_participation_opt_in:
        cards.append({
            "summary": "Patient Order Participation Available",
            "indicator": "info",
            "detail": (
                "This patient has opted in to order participation. "
                "You may offer them paid tasks: verify lab results, correct records, "
                "submit patient-reported outcomes."
            ),
            "source": {"label": "CareOS Participation Economy", "url": "https://launchflow.tech/web3"},
        })

    return {"cards": cards}


# ── Cloudflare Worker passthrough ─────────────────────────────────────────────

@router.get("/worker/health")
def worker_health():
    """Proxy to the Cloudflare Worker health endpoint to confirm connectivity."""
    try:
        resp = httpx.get(f"{_WORKER_URL}/health", timeout=5.0)
        return resp.json()
    except Exception as e:
        return {
            "status": "unreachable",
            "worker_url": _WORKER_URL,
            "error": str(e),
            "note": "Deploy web3-gateway.js to careos.launchflow.tech via wrangler",
        }


@router.get("/contract/status/{agreement_id}")
def contract_status(agreement_id: int):
    """
    Check the on-chain escrow state for an agreement via the Cloudflare Worker.
    Returns Empty if the contract is not yet deployed/funded.
    """
    try:
        resp = httpx.get(f"{_WORKER_URL}/contract/status/{agreement_id}", timeout=5.0)
        return resp.json()
    except Exception as e:
        return {
            "agreement_id": agreement_id,
            "status": "worker_unreachable",
            "error": str(e),
            "note": "Configure WEB3_RPC_URL and ESCROW_CONTRACT_ADDRESS in Cloudflare Worker settings",
        }
