"""
OUTBOUND SMART on FHIR connection — CareOS as a SMART-on-FHIR *app client*.

This is what makes CareOS "plug into any EHR": an operator points an
Organization at a vendor FHIR base URL, runs the SMART authorization-code
flow (with PKCE), and CareOS stores the resulting access token so every
subsequent FHIR pull is authorized.

Flow
----
1. ``POST /api/ehr-connect/org/{org_id}/authorize-url``
   - discovers the org's SMART endpoints (live)
   - mints a PKCE verifier/challenge + ``state``, persists them
   - returns the vendor authorize URL for the operator to visit

2. ``GET /api/ehr-connect/callback?code=…&state=…``
   - the EHR redirects here; we exchange ``code`` (+ verifier) for a token
   - the token is stored in ``external_ehr_tokens`` and we redirect the
     operator back to the Connections screen

3. ``GET  /api/ehr-connect/org/{org_id}/status``   — is the org connected?
   ``POST /api/ehr-connect/org/{org_id}/refresh``  — refresh the token
   ``POST /api/ehr-connect/org/{org_id}/disconnect`` — revoke locally

A small ``get_active_token`` helper is reused by the EHR-adapter fetch route
so live resource pulls automatically use a stored token when present.
"""
from __future__ import annotations

import base64
import hashlib
import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import (
    Organization, ExternalEhrToken, EhrAuthSession, TokenStatus,
)
from app.connectors.ehr.ehr_router import get_adapter_for_org

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ehr-connect", tags=["ehr-connect"])


# ── Helpers ──────────────────────────────────────────────────────────────────

def _callback_url() -> str:
    return f"{settings.BASE_URL.rstrip('/')}/api/ehr-connect/callback"


def _pkce_pair() -> tuple[str, str]:
    """Return (code_verifier, code_challenge) for PKCE S256."""
    verifier = secrets.token_urlsafe(64)[:96]
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return verifier, challenge


