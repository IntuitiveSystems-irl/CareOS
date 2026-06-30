"""
Relay HTTP routes.

Operator-facing endpoints for observability of the integration engine.
Mounted under /api/relay/* by app.main. PHI is never returned in plaintext;
inbound bodies remain envelope-encrypted in the DB and only resource
identifiers / hashes / counts are surfaced here.

    GET  /api/relay/status                   relay + per-listener health
    GET  /api/relay/audit/verify             walk the hash-chained audit log
    GET  /api/relay/audit/recent?limit=50    most recent audit rows (no PHI)
    GET  /api/relay/messages/recent?limit=20 most recent inbound messages
    GET  /api/relay/messages/{message_id}    single inbound message metadata
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.integration.audit.models import AuditEntry
from app.integration.audit.recorder import verify_chain
from app.integration.crypto.envelope import kek_fingerprint
from app.integration.registry import get_relay
from app.integration.storage.models import RelayInboundMessage, RelayFhirResource

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/relay", tags=["relay"])


# ── Status / health ─────────────────────────────────────────────────────────

@router.get("/status")
def relay_status() -> dict:
    """Overall relay health: which listeners are up, pipeline counters."""
    relay = get_relay()
    return {
        "ok": True,
        "kek_fingerprint": kek_fingerprint(),
        **relay.health(),
    }


# ── Audit chain ─────────────────────────────────────────────────────────────

@router.get("/audit/verify")
def audit_verify(
    since_id: Optional[int] = Query(None, ge=0),
    db: Session = Depends(get_db),
) -> dict:
    """Walk the audit chain. Returns the first id (if any) where it breaks."""
    return verify_chain(db, since_id=since_id)


@router.get("/audit/recent")
def audit_recent(
    limit: int = Query(50, ge=1, le=500),
    actor: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    db: Session = Depends(get_db),
) -> dict:
    """Most recent audit rows. PHI-safe: returns hashes, not content."""
    q = db.query(AuditEntry).order_by(AuditEntry.id.desc())
    if actor:
        q = q.filter(AuditEntry.actor == actor)
    if action:
        q = q.filter(AuditEntry.action == action)
    rows = q.limit(limit).all()
    return {
        "count": len(rows),
        "entries": [
            {
                "id": r.id,
                "ts": r.ts.isoformat() if r.ts else None,
                "actor": r.actor,
                "action": r.action.value if hasattr(r.action, "value") else str(r.action),
                "source_id": r.source_id,
                "target_id": r.target_id,
                "resource_type": r.resource_type,
                "resource_id": r.resource_id,
                "message_id": r.message_id,
                "content_sha256": r.content_sha256,
                "hash_self": r.hash_self,
                "extra": r.extra,
            }
            for r in rows
        ],
    }


# ── Inbound messages ────────────────────────────────────────────────────────

@router.get("/messages/recent")
def messages_recent(
    limit: int = Query(20, ge=1, le=100),
    listener_id: Optional[str] = Query(None),
    source_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
) -> dict:
    """Recent inbound messages. Body is never returned — only metadata."""
    q = db.query(RelayInboundMessage).order_by(RelayInboundMessage.id.desc())
    if listener_id:
        q = q.filter(RelayInboundMessage.listener_id == listener_id)
    if source_id:
        q = q.filter(RelayInboundMessage.source_id == source_id)
    rows = q.limit(limit).all()
    return {
        "count": len(rows),
        "messages": [_summary(r) for r in rows],
    }


@router.get("/messages/{message_id}")
def message_detail(
    message_id: str,
    db: Session = Depends(get_db),
) -> dict:
    """Single inbound message: metadata + extracted resource list (no PHI)."""
    row = db.query(RelayInboundMessage).filter(
        RelayInboundMessage.message_id == message_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Unknown message_id")
    resources = db.query(RelayFhirResource).filter(
        RelayFhirResource.inbound_message_id == row.id,
    ).order_by(RelayFhirResource.id).all()
    return {
        **_summary(row),
        "resources": [
            {
                "id": r.id,
                "resource_type": r.resource_type,
                "resource_id": r.resource_id,
                "external_id": r.external_id,
                "content_sha256": r.content_sha256,
            }
            for r in resources
        ],
    }


def _summary(row: RelayInboundMessage) -> dict:
    return {
        "id": row.id,
        "message_id": row.message_id,
        "received_at": row.received_at.isoformat() if row.received_at else None,
        "listener_id": row.listener_id,
        "source_id": row.source_id,
        "peer": row.peer,
        "content_type": row.content_type,
        "hl7_message_type": row.hl7_message_type,
        "hl7_control_id": row.hl7_control_id,
        "hl7_processing_id": row.hl7_processing_id,
        "hl7_version": row.hl7_version,
        "inbound_sha256": row.inbound_sha256,
        "kek_fingerprint": row.kek_fingerprint,
        "status": row.status,
        "error": row.error,
    }
