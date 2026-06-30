"""
SMART on FHIR Authorization Server endpoints.

Implements the core OAuth 2.0 flows per SMART on FHIR spec:
  - /.well-known/smart-configuration  (discovery)
  - /auth/authorize                   (authorization endpoint)
  - /auth/token                       (token exchange)
  - /auth/introspect                  (token introspection)

The patient agent acts as the authorization server — it issues tokens
after the patient consents and access fee is paid.
"""
import secrets
from datetime import datetime, timedelta

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.models import (
    Organization, Patient, AccessRequest, AccessToken,
    AccessRequestStatus, TokenStatus, Payment, PaymentStatus,
    AccessLog, ConsentSession, ConsentSessionStatus,
)

router = APIRouter(tags=["SMART on FHIR"])

JWT_SECRET = "patient-agent-jwt-secret-change-in-production"
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRY_HOURS = 1


# ── Discovery ──

@router.get("/.well-known/smart-configuration")
def smart_configuration():
    """SMART on FHIR discovery document."""
    base = settings.BASE_URL if hasattr(settings, "BASE_URL") else "http://localhost:8000"
    return {
        "issuer": base,
        "jwks_uri": f"{base}/.well-known/jwks.json",
        "authorization_endpoint": f"{base}/auth/authorize",
        "token_endpoint": f"{base}/auth/token",
        "introspection_endpoint": f"{base}/auth/introspect",
        "scopes_supported": [
            "patient/*.read",
            "patient/Patient.read",
            "patient/Condition.read",
            "patient/MedicationRequest.read",
            "patient/AllergyIntolerance.read",
            "patient/Observation.read",
            "patient/Encounter.read",
            "patient/AuditEvent.read",
            "patient/Consent.read",
            "patient/Task.read",
            "patient/DetectedIssue.read",
            "patient/DocumentReference.read",
            "patient/Provenance.read",
            "patient/ResearchStudy.read",
            "patient/ResearchSubject.read",
            "system/*.read",
            "launch",
            "launch/patient",
            "openid",
            "profile",
            "fhirUser",
            "offline_access",
        ],
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["client_secret_basic", "client_secret_post", "private_key_jwt"],
        "capabilities": [
            "launch-ehr",
            "launch-standalone",
            "client-public",
            "client-confidential-symmetric",
            "context-ehr-patient",
            "context-standalone-patient",
            "permission-patient",
            "permission-user",
            "permission-offline",
            "sso-openid-connect",
        ],
        "services": [
            {
                "type": "CDS Hooks",
                "url": f"{base}/cds-services",
                "description": "CareOS CDS Hooks — deterministic patient-safety cards (no LLM). "
                               "Hooks: patient-view, order-select, order-sign.",
            }
        ],
    }


