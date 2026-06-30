"""
Epic Backend Services HTTP routes.

Exposes the SMART Backend Services (JWT bearer client_credentials) flow as
HTTP endpoints so the frontend / GPT Actions layer can drive it:

  GET  /.well-known/jwks.json                       JWKS (non-prod)
  GET  /.well-known/jwks-prod.json                  JWKS (prod)
  GET  /api/epic-backend/test                       One-shot integration test
  POST /api/epic-backend/backend-fetch              Full E2E (token→search→fetch)
  GET  /api/epic-backend/hospitals?q=&limit=        Search Epic hospital directory
  GET  /api/epic-backend/fhir-data/{connection_id}  Summary of persisted FHIR data

Distinct from /auth/* in `smart_auth.py` (LaunchFlow as auth server) and
/api/ehr-adapters/* in `ehr_adapters.py` (vendor adapter abstraction).
"""
from __future__ import annotations

import logging
import re
import secrets
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.epic_backend import (
    DEFAULT_BACKEND_SCOPES,
    EPIC_BACKEND_CLIENT_ID,
    EPIC_SANDBOX_FHIR_BASE,
    EPIC_SANDBOX_TOKEN_ENDPOINT,
    EPIC_TEST_PATIENT_ALLISON,
    PatientDemographics,
    fetch_and_store_fhir_data,
    find_patient_by_demographics,
    get_backend_access_token,
    get_jwks,
    search_hospitals,
    sign_backend_jwt,
)
from app.epic_backend.hospitals import to_dicts as hospitals_to_dicts
from app.epic_backend.store import count_bundle_entries, load_fhir_data

logger = logging.getLogger(__name__)

# Two routers: one for /.well-known/* (no prefix) and one for /api/epic-backend/*.
wellknown_router = APIRouter(tags=["epic-backend-services"])
router = APIRouter(prefix="/api/epic-backend", tags=["epic-backend-services"])


# ── JWKS (public key publication) ───────────────────────────────────────────

@wellknown_router.get("/.well-known/jwks.json")
def jwks_nonprod() -> dict:
    """Public JWK Set — Epic uses this to verify JWTs signed with our private key.

    Register this URL in Epic's Backend Systems app config as the
    Non-Production JWK Set URL.
    """
    try:
        return get_jwks()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@wellknown_router.get("/.well-known/jwks-prod.json")
def jwks_prod() -> dict:
    """Production JWK Set. Epic requires distinct URLs for non-prod vs prod.

    In a real deployment generate a separate key pair and serve a different
    public key here. For now serves the same key as non-prod.
    """
    try:
        return get_jwks()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ── Integration test ────────────────────────────────────────────────────────

