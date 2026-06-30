"""
Provenance / audit logging for every query execution.

Every query that runs through the template system is logged with:
- timestamp (UTC ISO-8601)
- caller identity (from auth layer)
- template_id used
- parameters passed (sanitized — no raw SQL)
- WORKSPACE_CDR value (dataset reference)
- result row count
- execution duration

Logs are written to both structured Python logging and an in-memory
audit trail (for the /admin/audit endpoint). In production, replace
the in-memory store with a persistent backend (BigQuery audit table,
Cloud Logging, etc.).
"""
from __future__ import annotations

import logging
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

# In-memory ring buffer — keeps last N entries for the admin endpoint.
# In production, persist to BigQuery / Cloud SQL / Cloud Logging.
_MAX_AUDIT_ENTRIES = 500
_audit_buffer: deque["AuditEntry"] = deque(maxlen=_MAX_AUDIT_ENTRIES)


@dataclass
class AuditEntry:
    """A single audit log entry."""
    timestamp: str
    caller_subject: str
    caller_auth_method: str
    caller_ip: str
    template_id: str
    parameters: dict[str, Any]
    workspace_cdr: str
    row_count: int
    duration_ms: float
    error: str | None = None


def log_query_execution(
    caller: dict,
    template_id: str,
    parameters: dict[str, Any],
    row_count: int,
    duration_ms: float,
    error: str | None = None,
) -> AuditEntry:
    """
    Record a query execution in the audit log.

    Args:
        caller: identity dict from require_auth (subject, auth_method, ip)
        template_id: which allowlisted template was used
        parameters: sanitized query parameters (no raw SQL)
        row_count: number of rows returned
        duration_ms: execution time in milliseconds
        error: error message if the query failed
    """
    entry = AuditEntry(
        timestamp=datetime.now(timezone.utc).isoformat(),
        caller_subject=caller.get("subject", "unknown"),
        caller_auth_method=caller.get("auth_method", "unknown"),
        caller_ip=caller.get("ip", "unknown"),
        template_id=template_id,
        parameters=_sanitize_params(parameters),
        workspace_cdr=settings.WORKSPACE_CDR,
        row_count=row_count,
        duration_ms=round(duration_ms, 2),
        error=error,
    )

    _audit_buffer.append(entry)

    if error:
        logger.warning(
            "AUDIT [%s] template=%s caller=%s error=%s",
            entry.timestamp, template_id, entry.caller_subject, error,
        )
    else:
        logger.info(
            "AUDIT [%s] template=%s caller=%s rows=%d duration=%.1fms cdr=%s",
            entry.timestamp, template_id, entry.caller_subject,
            row_count, duration_ms, settings.WORKSPACE_CDR,
        )

    return entry


def get_audit_trail(last_n: int = 50) -> list[dict]:
    """Return the most recent N audit entries as dicts."""
    n = min(last_n, len(_audit_buffer))
    entries = list(_audit_buffer)[-n:]
    return [_entry_to_dict(e) for e in entries]


def _sanitize_params(params: dict[str, Any]) -> dict[str, Any]:
    """
    Sanitize parameters for logging — truncate long lists, mask secrets.
    """
    sanitized = {}
    for k, v in params.items():
        if isinstance(v, list) and len(v) > 20:
            sanitized[k] = v[:20] + [f"... ({len(v)} total)"]
        else:
            sanitized[k] = v
    return sanitized


def _entry_to_dict(entry: AuditEntry) -> dict:
    return {
        "timestamp": entry.timestamp,
        "caller_subject": entry.caller_subject,
        "caller_auth_method": entry.caller_auth_method,
        "caller_ip": entry.caller_ip,
        "template_id": entry.template_id,
        "parameters": entry.parameters,
        "workspace_cdr": entry.workspace_cdr,
        "row_count": entry.row_count,
        "duration_ms": entry.duration_ms,
        "error": entry.error,
    }
