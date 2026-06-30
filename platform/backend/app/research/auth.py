"""
Researcher access control for the study's analytics + export endpoints.

A single shared passcode (``RESEARCH_ADMIN_PASSCODE``) gates the
researcher-only routes. Participant-facing routes stay open (participants are
anonymous and unauthenticated). Fail-closed: if no passcode is configured,
researcher access is denied.

The passcode must be supplied via the ``X-Research-Key`` header. Query-string
credentials were intentionally removed (R-3) so the passcode never lands in
nginx/proxy access logs or browser history. Every authenticated attempt —
success or failure — is appended to an audit log (R-6) for integrity monitoring
and incident response.
"""
import secrets
from typing import Optional

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.research.models import ResearcherAuditLog


def _client_ip(request: Request) -> Optional[str]:
    """Best-effort client IP, honoring the nginx X-Forwarded-For header."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else None


def _audit(db: Session, request: Request, ok: bool, detail: Optional[str] = None) -> None:
    """Append a researcher-access audit row. Never breaks the request path."""
    try:
        db.add(ResearcherAuditLog(
            action=f"{request.method} {request.url.path}",
            ok=ok,
            detail=detail,
            ip=_client_ip(request),
        ))
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()


def require_researcher(
    request: Request,
    x_research_key: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> bool:
    expected = (settings.RESEARCH_ADMIN_PASSCODE or "").strip()
    if not expected:
        _audit(db, request, ok=False, detail="not_configured")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Researcher access is not configured",
        )
    supplied = (x_research_key or "").strip()
    if not supplied or not secrets.compare_digest(supplied, expected):
        _audit(db, request, ok=False, detail="invalid_key")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid researcher passcode",
        )
    _audit(db, request, ok=True)
    return True
