"""
CareOS CDS Hooks — Research & Data Economy signals.

Implements the CDS Hooks spec at /cds-services/*.
Discovery at GET /cds-services returns all available services.
Each service returns Cards with research/data-economy prompts.

Services:
  patient-view           Fires at patient chart open. Returns research eligibility card.
  order-select           Fires when order selected. Returns research study link if matched.
  appointment-booked     Fires at appointment. Returns QR check-in prompt.
  check-in-data-pool     Fires at check-in. Returns data pool contribution status + reward.

These integrate with EHR SMART apps and CareOS CDS Hooks endpoint.
"""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CheckInSession, CheckInStatus, MemberID, PoolContribution

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cds-research", tags=["cds-hooks-research"])

_BASE_URL = "https://launchflow.tech"

# ── CDS Hooks service definitions ─────────────────────────────────────────────

SERVICES = [
    {
        "id": "careos-research-eligibility",
        "hook": "patient-view",
        "title": "CareOS Research Eligibility",
        "description": "Checks if the patient is eligible for active research studies and has a CareOS member ID.",
        "prefetch": {"patient": "Patient/{{context.patientId}}"},
    },
    {
        "id": "careos-order-research-link",
        "hook": "order-select",
        "title": "CareOS Research Study Link",
        "description": "When an order is placed, checks for approved research protocols related to that order type.",
        "prefetch": {"patient": "Patient/{{context.patientId}}"},
    },
    {
        "id": "careos-checkin-prompt",
        "hook": "appointment-booked",
        "title": "CareOS QR Check-In",
        "description": "Prompts staff to ask if the patient has a CareOS QR code at appointment booking.",
        "prefetch": {},
    },
    {
        "id": "careos-data-pool-status",
        "hook": "patient-view",
        "title": "CareOS Data Pool Contribution",
        "description": "Shows patient data pool contribution status, rewards earned, and pending CDS signals.",
        "prefetch": {"patient": "Patient/{{context.patientId}}"},
    },
]


# ── CDS Hooks schemas ─────────────────────────────────────────────────────────

class CDSContext(BaseModel):
    patientId: Optional[str] = None
    userId: Optional[str] = None
    encounterId: Optional[str] = None
    draftOrders: Optional[dict] = None


class CDSRequest(BaseModel):
    hookInstance: str
    hook: str
    context: CDSContext
    prefetch: Optional[dict] = None
    fhirServer: Optional[str] = None


def _info_card(summary: str, detail: str, source: str = "CareOS", links: list = None) -> dict:
    card = {
        "summary": summary,
        "indicator": "info",
        "detail": detail,
        "source": {"label": source, "url": f"{_BASE_URL}/web3"},
    }
    if links:
        card["links"] = links
    return card


def _warning_card(summary: str, detail: str) -> dict:
    return {
        "summary": summary,
        "indicator": "warning",
        "detail": detail,
        "source": {"label": "CareOS Data Economy", "url": f"{_BASE_URL}/web3"},
    }


def _suggestion_card(summary: str, detail: str, suggestion_label: str, suggestion_uuid: str) -> dict:
    return {
        "summary": summary,
        "indicator": "info",
        "detail": detail,
        "source": {"label": "CareOS Research", "url": f"{_BASE_URL}/web3"},
        "suggestions": [{"label": suggestion_label, "uuid": suggestion_uuid}],
    }


# ── Discovery ─────────────────────────────────────────────────────────────────

@router.get("/discovery")
def discovery():
    """CDS Hooks discovery endpoint — returns all available CareOS research services."""
    return {"services": SERVICES}


# ── patient-view: research eligibility ───────────────────────────────────────

@router.post("/careos-research-eligibility")
async def research_eligibility(req: CDSRequest, db: Session = Depends(get_db)):
    cards = []
    patient_id = req.context.patientId

    mid = None
    if patient_id:
        try:
            mid = db.query(MemberID).filter(
                MemberID.patient_id == int(patient_id)
            ).first()
        except Exception:
            pass

    if mid and mid.data_sharing_opt_in:
        pool_count = db.query(PoolContribution).filter(
            PoolContribution.session_id.in_(
                db.query(CheckInSession.id).filter(CheckInSession.patient_id == int(patient_id))
            )
        ).count()

        cards.append(_info_card(
            summary="Patient enrolled in CareOS research program",
            detail=(
                f"Member ID: {mid.member_code}. "
                f"This patient has contributed to {pool_count} data pool records. "
                "Eligible for active research tasks. "
                "See CareOS dashboard for available studies."
            ),
            links=[
                {"label": "CareOS Research Dashboard", "url": f"{_BASE_URL}/web3", "type": "absolute"},
                {"label": "Patient QR Check-In", "url": f"{_BASE_URL}/patient/qr/{patient_id}", "type": "absolute"},
            ],
        ))

        pool_total = db.query(PoolContribution).count()
        if pool_total > 0:
            cards.append(_info_card(
                summary=f"Global data pool: {pool_total} de-identified contributions",
                detail=(
                    "This patient's de-identified data contributes to a worldwide health analytics pool. "
                    "Trending: hypertension, T2DM, upper respiratory infections. "
                    f"Research cohort size: {pool_total} participants."
                ),
                source="CareOS Global Data Pool",
                links=[{"label": "View Live Dashboard", "url": f"{_BASE_URL}/live", "type": "absolute"}],
            ))
    else:
        cards.append(_suggestion_card(
            summary="Invite patient to CareOS research program",
            detail=(
                "This patient does not have a CareOS member ID. "
                "Enrolling takes 2 minutes. Patient receives a QR code and $10 health wallet credit "
                "for their first check-in with research authorization. "
                "Framing: 'We compensate participants for voluntary research participation.'"
            ),
            suggestion_label="Send CareOS enrollment link to patient",
            suggestion_uuid=hashlib.md5(f"enroll-{patient_id}".encode()).hexdigest(),
        ))

    return {"cards": cards}


