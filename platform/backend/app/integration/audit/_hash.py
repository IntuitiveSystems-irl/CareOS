"""
Pure-stdlib audit hash logic.

Split out from `recorder.py` so the chain math can be tested (and reused
client-side, e.g. by external auditors) without pulling in SQLAlchemy or
`app.config`.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Any, Optional


GENESIS_HASH = "0" * 64


def canonical_row(
    *,
    ts: datetime,
    actor: str,
    action: str,
    source_id: Optional[str],
    target_id: Optional[str],
    resource_type: Optional[str],
    resource_id: Optional[str],
    message_id: Optional[str],
    content_sha256: Optional[str],
    extra: Optional[dict[str, Any]],
    hash_prev: str,
) -> bytes:
    """The canonical byte-string that hashes into `hash_self`."""
    payload = {
        "ts": ts.isoformat(timespec="microseconds"),
        "actor": actor,
        "action": action,
        "source_id": source_id,
        "target_id": target_id,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "message_id": message_id,
        "content_sha256": content_sha256,
        "extra": extra or {},
        "hash_prev": hash_prev,
    }
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sign_row(
    *,
    ts: datetime,
    actor: str,
    action,
    hash_prev: str,
    source_id: Optional[str] = None,
    target_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    message_id: Optional[str] = None,
    content_sha256: Optional[str] = None,
    extra: Optional[dict[str, Any]] = None,
) -> str:
    """Compute `hash_self` for the given fields. Pure function, deterministic."""
    # Accept either a string action or an enum-like with `.value`.
    action_str = getattr(action, "value", None) or str(action)
    blob = canonical_row(
        ts=ts,
        actor=actor,
        action=action_str,
        source_id=source_id,
        target_id=target_id,
        resource_type=resource_type,
        resource_id=resource_id,
        message_id=message_id,
        content_sha256=content_sha256,
        extra=extra,
        hash_prev=hash_prev,
    )
    return hashlib.sha256(blob).hexdigest()


def sha256_bytes(data: bytes | str) -> str:
    """Hex SHA-256 of bytes or UTF-8 string. Used to fingerprint payloads."""
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()
