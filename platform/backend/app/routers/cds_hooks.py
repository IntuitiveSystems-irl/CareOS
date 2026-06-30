"""
CDS Hooks service — OUTBOUND decision support into the EHR.

Implements the HL7 CDS Hooks contract so *any* EHR can call CareOS during a
clinician's workflow:

  GET  /cds-services                 discovery document
  POST /cds-services/{id}            invoke a service, returns {"cards": [...]}

Services (all deterministic — no LLM):
  - careos-patient-summary  (patient-view)   relational safety + patient voice
  - careos-medication-safety (order-select / order-sign)  drafted-order checks

Every card is built from the canonical relational chart and the patient's own
feedback, and carries a ``careos`` extension so the card renders in relational
style. Each invocation is written to the tamper-evident audit chain.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Organization, PatientFeedback, FeedbackStatus
from app.connectors.ehr.ehr_router import get_adapter_for_org
from app.routers.ehr_connect import get_active_token
from app.clinical.relational import build_chart_from_internal, fetch_live_chart
from app.cds.cards import build_patient_view_cards, build_order_select_cards
from app.integration.audit.recorder import append_audit, AuditAction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cds-services", tags=["cds-hooks"])


_SERVICES = [
    {
        "hook": "patient-view",
        "id": "careos-patient-summary",
        "title": "CareOS Relational Patient Summary",
        "description": (
            "Deterministic, relationally-linked safety cards (allergy↔medication "
            "conflicts, untreated problems) plus the patient's own feedback from "
            "the CareOS Patient Fishbowl. No LLM."
        ),
        "prefetch": {
            "patient": "Patient/{{context.patientId}}",
        },
    },
    {
        "hook": "order-select",
        "id": "careos-medication-safety",
        "title": "CareOS Medication Safety + Patient Voice",
        "description": (
            "Checks drafted medication orders against documented allergies and "
            "surfaces relevant patient feedback (preferences / prior declines)."
        ),
    },
    {
        "hook": "order-sign",
        "id": "careos-medication-safety",
        "title": "CareOS Medication Safety + Patient Voice",
        "description": "Same checks as order-select, fired at order-sign.",
    },
]


@router.get("")
@router.get("/")
def discovery() -> dict:
    """CDS Hooks discovery — the EHR fetches this to learn what CareOS offers."""
    # De-duplicate by id for the public list while keeping all hook bindings.
    return {"services": _SERVICES}


# ── helpers ──────────────────────────────────────────────────────────────────

def _resolve_chart(db: Session, patient_id: str, org_id: Optional[int]) -> Optional[dict]:
    """Build a relational chart from a live org (if given) or the internal store."""
    if org_id:
        org = db.query(Organization).get(org_id)
        if not org:
            return None
        adapter = get_adapter_for_org(org)
        tok = get_active_token(db, org_id)
        return fetch_live_chart(adapter, patient_id, access_token=tok.access_token if tok else "")
    try:
        pid = int(patient_id)
    except (TypeError, ValueError):
        return None
    return build_chart_from_internal(db, pid)


def _load_feedback(db: Session, patient_id: str) -> list[PatientFeedback]:
    try:
        pid = int(patient_id)
    except (TypeError, ValueError):
        return []
    return (
        db.query(PatientFeedback)
        .filter(
            PatientFeedback.patient_id == pid,
            PatientFeedback.status != FeedbackStatus.resolved,
        )
        .order_by(desc(PatientFeedback.created_at))
        .all()
    )


def _extract_draft_meds(context: dict) -> list[dict]:
    """Pull {name,id} medication entries from CDS Hooks order context."""
    meds: list[dict] = []

    # CareOS convenience shape.
    for m in context.get("careos_draft_meds", []) or []:
        if isinstance(m, dict) and m.get("name"):
            meds.append({"name": m["name"], "id": str(m.get("id", m["name"]))})

    # Standard CDS Hooks: context.draftOrders is a FHIR Bundle of orders.
    draft = context.get("draftOrders") or {}
    for entry in (draft.get("entry") or []):
        res = entry.get("resource") if isinstance(entry, dict) else None
        if not isinstance(res, dict):
            continue
        if res.get("resourceType") != "MedicationRequest":
            continue
        cc = res.get("medicationCodeableConcept") or {}
        name = cc.get("text") or ""
        if not name:
            for c in cc.get("coding", []):
                name = c.get("display") or c.get("code") or ""
                if name:
                    break
        if name:
            meds.append({"name": name, "id": str(res.get("id", name))})
    return meds


def _audit_invoke(db: Session, *, service_id: str, actor: str, patient_id: str, n_cards: int) -> None:
    try:
        append_audit(
            db,
            actor=actor or "cds.careos",
            action=AuditAction.phi_read,
            source_id=f"cds:{service_id}",
            resource_type="Patient",
            resource_id=str(patient_id),
            extra={"cds_service": service_id, "cards_returned": n_cards},
        )
        db.commit()
    except Exception:  # noqa: BLE001
        logger.exception("Failed to record CDS invoke audit entry")
        db.rollback()


# ── invoke ───────────────────────────────────────────────────────────────────

@router.post("/{service_id}")
def invoke(service_id: str, payload: dict = Body(...), db: Session = Depends(get_db)) -> dict:
    """Invoke a CDS service. Returns {"cards": [...]} per the CDS Hooks spec."""
    known = {s["id"] for s in _SERVICES}
    if service_id not in known:
        raise HTTPException(status_code=404, detail=f"Unknown CDS service '{service_id}'")

    context = payload.get("context") or {}
    patient_id = str(context.get("patientId") or context.get("patient") or "")
    if not patient_id:
        raise HTTPException(status_code=400, detail="context.patientId is required")

    org_id = context.get("careos_org_id")
    actor = context.get("userId") or "cds.careos"

    chart = _resolve_chart(db, patient_id, org_id)
    if chart is None:
        raise HTTPException(status_code=404, detail=f"No chart for patient {patient_id}")

    feedback = _load_feedback(db, patient_id)

    if service_id == "careos-patient-summary":
        cards = build_patient_view_cards(chart, feedback)
    elif service_id == "careos-medication-safety":
        draft_meds = _extract_draft_meds(context)
        cards = build_order_select_cards(chart, feedback, draft_meds)
    else:  # pragma: no cover
        cards = []

    _audit_invoke(db, service_id=service_id, actor=actor, patient_id=patient_id, n_cards=len(cards))
    return {"cards": cards}
