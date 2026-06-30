"""
Epic EHR Adapter — SMART on FHIR integration for Epic systems.

References:
- Epic on FHIR: https://fhir.epic.com/
- API Specifications: https://fhir.epic.com/Specifications
- Open Epic endpoints: https://open.epic.com/MyApps/Endpoints
- Vendor Services: https://vendorservices.epic.com/OpenEpicApis

Security notes:
- SMART on FHIR OAuth 2.0 with PKCE for public clients.
- Endpoint selection is org-level config (per health system).
- USCDI v1 through May 2024; USCDI v3 from Aug 2024.
- Supports Bulk FHIR for group-level exports.

Live adapter — makes real HTTP calls to Epic FHIR endpoints.
"""
from __future__ import annotations

import logging
from app.connectors.ehr.base_ehr_adapter import BaseEhrAdapter

logger = logging.getLogger(__name__)


class EpicAdapter(BaseEhrAdapter):
    """
    Epic-specific SMART on FHIR adapter.

    Connects to Epic's FHIR R4 server for:
    - .well-known/smart-configuration discovery (live HTTP)
    - OAuth 2.0 authorization code flow (live HTTP)
    - USCDI FHIR resource access (live HTTP)
    - Clinical Notes via DocumentReference + Binary
    - Bulk Data export (Group kick-off)
    """
    vendor_name = "epic"
    fhir_version = "R4"

    # Epic-specific USCDI FHIR resource categories
    USCDI_RESOURCES = [
        "AllergyIntolerance", "CarePlan", "CareTeam", "Condition",
        "Coverage", "Device", "DiagnosticReport", "DocumentReference",
        "Encounter", "ExplanationOfBenefit", "Goal", "Immunization",
        "Location", "Medication", "MedicationDispense", "MedicationRequest",
        "Observation", "Organization", "Patient", "Practitioner",
        "PractitionerRole", "Procedure", "Provenance", "ServiceRequest",
        "Specimen",
    ]

    # Observation sub-categories available in Epic
    OBSERVATION_CATEGORIES = [
        "Labs", "Vitals", "Social History", "Assessments",
        "SDOH Assessments", "SmartData Elements",
    ]

    def _default_scopes(self) -> list[str]:
        """
        Epic scopes — explicit resource scopes required.
        Epic does NOT support wildcard patient/*.read in all contexts.
        """
        return [
            "openid", "profile", "launch", "online_access",
            "patient/Patient.read",
            "patient/Condition.read",
            "patient/MedicationRequest.read",
            "patient/AllergyIntolerance.read",
            "patient/Observation.read",
            "patient/Encounter.read",
            "patient/Procedure.read",
            "patient/Immunization.read",
            "patient/DiagnosticReport.read",
            "patient/DocumentReference.read",
            "patient/Goal.read",
            "patient/CarePlan.read",
            "patient/CareTeam.read",
            "patient/Coverage.read",
        ]

    def fetch_bulk_data_kickoff(self, group_id: str, access_token: str = "") -> dict:
        """
        Initiate Bulk Data export (Epic Group kick-off).
        GET {base}/Group/{id}/$export with Bearer token.
        """
        url = f"{self.fhir_base_url}/Group/{group_id}/$export"
        logger.info("[epic] Bulk Data kick-off %s", url)
        try:
            headers = {"Prefer": "respond-async"}
            if access_token:
                headers["Authorization"] = f"Bearer {access_token}"
            resp = self._http_get(url, headers=headers)
            resp.raise_for_status()
            return {
                "_live": True, "vendor": "epic",
                "operation": "bulk-export-kickoff",
                "url": url,
                "content_location": resp.headers.get("Content-Location", ""),
                "status_code": resp.status_code,
            }
        except Exception as exc:
            logger.error("[epic] Bulk Data kick-off failed: %s", exc)
            return {"_live": True, "_error": True, "vendor": "epic", "error": str(exc)}

    def supported_resources(self) -> list[str]:
        return self.USCDI_RESOURCES

    def __repr__(self) -> str:
        return f"EpicAdapter(base={self.fhir_base_url}, profile={self.fhir_profile})"