def _get_org(org_id: int, db: Session) -> Organization:
    org = db.query(Organization).get(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


def get_active_token(db: Session, org_id: int) -> Optional[ExternalEhrToken]:
    """Return the freshest active, non-expired token for an org (or None)."""
    tok = (
        db.query(ExternalEhrToken)
        .filter(
            ExternalEhrToken.organization_id == org_id,
            ExternalEhrToken.status == TokenStatus.active,
        )
        .order_by(desc(ExternalEhrToken.issued_at))
        .first()
    )
    if not tok:
        return None
    if tok.expires_at and tok.expires_at < datetime.utcnow():
        tok.status = TokenStatus.expired
        db.commit()
        return None
    return tok


def _token_status_payload(org: Organization, tok: Optional[ExternalEhrToken]) -> dict:
    if not tok:
        return {
            "org_id": org.id,
            "org_name": org.name,
            "connected": False,
            "status": "disconnected",
        }
    return {
        "org_id": org.id,
        "org_name": org.name,
        "connected": True,
        "status": tok.status.value,
        "scope": tok.scope,
        "patient_context": tok.patient_context,
        "token_type": tok.token_type,
        "issued_at": tok.issued_at.isoformat() if tok.issued_at else None,
        "expires_at": tok.expires_at.isoformat() if tok.expires_at else None,
        "has_refresh_token": bool(tok.refresh_token),
    }


# ── 1. Build authorize URL ───────────────────────────────────────────────────

@router.post("/org/{org_id}/authorize-url")
def build_authorize_url(
    org_id: int,
    redirect_back: str = Query("", description="frontend URL to return to after connect"),
    db: Session = Depends(get_db),
) -> dict:
    """Discover SMART endpoints + mint a PKCE authorize URL for this org."""
    org = _get_org(org_id, db)
    adapter = get_adapter_for_org(org)
    config = adapter.discover_smart_config()

    if not config.authorization_endpoint:
        raise HTTPException(
            status_code=400,
            detail=(
                "No SMART authorization endpoint discovered for this server. "
                "It may be an open/no-auth FHIR endpoint — you can pull resources "
                "directly without connecting."
            ),
        )

    verifier, challenge = _pkce_pair()
    state = secrets.token_urlsafe(24)
    scopes = adapter._default_scopes()

    db.add(EhrAuthSession(
        state=state,
        organization_id=org.id,
        code_verifier=verifier,
        scopes=" ".join(scopes),
        redirect_back=redirect_back or "",
        status="pending",
    ))
    db.commit()

    url = adapter.authorize_url(
        scopes=scopes,
        state=state,
        code_challenge=challenge,
        redirect_uri=_callback_url(),
    )
    return {
        "org_id": org.id,
        "authorize_url": url,
        "state": state,
        "redirect_uri": _callback_url(),
        "scopes": scopes,
        "authorization_endpoint": config.authorization_endpoint,
        "token_endpoint": config.token_endpoint,
    }


# ── 2. OAuth callback ────────────────────────────────────────────────────────

@router.get("/callback")
def oauth_callback(
    code: str = Query(""),
    state: str = Query(""),
    error: str = Query(""),
    error_description: str = Query(""),
    db: Session = Depends(get_db),
):
    """Handle the EHR redirect: exchange the code (+PKCE verifier) for a token."""
    sess = db.query(EhrAuthSession).filter(EhrAuthSession.state == state).first()
    if not sess:
        raise HTTPException(status_code=400, detail="Unknown or expired state")

    def _finish(ok: bool, detail: str = "") -> RedirectResponse:
        sess.status = "completed" if ok else "failed"
        sess.detail = detail or None
        db.commit()
        base = sess.redirect_back or "/ehr/connections"
        sep = "&" if "?" in base else "?"
        flag = f"connected={sess.organization_id}" if ok else f"connect_error={detail or 'failed'}"
        return RedirectResponse(url=f"{base}{sep}{flag}", status_code=302)

    if error:
        return _finish(False, f"{error}: {error_description}".strip(": "))
    if not code:
        return _finish(False, "No authorization code returned")

    org = _get_org(sess.organization_id, db)
    adapter = get_adapter_for_org(org)
    result = adapter.exchange_token(
        authorization_code=code,
        code_verifier=sess.code_verifier,
        redirect_uri=_callback_url(),
    )
    if not result.success:
        return _finish(False, result.error or "Token exchange failed")

    # Revoke any prior active tokens for this org.
    db.query(ExternalEhrToken).filter(
        ExternalEhrToken.organization_id == org.id,
        ExternalEhrToken.status == TokenStatus.active,
    ).update({ExternalEhrToken.status: TokenStatus.revoked})

    expires_at = (
        datetime.utcnow() + timedelta(seconds=result.expires_in)
        if result.expires_in else None
    )
    db.add(ExternalEhrToken(
        organization_id=org.id,
        access_token=result.access_token,
        refresh_token=result.refresh_token or None,
        token_type=result.token_type or "Bearer",
        scope=result.scope or sess.scopes,
        patient_context=result.patient_id or None,
        status=TokenStatus.active,
        expires_at=expires_at,
    ))
    return _finish(True)


# ── 3. Status / refresh / disconnect ─────────────────────────────────────────

@router.get("/org/{org_id}/status")
def connection_status(org_id: int, db: Session = Depends(get_db)) -> dict:
    org = _get_org(org_id, db)
    tok = get_active_token(db, org_id)
    return _token_status_payload(org, tok)


@router.get("/status")
def all_connection_status(db: Session = Depends(get_db)) -> dict:
    """Connection status for every org — backs the Connections dashboard."""
    orgs = db.query(Organization).all()
    return {
        "connections": [
            _token_status_payload(org, get_active_token(db, org.id))
            for org in orgs
        ]
    }


@router.post("/org/{org_id}/refresh")
def refresh_connection(org_id: int, db: Session = Depends(get_db)) -> dict:
    org = _get_org(org_id, db)
    tok = (
        db.query(ExternalEhrToken)
        .filter(ExternalEhrToken.organization_id == org_id)
        .order_by(desc(ExternalEhrToken.issued_at))
        .first()
    )
    if not tok or not tok.refresh_token:
        raise HTTPException(status_code=400, detail="No refresh token on file for this org")

    adapter = get_adapter_for_org(org)
    result = adapter.refresh_access_token(tok.refresh_token)
    if not result.success:
        raise HTTPException(status_code=502, detail=f"Refresh failed: {result.error}")

    tok.access_token = result.access_token
    if result.refresh_token:
        tok.refresh_token = result.refresh_token
    tok.status = TokenStatus.active
    tok.issued_at = datetime.utcnow()
    tok.expires_at = (
        datetime.utcnow() + timedelta(seconds=result.expires_in)
        if result.expires_in else None
    )
    db.commit()
    return _token_status_payload(org, tok)


@router.post("/org/{org_id}/disconnect")
def disconnect(org_id: int, db: Session = Depends(get_db)) -> dict:
    org = _get_org(org_id, db)
    n = (
        db.query(ExternalEhrToken)
        .filter(
            ExternalEhrToken.organization_id == org_id,
            ExternalEhrToken.status == TokenStatus.active,
        )
        .update({ExternalEhrToken.status: TokenStatus.revoked})
    )
    db.commit()
    return {"org_id": org_id, "revoked": n, "connected": False, "status": "disconnected"}