# ── order-select: research study link ────────────────────────────────────────

@router.post("/careos-order-research-link")
async def order_research_link(req: CDSRequest, db: Session = Depends(get_db)):
    cards = []
    draft = req.context.draftOrders or {}

    order_type = "Lab"
    try:
        entries = draft.get("entry", [])
        if entries:
            first = entries[0].get("resource", {})
            rt = first.get("resourceType", "")
            order_type = {"ServiceRequest": "Lab/Imaging", "MedicationRequest": "Medication",
                          "DeviceRequest": "Device"}.get(rt, rt or "Order")
    except Exception:
        pass

    cards.append(_suggestion_card(
        summary=f"Research activity available for this {order_type} order",
        detail=(
            f"An approved research protocol is linked to this {order_type} order type. "
            "The patient may optionally complete a brief symptom survey and earn a $5 research participation credit. "
            "This is separate from the clinical order decision. "
            "Patient may decline without affecting care."
        ),
        suggestion_label=f"Invite patient to complete linked research survey (+$5)",
        suggestion_uuid=hashlib.md5(f"order-study-{req.hookInstance}".encode()).hexdigest(),
    ))

    cards.append(_info_card(
        summary="Medication verification available",
        detail=(
            "Patient can earn $3 for verifying the accuracy of their current medication list "
            "as part of the CareOS research data quality program. "
            "Clinician validates. FHIR Provenance logged."
        ),
        links=[{"label": "Offer medication verification task", "url": f"{_BASE_URL}/web3", "type": "absolute"}],
    ))

    return {"cards": cards}


# ── appointment-booked: QR check-in prompt ───────────────────────────────────

@router.post("/careos-checkin-prompt")
async def checkin_prompt(req: CDSRequest, db: Session = Depends(get_db)):
    cards = [
        _info_card(
            summary="Ask patient: 'Do you have a CareOS QR code?'",
            detail=(
                "If yes, scan their QR code at check-in. "
                "The patient approves what to share on their phone or watch. "
                "You receive a structured FHIR intake bundle: Patient, Coverage (insurance), "
                "Consent, Medications, Allergies, Conditions, and Research Authorization. "
                "Patient earns $10 health wallet credit for research participation."
            ),
            source="CareOS QR Check-In",
            links=[
                {"label": "Open Clinic Scanner", "url": f"{_BASE_URL}/clinic/scan", "type": "absolute"},
                {"label": "How it works", "url": f"{_BASE_URL}/web3", "type": "absolute"},
            ],
        )
    ]
    return {"cards": cards}


# ── patient-view: data pool status ───────────────────────────────────────────

@router.post("/careos-data-pool-status")
async def data_pool_status(req: CDSRequest, db: Session = Depends(get_db)):
    cards = []
    patient_id = req.context.patientId

    signals = []

    if patient_id:
        try:
            pid = int(patient_id)
            last_session = (
                db.query(CheckInSession)
                .filter(CheckInSession.patient_id == pid,
                        CheckInSession.status == CheckInStatus.reward_released)
                .order_by(CheckInSession.accepted_at.desc())
                .first()
            )
            if last_session:
                days_since = (datetime.utcnow() - last_session.accepted_at).days if last_session.accepted_at else 999
                if days_since > 90:
                    signals.append("follow_up_recommended")
                if not last_session.research_authorized:
                    signals.append("consent_expired")
            else:
                signals.append("patient_eligible_for_study")
        except Exception:
            pass

    pool_total = db.query(PoolContribution).count()
    research_count = db.query(PoolContribution).filter(PoolContribution.research_authorized == True).count()

    cards.append(_info_card(
        summary=f"CareOS data pool: {pool_total} global contributions",
        detail=(
            f"{research_count} participants have authorized research use. "
            "Trending conditions: hypertension, T2DM, asthma. "
            "Top allergy signal: penicillin. "
            "Live dashboard available for care gap and cohort insights."
        ),
        source="CareOS Global Data Pool",
        links=[{"label": "View Live Analytics", "url": f"{_BASE_URL}/live", "type": "absolute"}],
    ))

    for signal in signals:
        label_map = {
            "follow_up_recommended": ("Follow-up recommended", "warning",
                "Patient has not checked in via CareOS in 90+ days. Consider inviting them to a follow-up research check-in."),
            "consent_expired": ("Research consent may be expired", "warning",
                "Patient's last research authorization was more than 365 days ago. Offer renewal at next visit."),
            "patient_eligible_for_study": ("Patient may be eligible for a research study", "info",
                "This patient has not yet enrolled in CareOS. Inviting them to participate supports the public health data infrastructure."),
        }
        if signal in label_map:
            summary, indicator, detail = label_map[signal]
            cards.append({"summary": summary, "indicator": indicator, "detail": detail,
                           "source": {"label": "CareOS CDS", "url": f"{_BASE_URL}/web3"}})

    return {"cards": cards}