@router.get("/fhir/metadata")
def fhir_capability_statement():
    """FHIR R4 CapabilityStatement — advertises all CareOS FHIR capabilities."""
    base = settings.BASE_URL if hasattr(settings, "BASE_URL") else "http://localhost:8000"

    def _resource(rt: str, profiles: list[str] | None = None, extra_ops: list[dict] | None = None) -> dict:
        r: dict = {
            "type": rt,
            "interaction": [{"code": "read"}, {"code": "search-type"}],
            "searchParam": [],
        }
        if profiles:
            r["supportedProfile"] = profiles
        if extra_ops:
            r["operation"] = extra_ops
        return r

    return {
        "resourceType": "CapabilityStatement",
        "id": "careos-capability",
        "url": f"{base}/fhir/metadata",
        "version": "1.0.0",
        "name": "CareOSCapabilityStatement",
        "title": "CareOS FHIR Server Capability Statement",
        "status": "active",
        "experimental": False,
        "date": "2026-06-30",
        "publisher": "Business Intuitive Inc.",
        "contact": [{"name": "CareOS", "telecom": [{"system": "url", "value": base}]}],
        "description": (
            "CareOS FHIR R4 server: patient-controlled health data relay with "
            "SMART on FHIR authorization, USCDI v3 Bulk Data export, CDS Hooks, "
            "tamper-evident audit chain, and relational safety engine."
        ),
        "kind": "instance",
        "implementation": {
            "description": "CareOS Patient Health Data Agent",
            "url": f"{base}/fhir",
        },
        "fhirVersion": "4.0.1",
        "format": ["application/fhir+json", "json"],
        "patchFormat": [],
        "instantiates": [
            "http://hl7.org/fhir/us/core/CapabilityStatement/us-core-server",
        ],
        "implementationGuide": [
            "http://hl7.org/fhir/us/core/ImplementationGuide/hl7.fhir.us.core",
        ],
        "rest": [{
            "mode": "server",
            "security": {
                "cors": True,
                "extension": [{
                    "url": "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris",
                    "extension": [
                        {"url": "authorize", "valueUri": f"{base}/auth/authorize"},
                        {"url": "token",     "valueUri": f"{base}/auth/token"},
                        {"url": "introspect","valueUri": f"{base}/auth/introspect"},
                    ],
                }],
                "service": [{
                    "coding": [{"system": "http://terminology.hl7.org/CodeSystem/restful-security-service", "code": "SMART-on-FHIR"}],
                    "text": "OAuth2 with SMART on FHIR",
                }],
                "description": "SMART on FHIR — authorization code flow with PKCE required for public clients.",
            },
            "resource": [
                _resource("Patient", profiles=["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"]),
                _resource("Condition", profiles=["http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition"]),
                _resource("MedicationRequest", profiles=["http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest"]),
                _resource("AllergyIntolerance", profiles=["http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance"]),
                _resource("Observation", profiles=["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab"]),
                _resource("Encounter", profiles=["http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter"]),
                _resource("AuditEvent"),
                _resource("Consent"),
                _resource("Task"),
                _resource("DetectedIssue"),
                _resource("DocumentReference", profiles=["http://hl7.org/fhir/us/core/StructureDefinition/us-core-documentreference"]),
                _resource("Provenance", profiles=["http://hl7.org/fhir/us/core/StructureDefinition/us-core-provenance"]),
                _resource("ResearchStudy"),
                _resource("ResearchSubject"),
            ],
            "operation": [
                {
                    "name": "export",
                    "definition": "http://hl7.org/fhir/uv/bulkdata/OperationDefinition/group-export",
                    "documentation": (
                        "SMART Bulk Data export. POST /api/careos/$export kicks off async NDJSON export. "
                        "GET /api/careos/$export-status/{job_id} polls. "
                        "GET /api/careos/$export-files/{job_id}/{rt} downloads NDJSON."
                    ),
                },
                {
                    "name": "uscdi",
                    "definition": f"{base}/fhir/metadata",
                    "documentation": "GET /api/careos/patients/{external_id}/uscdi returns a USCDI v3 collection Bundle.",
                },
            ],
            "interaction": [
                {"code": "search-system"},
                {"code": "batch"},
                {"code": "transaction"},
            ],
            "searchParam": [
                {"name": "_id", "type": "token", "documentation": "Logical id of the resource"},
                {"name": "_lastUpdated", "type": "date", "documentation": "Last updated date"},
                {"name": "_profile", "type": "uri", "documentation": "Profiles the resource conforms to"},
            ],
        }],
        "messaging": [],
        "document": [],
    }


# ── Authorization ──

@router.get("/auth/authorize")
def authorize(
    response_type: str = Query("code"),
    client_id: str = Query(...),
    redirect_uri: str = Query(...),
    scope: str = Query("patient/*.read"),
    state: str = Query(""),
    launch: str = Query(""),  # SMART launch context (consent session token)
    aud: str = Query(""),
    db: Session = Depends(get_db),
):
    """
    SMART on FHIR authorize endpoint. In a full implementation, this would
    render a consent UI. For the prototype, it checks for an existing
    approved consent session and returns an authorization code.
    """
    org = db.query(Organization).filter(Organization.client_id == client_id).first()
    if not org:
        raise HTTPException(status_code=400, detail="Unknown client_id")

    if org.redirect_uri and org.redirect_uri != redirect_uri:
        raise HTTPException(status_code=400, detail="redirect_uri mismatch")

    # Check if there's an approved consent session for this launch context
    if launch:
        session = db.query(ConsentSession).filter(
            ConsentSession.session_token == launch,
            ConsentSession.organization_id == org.id,
            ConsentSession.status == ConsentSessionStatus.approved,
        ).first()
        if not session:
            raise HTTPException(
                status_code=403,
                detail="No approved consent session for this launch context. Patient must approve first.",
            )

    # Generate authorization code (short-lived)
    auth_code = secrets.token_urlsafe(32)

    # Store as a pending access request with the auth code in purpose field
    ar = AccessRequest(
        patient_id=session.patient_id if launch and session else 1,
        requesting_org_id=org.id,
        purpose=f"SMART_AUTH_CODE:{auth_code}|{scope}",
        status=AccessRequestStatus.approved,
        scopes=scope,
        resolved_at=datetime.utcnow(),
    )
    db.add(ar)
    db.commit()

    return {
        "redirect": f"{redirect_uri}?code={auth_code}&state={state}",
        "code": auth_code,
        "state": state,
    }


