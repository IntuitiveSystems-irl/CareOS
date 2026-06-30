"""
Epic SMART Backend Services integration.

Implements the SMART on FHIR Backend Services profile
(https://hl7.org/fhir/smart-app-launch/backend-services.html) so LaunchFlow
can act as a SMART *client* of Epic's FHIR servers using a JWT-bearer
client_credentials grant.

This is server-to-server. The patient never sees a consent screen — the app
is pre-registered with the EHR and authenticated via an asymmetric key pair.

Distinct from `app/routers/smart_auth.py`, which makes LaunchFlow act as a
SMART *authorization server* for EHRs requesting access to patient data.
"""

from .client import (
    DEFAULT_BACKEND_SCOPES,
    EPIC_BACKEND_CLIENT_ID,
    EPIC_PRODUCTION_CLIENT_ID,
    EPIC_SANDBOX_FHIR_BASE,
    EPIC_SANDBOX_TOKEN_ENDPOINT,
    EPIC_TEST_PATIENT_ALLISON,
    PatientDemographics,
    fetch_and_store_fhir_data,
    find_patient_by_demographics,
    get_backend_access_token,
    sign_backend_jwt,
)
from .hospitals import EPIC_HOSPITALS, EpicHospital, find_hospital_by_id, search_hospitals
from .keys import get_jwks, get_private_key, get_public_jwk

__all__ = [
    "DEFAULT_BACKEND_SCOPES",
    "EPIC_BACKEND_CLIENT_ID",
    "EPIC_PRODUCTION_CLIENT_ID",
    "EPIC_SANDBOX_FHIR_BASE",
    "EPIC_SANDBOX_TOKEN_ENDPOINT",
    "EPIC_TEST_PATIENT_ALLISON",
    "EPIC_HOSPITALS",
    "EpicHospital",
    "PatientDemographics",
    "fetch_and_store_fhir_data",
    "find_hospital_by_id",
    "find_patient_by_demographics",
    "get_backend_access_token",
    "get_jwks",
    "get_private_key",
    "get_public_jwk",
    "search_hospitals",
    "sign_backend_jwt",
]
