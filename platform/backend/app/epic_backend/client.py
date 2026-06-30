"""
Epic Backend Services (client_credentials JWT) client.

Implements the SMART Backend Services profile:
https://hl7.org/fhir/smart-app-launch/backend-services.html

Flow:
  1. Sign a JWT with our private key (RS384). Claims: iss=sub=client_id,
     aud=token_endpoint, exp=now+5min, unique jti, kid in header.
  2. POST it to the token endpoint with grant_type=client_credentials.
  3. Epic returns an access_token (typically valid for 1 hour).
  4. Use the access_token to call FHIR APIs (Patient.Search, etc.).

Public functions (re-exported by app.epic_backend):
  - sign_backend_jwt(...)             → signed JWT string
  - get_backend_access_token(...)     → access_token + expires_in + scope
  - find_patient_by_demographics(...) → Patient resource by demo lookup
  - fetch_and_store_fhir_data(...)    → fetch 9 resource types, persist to disk
"""
from __future__ import annotations

import base64
import json
import logging
import time
import uuid
from dataclasses import asdict, dataclass
from typing import Any, Optional

import httpx
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding

from .keys import get_private_key, get_public_jwk
from .store import FhirData, save_fhir_data

logger = logging.getLogger(__name__)

# ── Constants ───────────────────────────────────────────────────────────────

# Non-Production Client ID for Epic's sandbox (fhir.epic.com).
# The production ID below only works against real hospital endpoints.
EPIC_BACKEND_CLIENT_ID = "c052a48b-dc67-4bc4-90a9-c3d90c212a1d"

# Production Client ID — distributed to Epic community member orgs.
# Used for real hospital FHIR endpoints, not the developer sandbox.
EPIC_PRODUCTION_CLIENT_ID = "38559a18-827a-4e50-85e2-891e0923cc97"

# Epic's developer sandbox endpoints.
EPIC_SANDBOX_TOKEN_ENDPOINT = (
    "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token"
)
EPIC_SANDBOX_FHIR_BASE = (
    "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4"
)

# Default scopes for system-level (Backend Services) read access.
DEFAULT_BACKEND_SCOPES = " ".join([
    "system/Patient.read",
    "system/Condition.read",
    "system/Observation.read",
    "system/MedicationRequest.read",
    "system/AllergyIntolerance.read",
    "system/Immunization.read",
    "system/Encounter.read",
    "system/Procedure.read",
    "system/DocumentReference.read",
])

# Shared httpx settings.
_TIMEOUT = httpx.Timeout(15.0, connect=10.0)
_FHIR_HEADERS = {
    "Accept": "application/fhir+json, application/json",
    "User-Agent": "LaunchFlow-PatientHealthAgent/1.0 EpicBackendServices",
}


# ── JWT signing ────────────────────────────────────────────────────────────

def _b64url(data: bytes | str) -> str:
    if isinstance(data, str):
        data = data.encode("utf-8")
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def sign_backend_jwt(
    client_id: str,
    token_endpoint: str,
    ttl_seconds: int = 300,
) -> str:
    """Build and sign a JWT to authenticate with Epic's token endpoint.

    Uses RS384 (Epic's required algorithm for Backend Services).
    """
    now = int(time.time())
    kid = get_public_jwk()["kid"]

    header = {"alg": "RS384", "typ": "JWT", "kid": kid}
    payload = {
        "iss": client_id,
        "sub": client_id,
        "aud": token_endpoint,
        "jti": str(uuid.uuid4()),
        "iat": now,
        "nbf": now,
        "exp": now + ttl_seconds,
    }

    encoded_header = _b64url(json.dumps(header, separators=(",", ":")))
    encoded_payload = _b64url(json.dumps(payload, separators=(",", ":")))
    signing_input = f"{encoded_header}.{encoded_payload}"

    private_key = get_private_key()
    signature = private_key.sign(
        signing_input.encode("ascii"),
        padding.PKCS1v15(),
        hashes.SHA384(),
    )
    return f"{signing_input}.{_b64url(signature)}"


# ── Token exchange ─────────────────────────────────────────────────────────

@dataclass
class TokenResponse:
    access_token: str
    expires_in: int
    token_type: str
    scope: Optional[str] = None


def get_backend_access_token(
    token_endpoint: str,
    client_id: Optional[str] = None,
    scope: Optional[str] = None,
) -> TokenResponse:
    """Exchange a signed JWT for an access token at the given token endpoint.

    Raises httpx.HTTPStatusError on non-2xx responses (caller should catch and
    surface error_description).
    """
    cid = client_id or EPIC_BACKEND_CLIENT_ID
    jwt = sign_backend_jwt(client_id=cid, token_endpoint=token_endpoint)

    form = {
        "grant_type": "client_credentials",
        "client_assertion_type":
            "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        "client_assertion": jwt,
        "scope": scope or DEFAULT_BACKEND_SCOPES,
    }

    resp = httpx.post(
        token_endpoint,
        data=form,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=_TIMEOUT,
    )
    if resp.status_code >= 400:
        raise httpx.HTTPStatusError(
            f"Token exchange failed: {resp.status_code} {resp.reason_phrase} — {resp.text}",
            request=resp.request,
            response=resp,
        )
    data = resp.json()
    return TokenResponse(
        access_token=data["access_token"],
        expires_in=int(data.get("expires_in", 3600)),
        token_type=data.get("token_type", "Bearer"),
        scope=data.get("scope"),
    )


# ── Patient lookup ─────────────────────────────────────────────────────────

