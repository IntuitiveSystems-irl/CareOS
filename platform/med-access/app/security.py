"""
Security layer for the Medication Access Friction service.

Provides:
1. API key authentication (for service-to-service calls)
2. JWT token authentication (for user sessions)
3. Authorization middleware that gates all query endpoints
4. Rate limiting helpers (optional, for production)

No raw SQL is ever accepted from the client. All queries go through
the allowlisted template system in query_templates.py.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request, Security
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import settings

logger = logging.getLogger(__name__)

# ── API Key auth ──

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: Optional[str] = Security(_api_key_header)) -> str:
    """Validate the X-API-Key header against the configured key."""
    if not api_key or api_key != settings.MED_ACCESS_API_KEY:
        logger.warning("Invalid or missing API key")
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return api_key


# ── JWT auth ──

_bearer_scheme = HTTPBearer(auto_error=False)


def create_access_token(subject: str, extra_claims: dict | None = None) -> str:
    """Create a signed JWT access token."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
        "iss": "med-access-service",
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.MED_ACCESS_JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


async def verify_jwt(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer_scheme),
) -> dict:
    """Validate a Bearer JWT token and return the decoded payload."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.MED_ACCESS_JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError as e:
        logger.warning("JWT verification failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ── Combined auth: accept either API key OR JWT ──

async def require_auth(
    request: Request,
    api_key: Optional[str] = Security(_api_key_header),
    credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer_scheme),
) -> dict:
    """
    Gate endpoint access: caller must provide a valid API key OR a valid JWT.
    Returns an identity dict with auth method and subject.
    """
    # Try API key first
    if api_key and api_key == settings.MED_ACCESS_API_KEY:
        return {"auth_method": "api_key", "subject": "service-account", "ip": request.client.host if request.client else "unknown"}

    # Try JWT
    if credentials:
        try:
            payload = jwt.decode(
                credentials.credentials,
                settings.MED_ACCESS_JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM],
            )
            return {
                "auth_method": "jwt",
                "subject": payload.get("sub", "unknown"),
                "ip": request.client.host if request.client else "unknown",
            }
        except JWTError:
            pass

    logger.warning("Unauthorized access attempt from %s", request.client.host if request.client else "unknown")
    raise HTTPException(status_code=401, detail="Valid API key or Bearer token required")