@router.get("/test")
def epic_backend_test(
    use_test_patient: int = Query(0, alias="useTestPatient", ge=0, le=1),
    given: Optional[str] = Query(None),
    family: Optional[str] = Query(None),
    birthdate: Optional[str] = Query(None, description="YYYY-MM-DD"),
) -> dict:
    """One-shot test of the Epic Backend Services flow.

    Steps:
      1. Sign a JWT with our private key.
      2. Exchange for an access token at Epic's sandbox token endpoint.
      3. Optionally search for a patient by demographics.

    Examples:
      /api/epic-backend/test
      /api/epic-backend/test?useTestPatient=1
      /api/epic-backend/test?given=Camila&family=Lopez&birthdate=1987-09-12
    """
    result: dict = {
        "clientId": EPIC_BACKEND_CLIENT_ID,
        "tokenEndpoint": EPIC_SANDBOX_TOKEN_ENDPOINT,
        "fhirBase": EPIC_SANDBOX_FHIR_BASE,
    }

    # Step 1: show the signed JWT (debuggable on jwt.io).
    try:
        result["jwt"] = sign_backend_jwt(
            client_id=EPIC_BACKEND_CLIENT_ID,
            token_endpoint=EPIC_SANDBOX_TOKEN_ENDPOINT,
        )
    except Exception as exc:  # noqa: BLE001
        result["jwtError"] = str(exc)
        raise HTTPException(status_code=500, detail=result) from exc

    # Step 2: exchange for access token.
    try:
        token = get_backend_access_token(
            token_endpoint=EPIC_SANDBOX_TOKEN_ENDPOINT,
        )
        result["tokenResponse"] = {
            "access_token": f"{token.access_token[:24]}…(redacted)",
            "expires_in": token.expires_in,
            "token_type": token.token_type,
            "scope": token.scope,
        }
    except Exception as exc:  # noqa: BLE001
        result["tokenError"] = str(exc)
        raise HTTPException(status_code=502, detail=result) from exc

    # Step 3 (optional): search for patient by demographics.
    demographics: Optional[PatientDemographics] = None
    if use_test_patient:
        demographics = EPIC_TEST_PATIENT_ALLISON
    elif given and family:
        demographics = PatientDemographics(
            given=given, family=family, birthdate=birthdate,
        )

    if demographics:
        result["demographicsUsed"] = demographics.as_dict()
        try:
            match = find_patient_by_demographics(
                access_token=token.access_token,
                demographics=demographics,
            )
            result["patientSearch"] = (
                {"found": True, "patientId": match["patient_id"], "resource": match["resource"]}
                if match else {"found": False}
            )
        except Exception as exc:  # noqa: BLE001
            result["patientSearchError"] = str(exc)

    return result


# ── End-to-end fetch ────────────────────────────────────────────────────────

class BackendFetchRequest(BaseModel):
    use_test_patient: bool = Field(False, alias="useTestPatient")
    given: Optional[str] = None
    family: Optional[str] = None
    birthdate: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = Field(None, alias="postalCode")
    telecom: Optional[str] = None

    class Config:
        populate_by_name = True
        extra = "ignore"


@router.post("/backend-fetch")
def backend_fetch(body: BackendFetchRequest) -> dict:
    """Run the full Epic Backend Services E2E flow.

    1. Resolve demographics (request body or known test patient).
    2. Get an access token from Epic's sandbox token endpoint.
    3. Patient.Search by demographics.
    4. Fetch the 9 key FHIR resources for the matched patient.
    5. Persist them to .data/fhir-{connection_id}.json.
    """
    # Resolve demographics.
    demographics: Optional[PatientDemographics] = None
    if body.use_test_patient:
        demographics = EPIC_TEST_PATIENT_ALLISON
    elif body.given and body.family:
        demographics = PatientDemographics(
            given=body.given,
            family=body.family,
            birthdate=body.birthdate,
            gender=body.gender,
            address=body.address,
            city=body.city,
            state=body.state,
            postal_code=body.postal_code,
            telecom=body.telecom,
        )

    if not demographics:
        raise HTTPException(
            status_code=400,
            detail={"ok": False, "error": "Provide useTestPatient=true or given+family."},
        )

    # Step 1: access token.
    try:
        token = get_backend_access_token(
            token_endpoint=EPIC_SANDBOX_TOKEN_ENDPOINT,
        )
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "ok": False,
                "stage": "token",
                "error": str(exc),
                "clientId": EPIC_BACKEND_CLIENT_ID,
                "hint": (
                    "If invalid_client persists, the Backend Systems app is "
                    "still propagating at Epic — usually 30–60 minutes after "
                    "registration."
                ),
            },
        ) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500,
            detail={"ok": False, "stage": "token", "error": str(exc)},
        ) from exc

    # Step 2: Patient.Search.
    try:
        match = find_patient_by_demographics(
            access_token=token.access_token,
            demographics=demographics,
            fhir_base=EPIC_SANDBOX_FHIR_BASE,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail={
                "ok": False,
                "stage": "patient-search",
                "error": str(exc),
                "demographics": demographics.as_dict(),
            },
        ) from exc

    if not match:
        raise HTTPException(
            status_code=404,
            detail={
                "ok": False,
                "stage": "patient-search",
                "demographics": demographics.as_dict(),
                "error": "No patient match found with these demographics.",
            },
        )

    patient_id = match["patient_id"]
    connection_id = f"conn_{secrets.token_urlsafe(9)}"

    # Step 3: bulk FHIR fetch + persist.
    try:
        fetch_and_store_fhir_data(
            connection_id=connection_id,
            adapter_id="epic_backend_sandbox",
            access_token=token.access_token,
            patient_id=patient_id,
            fhir_base=EPIC_SANDBOX_FHIR_BASE,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail={
                "ok": False,
                "stage": "fhir-fetch",
                "error": str(exc),
                "patientId": patient_id,
                "connectionId": connection_id,
            },
        ) from exc

    return {
        "ok": True,
        "patientId": patient_id,
        "connectionId": connection_id,
        "demographicsUsed": demographics.as_dict(),
    }