@dataclass
class PatientDemographics:
    given: str
    family: str
    birthdate: Optional[str] = None  # YYYY-MM-DD
    gender: Optional[str] = None     # male|female|other|unknown
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    telecom: Optional[str] = None    # e.g. "608-123-4567"

    def to_search_params(self) -> dict[str, str]:
        params: dict[str, str] = {"given": self.given, "family": self.family}
        if self.birthdate:
            params["birthdate"] = self.birthdate
        if self.gender:
            params["gender"] = self.gender
        if self.address:
            params["address"] = self.address
        if self.city:
            params["address-city"] = self.city
        if self.state:
            params["address-state"] = self.state
        if self.postal_code:
            params["address-postalcode"] = self.postal_code
        if self.telecom:
            params["telecom"] = self.telecom
        return params

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


# Epic's known sandbox test patient. Demographics required for a clean match —
# Epic's sandbox returns no result for name+DOB alone, but matches readily
# when address/phone/gender are included.
EPIC_TEST_PATIENT_ALLISON = PatientDemographics(
    given="Allison",
    family="Mychart",
    gender="female",
    address="123 Main St.",
    city="Madison",
    state="Wisconsin",
    postal_code="53703",
    telecom="608-123-4567",
)


def find_patient_by_demographics(
    access_token: str,
    demographics: PatientDemographics,
    fhir_base: str = EPIC_SANDBOX_FHIR_BASE,
) -> Optional[dict]:
    """Search for a patient by demographics.

    Returns {patient_id, resource} dict for the first match, or None.
    Raises httpx.HTTPStatusError if Epic returns a non-2xx response.
    """
    url = f"{fhir_base.rstrip('/')}/Patient"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/fhir+json",
    }
    resp = httpx.get(
        url,
        params=demographics.to_search_params(),
        headers={**_FHIR_HEADERS, **headers},
        timeout=_TIMEOUT,
    )
    if resp.status_code >= 400:
        raise httpx.HTTPStatusError(
            f"Patient.Search failed: {resp.status_code} {resp.reason_phrase} — {resp.text}",
            request=resp.request,
            response=resp,
        )
    bundle = resp.json()
    entries = bundle.get("entry") or []
    if not entries:
        return None
    first = (entries[0] or {}).get("resource") or {}
    pid = first.get("id")
    if not pid:
        return None
    return {"patient_id": pid, "resource": first}


# ── FHIR resource bulk fetch ───────────────────────────────────────────────

# Resource queries to run in parallel. Mirrors the MyHealthSummary fetcher.
_RESOURCE_QUERIES: list[tuple[str, str]] = [
    ("conditions",     "Condition?patient={pid}&clinical-status=active&_count=100"),
    ("medications",    "MedicationRequest?patient={pid}&status=active&_count=100"),
    ("allergies",      "AllergyIntolerance?patient={pid}&_count=100"),
    ("labs",           "Observation?patient={pid}&category=laboratory&_count=100"),
    ("encounters",     "Encounter?patient={pid}&_count=50"),
    ("procedures",     "Procedure?patient={pid}&_count=100"),
    ("immunizations",  "Immunization?patient={pid}&_count=100"),
    ("documents",      "DocumentReference?patient={pid}&_count=50"),
]


def _fetch_one(
    client: httpx.Client,
    fhir_base: str,
    path: str,
    bearer: str,
) -> tuple[Optional[dict], Optional[str]]:
    url = f"{fhir_base.rstrip('/')}/{path}"
    try:
        resp = client.get(
            url,
            headers={"Authorization": bearer, **_FHIR_HEADERS},
        )
        if resp.status_code >= 400:
            return None, f"HTTP {resp.status_code} {resp.reason_phrase}"
        return resp.json(), None
    except Exception as exc:  # noqa: BLE001
        return None, str(exc)


def fetch_and_store_fhir_data(
    connection_id: str,
    adapter_id: str,
    access_token: str,
    patient_id: str,
    fhir_base: str = EPIC_SANDBOX_FHIR_BASE,
) -> FhirData:
    """Fetch the 9 key FHIR resources for a patient and persist them to disk.

    Non-fatal — per-resource failures are recorded in `errors` but don't raise.
    Returns the stored FhirData payload.
    """
    bearer = f"Bearer {access_token}"
    pid = httpx.QueryParams({"_": patient_id})["_"]  # safe encode

    bundles: dict[str, Any] = {}
    errors: dict[str, str] = {}

    with httpx.Client(timeout=_TIMEOUT) as client:
        # Patient first (single resource, not a Bundle).
        patient_data, patient_err = _fetch_one(
            client, fhir_base, f"Patient/{pid}", bearer,
        )
        if patient_err:
            errors["patient"] = patient_err

        for key, template in _RESOURCE_QUERIES:
            data, err = _fetch_one(
                client, fhir_base, template.format(pid=pid), bearer,
            )
            if err:
                errors[key] = err
            if data is not None:
                bundles[key] = data

    payload = FhirData(
        connection_id=connection_id,
        adapter_id=adapter_id,
        fetched_at=_iso_now(),
        patient=patient_data,
        conditions=bundles.get("conditions"),
        medications=bundles.get("medications"),
        allergies=bundles.get("allergies"),
        labs=bundles.get("labs"),
        encounters=bundles.get("encounters"),
        procedures=bundles.get("procedures"),
        immunizations=bundles.get("immunizations"),
        documents=bundles.get("documents"),
        errors=errors or None,
    )
    save_fhir_data(payload)
    return payload


def _iso_now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