# ── Token Exchange ──

@router.post("/auth/token")
def token_exchange(
    grant_type: str = Form("authorization_code"),
    code: str = Form(""),
    client_id: str = Form(""),
    client_secret: str = Form(""),
    redirect_uri: str = Form(""),
    db: Session = Depends(get_db),
):
    """
    SMART on FHIR token endpoint. Exchanges authorization code for access token.
    """
    if grant_type != "authorization_code":
        raise HTTPException(status_code=400, detail="Unsupported grant_type")

    # Validate client
    org = db.query(Organization).filter(Organization.client_id == client_id).first()
    if not org:
        raise HTTPException(status_code=401, detail="Invalid client_id")

    if org.client_secret and org.client_secret != client_secret:
        raise HTTPException(status_code=401, detail="Invalid client_secret")

    # Find the access request with this auth code
    ar = db.query(AccessRequest).filter(
        AccessRequest.purpose.like(f"SMART_AUTH_CODE:{code}|%"),
        AccessRequest.requesting_org_id == org.id,
        AccessRequest.status == AccessRequestStatus.approved,
    ).first()

    if not ar:
        raise HTTPException(status_code=400, detail="Invalid or expired authorization code")

    # Check payment
    payment = db.query(Payment).filter(
        Payment.access_request_id == ar.id,
        Payment.status == PaymentStatus.completed,
    ).first()

    # Extract scopes from stored purpose
    scopes = ar.scopes or "patient/*.read"

    # Generate JWT access token
    expires_at = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRY_HOURS)
    token_payload = {
        "sub": str(ar.patient_id),
        "iss": "patient-health-data-agent",
        "aud": org.client_id,
        "exp": expires_at,
        "iat": datetime.utcnow(),
        "scope": scopes,
        "patient": str(ar.patient_id),
        "org_id": org.id,
        "access_request_id": ar.id,
    }
    jwt_token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    # Store token
    access_token = AccessToken(
        token=jwt_token,
        access_request_id=ar.id,
        patient_id=ar.patient_id,
        organization_id=org.id,
        scopes=scopes,
        expires_at=expires_at,
    )
    db.add(access_token)

    # Log
    log = AccessLog(
        patient_id=ar.patient_id,
        requesting_org_id=org.id,
        action="token_issued",
        details=f"SMART on FHIR access token issued. Scopes: {scopes}",
    )
    db.add(log)
    db.commit()

    # Clear the auth code from purpose
    ar.purpose = ar.purpose.replace(f"SMART_AUTH_CODE:{code}|", "Token issued — ")
    db.commit()

    return {
        "access_token": jwt_token,
        "token_type": "Bearer",
        "expires_in": TOKEN_EXPIRY_HOURS * 3600,
        "scope": scopes,
        "patient": str(ar.patient_id),
    }


# ── Token Introspection ──

@router.post("/auth/introspect")
def introspect_token(
    token: str = Form(...),
    db: Session = Depends(get_db),
):
    """Validate an access token and return its claims."""
    stored = db.query(AccessToken).filter(AccessToken.token == token).first()
    if not stored or stored.status != TokenStatus.active:
        return {"active": False}

    if stored.expires_at < datetime.utcnow():
        stored.status = TokenStatus.expired
        db.commit()
        return {"active": False}

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        return {"active": False}

    return {
        "active": True,
        "sub": payload.get("sub"),
        "scope": payload.get("scope"),
        "patient": payload.get("patient"),
        "exp": payload.get("exp"),
        "iss": payload.get("iss"),
        "token_type": "Bearer",
    }


# ── Helper: validate Bearer token from FHIR requests ──

def validate_smart_token(authorization: str, db: Session) -> dict:
    """
    Validates a Bearer token from a FHIR API request.
    Returns the decoded claims or raises HTTPException.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = authorization[7:]

    stored = db.query(AccessToken).filter(AccessToken.token == token).first()
    if not stored or stored.status != TokenStatus.active:
        raise HTTPException(status_code=401, detail="Invalid or revoked token")

    if stored.expires_at < datetime.utcnow():
        stored.status = TokenStatus.expired
        db.commit()
        raise HTTPException(status_code=401, detail="Token expired")

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
