"""
Audit log writer + verifier.

`append_audit(...)` is the only sanctioned write API:
  - reads the latest row's `hash_self`
  - computes this row's `hash_self`
  - INSERTs in a single transaction so concurrent appenders don't tangle
    the chain (a SERIALIZABLE-or-equivalent isolation is recommended for
    the relay's DB role).

`verify_chain(...)` walks rows in id order and recomputes each hash.
Returns the first id where the chain breaks, or None if clean.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Iterator, Optional

from sqlalchemy import asc
from sqlalchemy.orm import Session

# Pure-stdlib hash logic lives in `_hash.py` so it can be tested (and
# audited externally) without dragging in SQLAlchemy or `app.config`.
from ._hash import (
    GENESIS_HASH,
    canonical_row as _canonical_row,
    sha256_bytes,
    sign_row,
)
from .models import AuditAction, AuditEntry

__all__ = [
    "AuditAction",
    "GENESIS_HASH",
    "append_audit",
    "sha256_bytes",
    "sign_row",
    "verify_chain",
]


# ── Writer ──────────────────────────────────────────────────────────────────

def _latest_hash(db: Session) -> str:
    last = db.query(AuditEntry).order_by(AuditEntry.id.desc()).first()
    return last.hash_self if last else GENESIS_HASH


def append_audit(
    db: Session,
    *,
    actor: str,
    action: AuditAction | str,
    source_id: Optional[str] = None,
    target_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    message_id: Optional[str] = None,
    content_sha256: Optional[str] = None,
    extra: Optional[dict[str, Any]] = None,
    ts: Optional[datetime] = None,
) -> AuditEntry:
    """Append a new audit row. Computes the hash chain link automatically.

    Caller MUST commit the surrounding transaction; this function only
    flushes so `entry.id` is populated.
    """
    ts = ts or datetime.utcnow()
    if not isinstance(action, AuditAction):
        action = AuditAction(action)

    hash_prev = _latest_hash(db)
    hash_self = sign_row(
        ts=ts,
        actor=actor,
        action=action,
        hash_prev=hash_prev,
        source_id=source_id,
        target_id=target_id,
        resource_type=resource_type,
        resource_id=resource_id,
        message_id=message_id,
        content_sha256=content_sha256,
        extra=extra,
    )

    entry = AuditEntry(
        ts=ts,
        actor=actor,
        action=action,
        source_id=source_id,
        target_id=target_id,
        resource_type=resource_type,
        resource_id=resource_id,
        message_id=message_id,
        content_sha256=content_sha256,
        hash_prev=hash_prev,
        hash_self=hash_self,
        extra=extra,
    )
    db.add(entry)
    db.flush()
    return entry


# ── Verifier ────────────────────────────────────────────────────────────────

def _iter_chain(db: Session, since_id: Optional[int] = None) -> Iterator[AuditEntry]:
    q = db.query(AuditEntry).order_by(asc(AuditEntry.id))
    if since_id is not None:
        q = q.filter(AuditEntry.id >= since_id)
    for row in q.yield_per(500):
        yield row


def verify_chain(
    db: Session,
    *,
    since_id: Optional[int] = None,
) -> dict[str, Any]:
    """Walk the chain and recompute each row's hash.

    Returns:
        {
            "checked": int,           # number of rows examined
            "ok": bool,               # True iff chain is intact
            "broken_at_id": int|None, # first id where hash mismatched
            "expected_hash_prev": str|None,
            "actual_hash_prev": str|None,
        }
    """
    checked = 0
    expected_prev = GENESIS_HASH if since_id in (None, 0) else None

    for row in _iter_chain(db, since_id=since_id):
        # If we joined the chain mid-stream, take the row's stated prev hash
        # as our anchor for this walk.
        if expected_prev is None:
            expected_prev = row.hash_prev

        if row.hash_prev != expected_prev:
            return {
                "checked": checked,
                "ok": False,
                "broken_at_id": row.id,
                "expected_hash_prev": expected_prev,
                "actual_hash_prev": row.hash_prev,
                "reason": "hash_prev does not match preceding row's hash_self",
            }

        recomputed = sign_row(
            ts=row.ts,
            actor=row.actor,
            action=row.action,
            hash_prev=row.hash_prev,
            source_id=row.source_id,
            target_id=row.target_id,
            resource_type=row.resource_type,
            resource_id=row.resource_id,
            message_id=row.message_id,
            content_sha256=row.content_sha256,
            extra=row.extra,
        )
        if recomputed != row.hash_self:
            return {
                "checked": checked,
                "ok": False,
                "broken_at_id": row.id,
                "expected_hash_self": recomputed,
                "actual_hash_self": row.hash_self,
                "reason": "row content was modified after signing",
            }

        expected_prev = row.hash_self
        checked += 1

    return {"checked": checked, "ok": True, "broken_at_id": None}
