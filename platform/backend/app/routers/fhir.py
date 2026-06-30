"""
FHIR R4-style resource endpoints with SMART on FHIR authorization.

Supports two auth modes:
  1. SMART on FHIR Bearer token (Authorization header) — production path
  2. Legacy org_id query param — for prototype UI convenience

FHIR resources served:
  Patient, Condition, MedicationRequest, AllergyIntolerance, Observation,
  Encounter, AuditEvent, Consent, Task, DetectedIssue, ResearchStudy,
  ResearchSubject

All error responses are FHIR OperationOutcome (application/fhir+json).
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Header
from fastapi.responses import JSONResponse
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.models import (
    Patient, Diagnosis, Medication, Allergy, LabResult, Encounter,
    AccessRequest, AccessRequestStatus, Payment, PaymentStatus,
    AccessToken, TokenStatus, AccessLog, ConsentSession, ConsentSessionStatus,
    FulfillmentTask, FulfillmentTaskStatus,
)
from app.integration.audit.models import AuditEntry, AuditAction
from app.research.models import ResearchParticipant, ParticipantStatus
from app.clinical.relational import build_chart_from_internal

router = APIRouter(prefix="/fhir", tags=["fhir"])


# ── OperationOutcome helper ───────────────────────────────────────────────────

def _operation_outcome(severity: str, code: str, detail: str) -> dict:
    """Build a FHIR R4 OperationOutcome dict."""
    return {
        "resourceType": "OperationOutcome",
        "issue": [{
            "severity": severity,
            "code": code,
            "details": {"text": detail},
        }],
    }


def _fhir_error(status_code: int, code: str, detail: str) -> JSONResponse:
    """Return a FHIR OperationOutcome JSONResponse with correct status."""
    return JSONResponse(
        status_code=status_code,
        content=_operation_outcome(
            severity="error" if status_code >= 500 else "warning" if status_code == 404 else "error",
            code=code,
            detail=detail,
        ),
        media_type="application/fhir+json",
    )


def _check_authorization(
    patient_id: int,
    db: Session,
    org_id: Optional[int] = None,
    authorization: Optional[str] = None,
):
    """
    Verify access via SMART on FHIR Bearer token or legacy org_id query param.
    Raises HTTPException with FHIR OperationOutcome detail on failure.
    """
    # Path 1: SMART on FHIR Bearer token
    if authorization and authorization.startswith("Bearer "):
        token_str = authorization[7:]
        token_record = db.query(AccessToken).filter(
            AccessToken.token == token_str,
            AccessToken.patient_id == patient_id,
            AccessToken.status == TokenStatus.active,
        ).first()
        if not token_record:
            raise HTTPException(
                status_code=401,
                detail=_operation_outcome("error", "security", "Invalid or expired SMART token"),
            )

        if token_record.expires_at < datetime.utcnow():
            token_record.status = TokenStatus.expired
            db.commit()
            raise HTTPException(
                status_code=401,
                detail=_operation_outcome("error", "security", "Token expired"),
            )

        ar = db.query(AccessRequest).filter(AccessRequest.id == token_record.access_request_id).first()
        return ar

    # Path 2: Legacy org_id query param
    if not org_id:
        raise HTTPException(
            status_code=401,
            detail=_operation_outcome("error", "security", "Authorization required: Bearer token or org_id"),
        )

    ar = (
        db.query(AccessRequest)
        .filter(
            AccessRequest.patient_id == patient_id,
            AccessRequest.requesting_org_id == org_id,
            AccessRequest.status == AccessRequestStatus.approved,
        )
        .first()
    )
    if not ar:
        raise HTTPException(
            status_code=403,
            detail=_operation_outcome("error", "forbidden", "No approved access request found"),
        )

    payment = (
        db.query(Payment)
        .filter(Payment.access_request_id == ar.id, Payment.status == PaymentStatus.completed)
        .first()
    )
    if not payment:
        raise HTTPException(
            status_code=402,
            detail=_operation_outcome("error", "business-rule", "Payment required before accessing records"),
        )

    return ar


@router.get("/Patient/{patient_id}")
def fhir_patient(
    patient_id: int,
    org_id: Optional[int] = Query(None, description="Requesting organization ID"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    _check_authorization(patient_id, db, org_id=org_id, authorization=authorization)
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=404,
            detail=_operation_outcome("warning", "not-found", f"Patient/{patient_id} not found"),
        )

    return {
        "resourceType": "Patient",
        "id": str(patient.id),
        "name": [{"family": patient.last_name, "given": [patient.first_name]}],
        "gender": patient.gender or "unknown",
        "birthDate": str(patient.date_of_birth) if patient.date_of_birth else None,
        "telecom": [
            {"system": "email", "value": patient.email} if patient.email else None,
            {"system": "phone", "value": patient.phone} if patient.phone else None,
        ],
        "address": [{"text": patient.address}] if patient.address else [],
    }


_DATA_ABSENT = {
    "extension": [{
        "url": "http://hl7.org/fhir/StructureDefinition/data-absent-reason",
        "valueCode": "unknown",
    }]
}

_CONDITION_CATEGORY_MAP = {
    "problem-list-item": "http://terminology.hl7.org/CodeSystem/condition-category",
    "encounter-diagnosis": "http://terminology.hl7.org/CodeSystem/condition-category",
    "health-concern": "http://hl7.org/fhir/us/core/CodeSystem/us-core-tags",
}

_OBSERVATION_CATEGORY_MAP = {
    "laboratory": "http://terminology.hl7.org/CodeSystem/observation-category",
    "vital-signs": "http://terminology.hl7.org/CodeSystem/observation-category",
    "social-history": "http://terminology.hl7.org/CodeSystem/observation-category",
    "survey": "http://terminology.hl7.org/CodeSystem/observation-category",
    "sdoh": "http://hl7.org/fhir/us/core/CodeSystem/us-core-tags",
}


def _condition_resource(d: Diagnosis, patient_id: int) -> dict:
    status_code = d.status or "active"
    clinical_status = {
        "coding": [{
            "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
            "code": status_code,
        }],
    }
    code = {
        "coding": [{"system": "http://hl7.org/fhir/sid/icd-10", "code": d.code or "unknown", "display": d.description or ""}]
    } if d.code else {**_DATA_ABSENT, "text": d.description or "unknown"}
    return {
        "resourceType": "Condition",
        "id": str(d.id),
        "subject": {"reference": f"Patient/{patient_id}"},
        "category": [{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/condition-category",
                "code": "problem-list-item",
                "display": "Problem List Item",
            }]
        }],
        "code": code,
        "onsetDateTime": str(d.date_diagnosed) if d.date_diagnosed else None,
        "clinicalStatus": clinical_status,
        "verificationStatus": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                "code": "confirmed",
            }]
        },
    }


@router.get("/Condition")
def fhir_conditions(
    patient: int = Query(..., alias="patient"),
    category: Optional[str] = Query(None, description="Granular category filter: problem-list-item, encounter-diagnosis, health-concern"),
    org_id: Optional[int] = Query(None, description="Requesting organization ID"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    _check_authorization(patient, db, org_id=org_id, authorization=authorization)
    diagnoses = db.query(Diagnosis).filter(Diagnosis.patient_id == patient).all()
    resources = [_condition_resource(d, patient) for d in diagnoses]
    if category:
        resources = [r for r in resources if any(
            c.get("code") == category
            for cat in r.get("category", [])
            for c in cat.get("coding", [])
        )]
    return {"resourceType": "Bundle", "type": "searchset", "total": len(resources), "entry": [{"resource": r} for r in resources]}


@router.post("/Condition/_search")
def fhir_conditions_post(
    patient: int = Query(..., alias="patient"),
    category: Optional[str] = Query(None),
    org_id: Optional[int] = Query(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """US Core SHALL support POST-based search."""
    return fhir_conditions(patient=patient, category=category, org_id=org_id, authorization=authorization, db=db)


@router.get("/MedicationRequest")
def fhir_medications(
    patient: int = Query(..., alias="patient"),
    status: Optional[str] = Query(None, description="Filter by status: active, stopped, completed"),
    org_id: Optional[int] = Query(None, description="Requesting organization ID"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    _check_authorization(patient, db, org_id=org_id, authorization=authorization)
    meds = db.query(Medication).filter(Medication.patient_id == patient).all()
    entries = [
        {
            "resource": {
                "resourceType": "MedicationRequest",
                "id": str(m.id),
                "status": m.status or "active",
                "intent": "order",
                "subject": {"reference": f"Patient/{patient}"},
                "medicationCodeableConcept": {"text": m.name},
                "dosageInstruction": [{"text": f"{m.dosage or ''} {m.frequency or ''}".strip()}],
                "requester": {"display": m.prescriber} if m.prescriber else None,
                "authoredOn": str(m.start_date) if m.start_date else None,
            }
        }
        for m in meds
    ]
    if status:
        entries = [e for e in entries if e["resource"].get("status") == status]
    return {"resourceType": "Bundle", "type": "searchset", "total": len(entries), "entry": entries}


@router.post("/MedicationRequest/_search")
def fhir_medications_post(
    patient: int = Query(..., alias="patient"),
    status: Optional[str] = Query(None),
    org_id: Optional[int] = Query(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """US Core SHALL support POST-based search."""
    return fhir_medications(patient=patient, status=status, org_id=org_id, authorization=authorization, db=db)


@router.get("/AllergyIntolerance")
def fhir_allergies(
    patient: int = Query(..., alias="patient"),
    org_id: Optional[int] = Query(None, description="Requesting organization ID"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    _check_authorization(patient, db, org_id=org_id, authorization=authorization)
    allergies = db.query(Allergy).filter(Allergy.patient_id == patient).all()

    severity_map = {"mild": "low", "moderate": "low", "severe": "high"}

    return {
        "resourceType": "Bundle",
        "type": "searchset",
        "total": len(allergies),
        "entry": [
            {
                "resource": {
                    "resourceType": "AllergyIntolerance",
                    "id": str(a.id),
                    "patient": {"reference": f"Patient/{patient}"},
                    "code": {"text": a.allergen},
                    "reaction": [{"manifestation": [{"text": a.reaction}]}] if a.reaction else [],
                    "criticality": severity_map.get(a.severity.value, "unable-to-assess") if a.severity else "unable-to-assess",
                }
            }
            for a in allergies
        ],
    }


@router.get("/Observation")
def fhir_observations(
    patient: int = Query(..., alias="patient"),
    category: Optional[str] = Query(None, description="Granular category: laboratory, vital-signs, social-history, survey, sdoh"),
    org_id: Optional[int] = Query(None, description="Requesting organization ID"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    _check_authorization(patient, db, org_id=org_id, authorization=authorization)
    labs = db.query(LabResult).filter(LabResult.patient_id == patient).all()
    entries = [
        {
            "resource": {
                "resourceType": "Observation",
                "id": str(l.id),
                "status": l.status or "final",
                "category": [{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                        "code": "laboratory",
                        "display": "Laboratory",
                    }]
                }],
                "subject": {"reference": f"Patient/{patient}"},
                "code": {"text": l.test_name} if l.test_name else _DATA_ABSENT,
                "valueQuantity": {"value": l.value, "unit": l.unit} if l.value is not None else None,
                "referenceRange": [{"text": l.reference_range}] if l.reference_range else [],
                "effectiveDateTime": l.date.isoformat() if l.date else None,
            }
        }
        for l in labs
    ]
    if category:
        entries = [e for e in entries if any(
            c.get("code") == category
            for cat in e["resource"].get("category", [])
            for c in cat.get("coding", [])
        )]
    return {"resourceType": "Bundle", "type": "searchset", "total": len(entries), "entry": entries}


@router.post("/Observation/_search")
def fhir_observations_post(
    patient: int = Query(..., alias="patient"),
    category: Optional[str] = Query(None),
    org_id: Optional[int] = Query(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """US Core SHALL support POST-based search."""
    return fhir_observations(patient=patient, category=category, org_id=org_id, authorization=authorization, db=db)


@router.get("/Encounter")
def fhir_encounters(
    patient: int = Query(..., alias="patient"),
    org_id: Optional[int] = Query(None, description="Requesting organization ID"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    _check_authorization(patient, db, org_id=org_id, authorization=authorization)
    encounters = db.query(Encounter).filter(Encounter.patient_id == patient).all()

    return {
        "resourceType": "Bundle",
        "type": "searchset",
        "total": len(encounters),
        "entry": [
            {
                "resource": {
                    "resourceType": "Encounter",
                    "id": str(e.id),
                    "subject": {"reference": f"Patient/{patient}"},
                    "period": {"start": e.date.isoformat() if e.date else None},
                    "participant": [{"individual": {"display": e.provider}}] if e.provider else [],
                    "location": [{"location": {"display": e.location}}] if e.location else [],
                    "type": [{"text": e.type}] if e.type else [],
                    "reasonCode": [{"text": e.summary}] if e.summary else [],
                }
            }
            for e in encounters
        ],
    }


# ── AuditEvent ────────────────────────────────────────────────────────────────

_AUDIT_ACTION_MAP = {
    AuditAction.phi_read: "R",
    AuditAction.phi_write: "C",
    AuditAction.break_glass: "E",
    AuditAction.received: "E",
    AuditAction.transformed: "E",
    AuditAction.routed: "E",
    AuditAction.delivered: "E",
    AuditAction.rejected: "E",
    AuditAction.error: "E",
}


def _audit_entry_to_fhir(entry: AuditEntry) -> dict:
    """Serialize an internal AuditEntry to a FHIR R4 AuditEvent resource."""
    return {
        "resourceType": "AuditEvent",
        "id": str(entry.id),
        "type": {
            "system": "http://terminology.hl7.org/CodeSystem/audit-event-type",
            "code": "rest",
            "display": "RESTful Operation",
        },
        "subtype": [{
            "system": "https://launchflow.tech/careos/audit-action",
            "code": entry.action.value,
            "display": entry.action.value,
        }],
        "action": _AUDIT_ACTION_MAP.get(entry.action, "E"),
        "recorded": entry.ts.isoformat() + "Z" if entry.ts else None,
        "outcome": "0",
        "agent": [{
            "who": {"display": entry.actor or "system"},
            "requestor": True,
        }],
        "source": {
            "site": entry.source_id or "careos",
            "observer": {"display": "CareOS Relay Audit Chain"},
        },
        "entity": [
            {
                "what": {
                    "reference": f"{entry.resource_type}/{entry.resource_id}"
                    if entry.resource_type and entry.resource_id
                    else None,
                },
                "type": {
                    "system": "http://terminology.hl7.org/CodeSystem/audit-entity-type",
                    "code": "2",
                    "display": "System Object",
                },
                "detail": [
                    {"type": "hash_self", "valueBase64Binary": entry.hash_self or ""},
                ] + (
                    [{"type": "content_sha256", "valueBase64Binary": entry.content_sha256}]
                    if entry.content_sha256 else []
                ),
            }
        ] if (entry.resource_type or entry.resource_id) else [],
        "extension": [{
            "url": "https://launchflow.tech/careos/audit-chain",
            "extension": [
                {"url": "hash_prev", "valueString": entry.hash_prev or ""},
                {"url": "hash_self", "valueString": entry.hash_self or ""},
            ],
        }],
    }


@router.get("/AuditEvent")
def fhir_audit_events(
    _count: int = Query(50, alias="_count", le=500),
    actor: Optional[str] = Query(None, description="Filter by actor"),
    action: Optional[str] = Query(None, description="Filter by action code"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    FHIR AuditEvent — CareOS tamper-evident audit chain exposed as FHIR resources.
    Requires a valid SMART Bearer token (any patient scope) or system-level access.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail=_operation_outcome("error", "security", "Bearer token required"),
        )

    q = db.query(AuditEntry).order_by(AuditEntry.id.desc())
    if actor:
        q = q.filter(AuditEntry.actor == actor)
    if action:
        q = q.filter(AuditEntry.action == action)
    entries = q.limit(_count).all()

    return {
        "resourceType": "Bundle",
        "type": "searchset",
        "total": len(entries),
        "entry": [{"resource": _audit_entry_to_fhir(e)} for e in entries],
    }


@router.get("/AuditEvent/{entry_id}")
def fhir_audit_event(
    entry_id: int,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Single FHIR AuditEvent by id."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail=_operation_outcome("error", "security", "Bearer token required"),
        )
    entry = db.query(AuditEntry).filter(AuditEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(
            status_code=404,
            detail=_operation_outcome("warning", "not-found", f"AuditEvent/{entry_id} not found"),
        )
    return _audit_entry_to_fhir(entry)


# ── Consent ───────────────────────────────────────────────────────────────────

_CONSENT_STATUS_MAP = {
    ConsentSessionStatus.initiated: "proposed",
    ConsentSessionStatus.pending_patient: "proposed",
    ConsentSessionStatus.approved: "active",
    ConsentSessionStatus.denied: "rejected",
    ConsentSessionStatus.expired: "inactive",
}


def _consent_session_to_fhir(session: ConsentSession) -> dict:
    """Serialize a ConsentSession to a FHIR R4 Consent resource."""
    return {
        "resourceType": "Consent",
        "id": str(session.id),
        "status": _CONSENT_STATUS_MAP.get(session.status, "proposed"),
        "scope": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/consentscope",
                "code": "patient-privacy",
                "display": "Privacy Consent",
            }],
        },
        "category": [{
            "coding": [{
                "system": "http://loinc.org",
                "code": "59284-0",
                "display": "Patient Consent",
            }],
        }],
        "patient": {"reference": f"Patient/{session.patient_id}"},
        "organization": [{"reference": f"Organization/{session.organization_id}"}],
        "dateTime": session.created_at.isoformat() + "Z" if session.created_at else None,
        "provision": {
            "type": "permit" if session.status == ConsentSessionStatus.approved else "deny",
            "period": {
                "start": session.created_at.isoformat() + "Z" if session.created_at else None,
                "end": session.expires_at.isoformat() + "Z" if session.expires_at else None,
            },
            "action": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/consentaction",
                    "code": "access",
                    "display": "Access",
                }],
            }],
        },
        "extension": [{
            "url": "https://launchflow.tech/careos/consent-session",
            "extension": [
                {"url": "session_token", "valueString": session.session_token},
                {"url": "launch_method", "valueString": session.launch_method or "web"},
                {"url": "scopes_requested", "valueString": session.scopes_requested or ""},
            ],
        }],
    }


@router.get("/Consent")
def fhir_consent(
    patient: int = Query(..., alias="patient"),
    org_id: Optional[int] = Query(None, description="Requesting organization ID"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """FHIR Consent — all consent sessions for this patient."""
    _check_authorization(patient, db, org_id=org_id, authorization=authorization)
    sessions = (
        db.query(ConsentSession)
        .filter(ConsentSession.patient_id == patient)
        .order_by(ConsentSession.created_at.desc())
        .all()
    )
    return {
        "resourceType": "Bundle",
        "type": "searchset",
        "total": len(sessions),
        "entry": [{"resource": _consent_session_to_fhir(s)} for s in sessions],
    }


# ── Task ──────────────────────────────────────────────────────────────────────

_TASK_STATUS_MAP = {
    FulfillmentTaskStatus.queued: "requested",
    FulfillmentTaskStatus.sent: "in-progress",
    FulfillmentTaskStatus.acknowledged: "accepted",
    FulfillmentTaskStatus.completed: "completed",
    FulfillmentTaskStatus.failed: "failed",
    FulfillmentTaskStatus.needs_patient_input: "on-hold",
}

_TASK_TYPE_CODE_MAP = {
    "lab_order": ("103696004", "Patient referral to laboratory (procedure)"),
    "pharmacy_rx": ("33633005", "Prescription of drug (procedure)"),
    "referral": ("306206005", "Referral to service (procedure)"),
    "prior_auth": ("308539001", "Insurance prior authorization (procedure)"),
    "record_request": ("308539001", "Medical record request"),
}


def _fulfillment_task_to_fhir(task: FulfillmentTask) -> dict:
    """Serialize a FulfillmentTask to a FHIR R4 Task resource."""
    type_code, type_display = _TASK_TYPE_CODE_MAP.get(
        task.type.value, (task.type.value, task.type.value)
    )
    payload = task.payload_json or {}
    return {
        "resourceType": "Task",
        "id": str(task.id),
        "status": _TASK_STATUS_MAP.get(task.status, "requested"),
        "intent": "order",
        "code": {
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": type_code,
                "display": type_display,
            }],
            "text": task.type.value,
        },
        "for": {
            "reference": f"Patient/{task.packet.patient_id}"
        } if task.packet else None,
        "authoredOn": task.created_at.isoformat() + "Z" if task.created_at else None,
        "lastModified": task.updated_at.isoformat() + "Z" if task.updated_at else None,
        "businessStatus": {
            "text": task.status.value,
        },
        "note": [{"text": task.last_error}] if task.last_error else [],
        "input": [
            {"type": {"text": k}, "valueString": str(v)}
            for k, v in payload.items()
            if v is not None
        ],
        "extension": [{
            "url": "https://launchflow.tech/careos/fulfillment",
            "extension": [
                {"url": "destination_type", "valueString": task.destination_type.value},
                {"url": "packet_id", "valueInteger": task.packet_id},
            ],
        }],
    }


@router.get("/Task")
def fhir_tasks(
    patient: int = Query(..., alias="patient"),
    status: Optional[str] = Query(None, description="Filter by FHIR Task status"),
    org_id: Optional[int] = Query(None, description="Requesting organization ID"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """FHIR Task — fulfillment tasks for a patient."""
    _check_authorization(patient, db, org_id=org_id, authorization=authorization)

    from app.models import FulfillmentPacket
    tasks = (
        db.query(FulfillmentTask)
        .join(FulfillmentPacket, FulfillmentTask.packet_id == FulfillmentPacket.id)
        .filter(FulfillmentPacket.patient_id == patient)
        .order_by(FulfillmentTask.created_at.desc())
        .all()
    )

    # Optional status filter — translate FHIR status back to internal
    if status:
        reverse_map = {v: k for k, v in _TASK_STATUS_MAP.items()}
        internal_status = reverse_map.get(status)
        if internal_status:
            tasks = [t for t in tasks if t.status == internal_status]

    return {
        "resourceType": "Bundle",
        "type": "searchset",
        "total": len(tasks),
        "entry": [{"resource": _fulfillment_task_to_fhir(t)} for t in tasks],
    }


# ── DetectedIssue ─────────────────────────────────────────────────────────────

@router.get("/DetectedIssue")
def fhir_detected_issues(
    patient: int = Query(..., alias="patient"),
    org_id: Optional[int] = Query(None, description="Requesting organization ID"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    FHIR DetectedIssue — allergy-medication conflicts detected by the
    CareOS relational engine for this patient.
    """
    _check_authorization(patient, db, org_id=org_id, authorization=authorization)

    chart = build_chart_from_internal(db, patient)
    issues = []
    for med in chart.get("medications", []):
        conflict_id = med.get("allergy_conflict")
        if not conflict_id:
            continue
        allergy = next(
            (a for a in chart.get("allergies", []) if a["id"] == conflict_id), None
        )
        issues.append({
            "resourceType": "DetectedIssue",
            "id": f"conflict-{med['id']}-{conflict_id}",
            "status": "final",
            "category": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                    "code": "DINT",
                    "display": "Drug Interaction",
                }],
            }],
            "code": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                    "code": "ALG",
                    "display": "Allergy Alert",
                }],
                "text": f"Medication '{med['name']}' conflicts with documented allergy",
            },
            "severity": "high",
            "patient": {"reference": f"Patient/{patient}"},
            "detail": (
                f"Medication '{med['name']}' conflicts with allergy to"
                f" '{allergy['substance'] if allergy else conflict_id}'."
                f" Allergy reaction: {allergy['reaction'] if allergy else 'unknown'}."
            ),
            "implicated": [
                {"reference": f"MedicationRequest/{med['id']}"},
                {"reference": f"AllergyIntolerance/{conflict_id}"},
            ],
        })

    return {
        "resourceType": "Bundle",
        "type": "searchset",
        "total": len(issues),
        "entry": [{"resource": i} for i in issues],
    }


