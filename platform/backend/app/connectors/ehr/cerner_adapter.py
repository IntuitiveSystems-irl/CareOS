"""
Cerner (Oracle Health) EHR Adapter — SMART on FHIR integration.

References:
- SMART on FHIR tutorial: https://engineering.cerner.com/smart-on-fhir-tutorial/
- SMART scheduling tutorial: https://engineering.cerner.com/smart-on-fhir-scheduling-tutorial/
- Cerner SMART doc: https://github.com/cerner/fhir.cerner.com/blob/main/content/smart.md
- SMART App Launcher: https://launch.smarthealthit.org

Security notes:
- SMART launch uses `iss` (FHIR base) + `launch` parameters.
- No wildcard `patient/*.read` — specify resources explicitly.
- Read auth endpoints from FHIR metadata / SMART config.
- Supports EHR launch and standalone launch (launch/patient for patient context).
- MPages integration requires XFC (Cross-Frame-Container) for secure embedding.

Live adapter — makes real HTTP calls to Cerner/Oracle Health FHIR endpoints.
"""
from __future__ import annotations

import logging
from app.connectors.ehr.base_ehr_adapter import BaseEhrAdapter

logger = logging.getLogger(__name__)


class CernerAdapter(BaseEhrAdapter):
    """
    Cerner-specific SMART on FHIR adapter.

    Connects to Cerner's FHIR R4 server for:
    - .well-known/smart-configuration or CapabilityStatement discovery (live HTTP)
    - OAuth 2.0 authorization code flow (live HTTP)
    - Explicit resource scopes (no wildcards)
    - Supports DSTU2 and R4 (R4 preferred)
    """
    vendor_name = "cerner"
    fhir_version = "R4"

    SUPPORTED_RESOURCES = [
        "Patient", "Observation", "Condition", "MedicationRequest",
        "AllergyIntolerance", "Encounter", "Procedure", "Immunization",
        "Goal", "CarePlan", "CareTeam", "DiagnosticReport",
        "DocumentReference", "Coverage", "Device",
    ]

    def _default_scopes(self) -> list[str]:
        """
        Cerner requires explicit resource scopes — no wildcards.
        Uses patient/ prefix for patient-context scopes.
        """
        return [
            "openid", "profile", "launch", "online_access",
            "patient/Patient.read",
            "patient/Observation.read",
            "patient/Condition.read",
            "patient/MedicationRequest.read",
            "patient/AllergyIntolerance.read",
            "patient/Encounter.read",
            "patient/Procedure.read",
            "patient/Immunization.read",
            "patient/DiagnosticReport.read",
            "patient/DocumentReference.read",
        ]

    def standalone_scopes(self) -> list[str]:
        """
        Standalone launch scopes — includes launch/patient for patient selection.
        Used when app is launched outside of EHR context.
        """
        base = self._default_scopes()
        return [s if s != "launch" else "launch/patient" for s in base]

    def supported_resources(self) -> list[str]:
        return self.SUPPORTED_RESOURCES

    def __repr__(self) -> str:
        return f"CernerAdapter(base={self.fhir_base_url}, profile={self.fhir_profile})"