# ── Hospital directory search ───────────────────────────────────────────────

@router.get("/hospitals")
def hospitals(
    q: str = Query("", description="Substring match on hospital name"),
    limit: int = Query(25, ge=1, le=100),
) -> dict:
    """Search the Epic hospital directory (open.epic.com endpoints)."""
    results = search_hospitals(q, limit=limit)
    return {"results": hospitals_to_dicts(results), "total": len(results)}


# ── Persisted FHIR data summary ─────────────────────────────────────────────

_CONNECTION_ID_RE = re.compile(r"^[A-Za-z0-9_\-]+$")


@router.get("/fhir-data/{connection_id}")
def fhir_data(connection_id: str) -> dict:
    """Return a summary of FHIR resources persisted for a given connection."""
    if not _CONNECTION_ID_RE.match(connection_id):
        raise HTTPException(status_code=400, detail={"ok": False, "error": "Invalid connectionId"})

    data = load_fhir_data(connection_id)
    if data is None:
        raise HTTPException(
            status_code=404,
            detail={"ok": False, "error": "No FHIR data found for that connection."},
        )

    patient = data.get("patient") or {}
    names = patient.get("name") or []
    first_name = names[0] if names else {}
    patient_name = (
        first_name.get("text")
        or " ".join(filter(None, [" ".join(first_name.get("given") or []), first_name.get("family")]))
        or ""
    ).strip()

    return {
        "ok": True,
        "connectionId": data.get("connection_id"),
        "adapterId": data.get("adapter_id"),
        "fetchedAt": data.get("fetched_at"),
        "patient": {
            "id": patient.get("id"),
            "name": patient_name,
            "birthDate": patient.get("birthDate"),
            "gender": patient.get("gender"),
        },
        "counts": {
            "conditions": count_bundle_entries(data.get("conditions")),
            "medications": count_bundle_entries(data.get("medications")),
            "allergies": count_bundle_entries(data.get("allergies")),
            "labs": count_bundle_entries(data.get("labs")),
            "encounters": count_bundle_entries(data.get("encounters")),
            "procedures": count_bundle_entries(data.get("procedures")),
            "immunizations": count_bundle_entries(data.get("immunizations")),
            "documents": count_bundle_entries(data.get("documents")),
        },
        "errors": data.get("errors") or None,
    }


# ── Defaults / scope info ───────────────────────────────────────────────────

@router.get("/defaults")
def defaults() -> dict:
    """Return the constants this router uses — handy for the frontend."""
    return {
        "clientId": EPIC_BACKEND_CLIENT_ID,
        "tokenEndpoint": EPIC_SANDBOX_TOKEN_ENDPOINT,
        "fhirBase": EPIC_SANDBOX_FHIR_BASE,
        "defaultScopes": DEFAULT_BACKEND_SCOPES,
        "testPatient": EPIC_TEST_PATIENT_ALLISON.as_dict(),
    }
