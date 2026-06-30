"""
Relational vs Standard clinician view — data API.

Serves a single link-derived "chart" payload that both the Relational and the
Standard (Traditional) clinician views render. Data can come from:

  - the internal canonical/demo store, or
  - a live FHIR server reached through a connected EHR adapter.

  GET /api/relational/sources                          pickable data sources
  GET /api/relational/org/{org_id}/patients            patient picker (live)
  GET /api/relational/chart/internal/{patient_id}      chart from internal store
  GET /api/relational/chart/org/{org_id}/{patient_id}  chart from live FHIR
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Organization, Patient
from app.connectors.ehr.ehr_router import get_adapter_for_org
from app.routers.ehr_connect import get_active_token
from app.routers.clinicians import resolve_clinician
from app.clinical.relational import (
    bundle_resources,
    build_chart_from_internal,
    fetch_live_chart,
)
from app.integration.audit.recorder import append_audit, AuditAction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/relational", tags=["relational"])


def _audit_chart_view(
    db: Session, token: Optional[str], *,
    patient_id: str, source_id: str, mrn: str = "",
) -> None:
    """Record a clinician chart view into the tamper-evident audit chain.

    Uses the clinician.<npi> actor namespace. Silent no-op if no/invalid token
    so chart viewing never fails on an audit hiccup.
    """
    clinician = resolve_clinician(db, token)
    if not clinician:
        return
    try:
        append_audit(
            db,
            actor=clinician.actor_name,
            action=AuditAction.phi_read,
            source_id=source_id,
            resource_type="Patient",
            resource_id=str(patient_id),
            extra={
                "view": "relational_chart",
                "clinician_id": clinician.id,
                "clinician": clinician.full_name,
                "mrn": mrn,
            },
        )
        db.commit()
    except Exception:  # noqa: BLE001
        logger.exception("Failed to record clinician chart-view audit entry")
        db.rollback()


@router.get("/sources")
def list_sources(db: Session = Depends(get_db)) -> dict:
    """List selectable data sources: internal demo patients + EHR connections."""
    internal = [
        {
            "patient_id": p.id,
            "name": f"{p.first_name} {p.last_name}".strip(),
            "mrn": str(p.id),
        }
        for p in db.query(Patient).all()
    ]
    orgs = []
    for org in db.query(Organization).all():
        tok = get_active_token(db, org.id)
        orgs.append({
            "org_id": org.id,
            "name": org.name,
            "ehr_vendor": org.ehr_vendor.value if org.ehr_vendor else "other",
            "fhir_base_url": org.fhir_base_url,
            "connected": bool(tok),
        })
    return {"internal_patients": internal, "connections": orgs}


@router.get("/org/{org_id}/patients")
def list_live_patients(
    org_id: int,
    count: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> dict:
    """Fetch a page of patients from a live FHIR server to populate a picker."""
    org = db.query(Organization).get(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    adapter = get_adapter_for_org(org)
    tok = get_active_token(db, org_id)
    payload = adapter.fetch_resource(
        "Patient",
        params={"_count": count},
        access_token=tok.access_token if tok else "",
    )
    patients = []
    for res in bundle_resources(payload):
        if res.get("resourceType") != "Patient":
            continue
        names = res.get("name") or []
        label = ""
        if names:
            n0 = names[0]
            label = n0.get("text") or (
                " ".join(n0.get("given", []) or []) + " " + n0.get("family", "")
            ).strip()
        patients.append({
            "id": res.get("id", ""),
            "name": label or f"Patient {res.get('id', '')}",
            "gender": res.get("gender", ""),
            "birthDate": res.get("birthDate", ""),
        })
    if isinstance(payload, dict) and payload.get("_error"):
        raise HTTPException(
            status_code=502,
            detail=f"Live FHIR fetch failed: {payload.get('error', 'unknown error')}",
        )
    return {"org_id": org_id, "count": len(patients), "patients": patients}


@router.get("/chart/internal/{patient_id}")
def internal_chart(
    patient_id: int,
    db: Session = Depends(get_db),
    x_clinician_token: Optional[str] = Header(None),
) -> dict:
    chart = build_chart_from_internal(db, patient_id)
    if chart is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    _audit_chart_view(
        db, x_clinician_token,
        patient_id=str(patient_id), source_id="internal",
        mrn=chart["demographics"].get("mrn", ""),
    )
    return chart


@router.get("/chart/org/{org_id}/{patient_id}")
def live_chart(
    org_id: int, patient_id: str,
    db: Session = Depends(get_db),
    x_clinician_token: Optional[str] = Header(None),
) -> dict:
    org = db.query(Organization).get(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    adapter = get_adapter_for_org(org)
    tok = get_active_token(db, org_id)
    chart = fetch_live_chart(
        adapter, patient_id, access_token=tok.access_token if tok else "",
    )
    if not chart["demographics"].get("name") or chart["demographics"]["name"] == "Unknown Patient":
        # Still return it, but flag that the patient resource wasn't found.
        chart["_warning"] = f"Patient/{patient_id} not found or unreadable on {org.name}"
    _audit_chart_view(
        db, x_clinician_token,
        patient_id=str(patient_id), source_id=f"org:{org_id}",
        mrn=chart["demographics"].get("mrn", ""),
    )
    return chart
