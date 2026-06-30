"""
SQLAlchemy model for the tamper-evident audit log.

Designed to coexist with the existing `app/models.py`. Kept in its own module
so production deployments can grant a different DB role (INSERT-only) on this
table without affecting other tables.

Table layout chosen for forensic clarity:
    id, ts, actor, action, source_id, target_id,
    resource_type, resource_id, message_id, content_sha256,
    hash_prev, hash_self, extra (JSONB)

`hash_self` is computed by `recorder.sign_row()`. `verify_chain()` walks the
table in order and recomputes each row's hash; any mismatch flags tampering.
"""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    Column, DateTime, Index, Integer, String, Text, JSON, Enum as SAEnum,
)

from app.database import Base


class AuditAction(str, enum.Enum):
    """Coarse-grained taxonomy of relay actions."""
    received = "received"           # listener accepted an inbound message
    transformed = "transformed"     # source/target transform completed
    routed = "routed"               # router selected a branch
    delivered = "delivered"         # transport committed the message
    rejected = "rejected"           # listener/transform rejected (NACK)
    error = "error"                 # unexpected failure mid-pipeline
    # Patient-data access actions (not pipeline-internal).
    phi_read = "phi_read"           # data egress to a downstream system
    phi_write = "phi_write"         # data ingress / persistence
    break_glass = "break_glass"     # emergency override


class AuditEntry(Base):
    """One row in the hash-chained audit log."""
    __tablename__ = "relay_audit_log"

    id = Column(Integer, primary_key=True, index=True)

    # When the action happened. Always UTC; never NULL.
    ts = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Who/what performed the action — service name, listener_id, or user id.
    actor = Column(String(120), nullable=False, index=True)

    action = Column(SAEnum(AuditAction), nullable=False, index=True)

    # Optional source + target identifiers (e.g. "epic_backend_sandbox" → "postgres.patients").
    source_id = Column(String(120), nullable=True, index=True)
    target_id = Column(String(120), nullable=True, index=True)

    # What was acted on (e.g. resource_type="Patient", resource_id="erXuFYUfucBZaryVksYEcMg3").
    resource_type = Column(String(80), nullable=True, index=True)
    resource_id = Column(String(160), nullable=True, index=True)

    # Stable per-message id propagated by the pipeline.
    message_id = Column(String(80), nullable=True, index=True)

    # SHA-256 (hex) of the content payload at the time of the action.
    # Lets us prove the same bytes were read/written across stages without
    # storing the PHI itself in the audit row.
    content_sha256 = Column(String(64), nullable=True)

    # Hash chain (RFC 6962-ish): previous row's hash_self.
    hash_prev = Column(String(64), nullable=True)
    # SHA-256 of this row's canonical content + hash_prev. Computed by
    # `recorder.sign_row()`. Once set, never updated.
    hash_self = Column(String(64), nullable=False, index=True)

    # Free-form context (header values, error message, etc.) — non-PHI.
    extra = Column(JSON, nullable=True)


# Composite indices for common forensic queries.
Index("ix_relay_audit_ts_action", AuditEntry.ts, AuditEntry.action)
Index("ix_relay_audit_message_action", AuditEntry.message_id, AuditEntry.action)