# ── ResearchStudy / ResearchSubject ───────────────────────────────────────────

_PARTICIPANT_STATUS_MAP = {
    ParticipantStatus.enrolled: "candidate",
    ParticipantStatus.in_progress: "on-study",
    ParticipantStatus.completed: "off-study",
    ParticipantStatus.withdrawn: "withdrawn",
}


@router.get("/ResearchStudy")
def fhir_research_study(
    authorization: Optional[str] = Header(None),
):
    """
    FHIR ResearchStudy — describes the CareOS comparative EHR usability study.
    Returns a single study record; no patient data.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail=_operation_outcome("error", "security", "Bearer token required"),
        )
    base = getattr(settings, "BASE_URL", "http://localhost:8000")
    return {
        "resourceType": "ResearchStudy",
        "id": "careos-ehr-usability-study",
        "status": "active",
        "title": "CareOS Comparative EHR Interface Usability Study",
        "description": (
            "Convergent mixed-methods study comparing Traditional (tabbed/siloed) vs "
            "Relational (linked) EHR interfaces for clinician cognitive workload, "
            "measured via NASA-TLX, SUS, and qualitative analysis."
        ),
        "category": [{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/research-study-category",
                "code": "U",
                "display": "Usability",
            }],
        }],
        "focus": [{
            "text": "EHR Interface Design",
        }],
        "contact": [{
            "name": "CareOS Research Team",
            "telecom": [{"system": "url", "value": base}],
        }],
        "arm": [
            {
                "name": "Traditional EHR",
                "type": {"text": "Active Comparator"},
                "description": "Tabbed, siloed EHR interface — standard design.",
            },
            {
                "name": "Relational EHR",
                "type": {"text": "Experimental"},
                "description": "Relationally-linked EHR interface with cross-referenced data.",
            },
        ],
        "protocol": [{
            "display": "Counterbalanced within-subjects crossover design",
        }],
        "principalInvestigator": {"display": "Business Intuitive Inc."},
        "site": [{"display": "launchflow.tech (remote)"}],
    }


@router.get("/ResearchSubject")
def fhir_research_subjects(
    study: Optional[str] = Query(None, description="Filter by ResearchStudy id"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    FHIR ResearchSubject — one entry per research participant.
    Identifiers are anonymized (participant_code only; no names/email).
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail=_operation_outcome("error", "security", "Bearer token required"),
        )

    participants = db.query(ResearchParticipant).all()
    entries = []
    for p in participants:
        entries.append({
            "resourceType": "ResearchSubject",
            "id": f"subject-{p.id}",
            "status": _PARTICIPANT_STATUS_MAP.get(p.status, "candidate") if p.status else "candidate",
            "study": {"reference": "ResearchStudy/careos-ehr-usability-study"},
            "individual": {
                "identifier": [{
                    "system": "https://launchflow.tech/careos/research/participant",
                    "value": p.participant_code,
                }],
                "display": p.participant_code,
            },
            "assignedArm": (
                "Traditional EHR" if p.condition_order and p.condition_order.value == "traditional_first"
                else "Relational EHR"
            ) if p.condition_order else None,
            "extension": [{
                "url": "https://launchflow.tech/careos/research/subject",
                "extension": [
                    {"url": "role", "valueString": p.role.value if p.role else ""},
                    {"url": "years_experience", "valueDecimal": p.years_experience or 0},
                    {"url": "consent_given", "valueBoolean": bool(p.consent_given)},
                    {"url": "style_preference", "valueString": p.style_preference or ""},
                ],
            }],
        })

    return {
        "resourceType": "Bundle",
        "type": "searchset",
        "total": len(entries),
        "entry": [{"resource": e} for e in entries],
    }
