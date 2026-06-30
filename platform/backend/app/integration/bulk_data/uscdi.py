"""
USCDI v3 patient export.

Returns a single FHIR R4 transaction Bundle that covers every USCDI v3
data class for one patient, by external (source-system) MRN.

USCDI v3 data classes mapped to FHIR resource types:

    Patient demographics              → Patient
    Allergies and intolerances        → AllergyIntolerance
    Care team members                 → CareTeam
    Clinical notes                    → DocumentReference
    Diagnostic imaging                → ImagingStudy / DiagnosticReport
    Encounters                        → Encounter
    Goals                             → Goal
    Health concerns                   → Condition (Health-Concern category)
    Immunizations                     → Immunization
    Laboratory                        → Observation (Lab category)
    Medications                       → MedicationRequest, MedicationStatement
    Patient-reported outcomes         → Observation (Survey category)
    Problems                          → Condition (Problem-List-Item category)
    Procedures                        → Procedure
    Provenance                        → Provenance
    Smoking status                    → Observation (Smoking-status code)
    Unique device identifiers         → Device
    Vital signs                       → Observation (Vital-Signs category)

Resource lookup is keyed on `RelayFhirResource.source_id +
resource_type + external_id`. The Bundle is a self-contained snapshot
(`type=collection`) — it is NOT a transaction the receiver should `PUT`
back; it's a portability deliverable.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.integration.storage.models import RelayFhirResource


# Ordered list of resource types CareOS surfaces for USCDI v3.
USCDI_V3_RESOURCES: list[str] = [
    "Patient",
    "AllergyIntolerance",
    "CareTeam",
    "DocumentReference",
    "DiagnosticReport",
    "ImagingStudy",
    "Encounter",
    "Goal",
    "Immunization",
    "Observation",
    "MedicationRequest",
    "MedicationStatement",
    "Condition",
    "Procedure",
    "Provenance",
    "Device",
]


def build_uscdi_bundle(
    db: Session,
    *,
    external_id: str,
    source_id: str | None = None,
) -> dict[str, Any]:
    """Assemble one USCDI v3 Bundle for `external_id`.

    `source_id` (optional) restricts to a single source EHR; omit to
    union across every source CareOS has seen for that MRN.
    """
    entries: list[dict[str, Any]] = []
    seen_ids: set[tuple[str, str]] = set()

    for rtype in USCDI_V3_RESOURCES:
        q = db.query(RelayFhirResource).filter(
            RelayFhirResource.external_id == external_id,
            RelayFhirResource.resource_type == rtype,
        )
        if source_id:
            q = q.filter(RelayFhirResource.source_id == source_id)
        for row in q.order_by(RelayFhirResource.received_at.desc()).yield_per(500):
            res = row.resource_json or {}
            rid = res.get("id") or row.resource_id
            if not rid:
                continue
            key = (rtype, str(rid))
            if key in seen_ids:
                continue
            seen_ids.add(key)
            entries.append({
                "fullUrl": f"urn:uuid:{rid}",
                "resource": res,
            })

    return {
        "resourceType": "Bundle",
        "type": "collection",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "meta": {
            "tag": [{
                "system": "https://launchflow.tech/careos/uscdi",
                "code": "v3",
                "display": "USCDI v3 patient export",
            }],
            "profile": [
                "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
            ],
        },
        "entry": entries,
    }
