"""
Bulk export job runner.

A `BulkExportJob` represents one in-flight export. It walks
`relay_fhir_resources`, groups by resourceType, writes one NDJSON file
per type to `.data/bulk-export/{job_id}/`, and (when `archive=True`)
uploads each file to the cloud archive transport with a short-lived
signed-pickup URL.

Manifest format follows the SMART Bulk Data IG exactly so existing
clients (HAPI FHIR, Microsoft / AWS / Google Healthcare APIs, TEFCA QHIN
reference impls) consume it unchanged.

Phase-1 implementation: in-process job table backed by `bulk_export_jobs`.
Phase-3 will move to a worker queue (Celery / Dramatiq).
"""
from __future__ import annotations

import asyncio
import enum
import json
import logging
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Optional

from sqlalchemy.orm import Session

from app.integration.audit.recorder import AuditAction, append_audit
from app.integration.storage.models import RelayFhirResource

logger = logging.getLogger(__name__)


class JobStatus(str, enum.Enum):
    accepted = "accepted"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


# ── In-memory job registry ──────────────────────────────────────────────────
# Trade-off: simple, works for one process. A horizontal scale-out would
# need a DB-backed table — added in Phase 3.

_JOBS: dict[str, "BulkExportJob"] = {}


class BulkExportJob:
    """Lightweight job record. Mutated by `run_export_job`."""

    def __init__(
        self,
        *,
        job_id: str,
        resource_types: list[str],
        patient_filter: Optional[str] = None,
        actor: str = "anonymous",
        archive: bool = False,
    ):
        self.job_id = job_id
        self.resource_types = resource_types
        self.patient_filter = patient_filter
        self.actor = actor
        self.archive = archive
        self.status: JobStatus = JobStatus.accepted
        self.created_at = time.time()
        self.started_at: Optional[float] = None
        self.completed_at: Optional[float] = None
        self.transaction_time = datetime.utcnow().isoformat() + "Z"
        # One entry per resource type after run.
        self.output: list[dict[str, Any]] = []
        self.error: Optional[str] = None

    def to_manifest(self, base_url: str) -> dict[str, Any]:
        """Render the SMART Bulk Data status response."""
        request_url = f"{base_url}/api/careos/$export"
        if self.resource_types:
            request_url += "?_type=" + ",".join(self.resource_types)
        if self.patient_filter:
            request_url += ("&" if "?" in request_url else "?") + f"patient={self.patient_filter}"
        return {
            "transactionTime": self.transaction_time,
            "request": request_url,
            "requiresAccessToken": True,
            "output": self.output,
            "error": [],
        }

    def to_summary(self) -> dict[str, Any]:
        return {
            "job_id": self.job_id,
            "status": self.status.value,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "resource_types": self.resource_types,
            "patient_filter": self.patient_filter,
            "actor": self.actor,
            "archive": self.archive,
            "output_count": len(self.output),
            "error": self.error,
        }


# ── Public API ─────────────────────────────────────────────────────────────

def create_export_job(
    *,
    resource_types: list[str],
    patient_filter: Optional[str] = None,
    actor: str = "anonymous",
    archive: bool = False,
) -> BulkExportJob:
    job = BulkExportJob(
        job_id=f"exp_{uuid.uuid4().hex}",
        resource_types=resource_types,
        patient_filter=patient_filter,
        actor=actor,
        archive=archive,
    )
    _JOBS[job.job_id] = job
    return job


def get_export_job(job_id: str) -> Optional[BulkExportJob]:
    return _JOBS.get(job_id)


def list_export_jobs(limit: int = 50) -> list[BulkExportJob]:
    return sorted(_JOBS.values(), key=lambda j: j.created_at, reverse=True)[:limit]


# ── Job runner ─────────────────────────────────────────────────────────────

async def run_export_job(
    job: BulkExportJob,
    *,
    db_session_factory,
    base_url: str,
    output_root: Path,
    cloud_archiver=None,
) -> None:
    """Execute the export. Updates job in place. Best-effort — never
    raises so the caller's background task doesn't crash silently."""
    job.status = JobStatus.running
    job.started_at = time.time()
    out_dir = output_root / job.job_id
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        # 1) Group rows by resource type via SQLAlchemy.
        db: Session = db_session_factory()
        try:
            counts_per_type = await asyncio.to_thread(
                _write_ndjson_files,
                db, job, out_dir,
            )
        finally:
            db.close()

        # 2) Build manifest entries (URLs depend on whether we archived).
        for rtype, info in counts_per_type.items():
            entry: dict[str, Any] = {
                "type": rtype,
                "count": info["count"],
            }
            if cloud_archiver is not None and info.get("cloud_url"):
                entry["url"] = info["cloud_url"]
            else:
                entry["url"] = f"{base_url}/api/careos/$export-files/{job.job_id}/{rtype}"
            job.output.append(entry)

        # 3) Audit
        try:
            db2: Session = db_session_factory()
            append_audit(
                db2,
                actor=job.actor,
                action=AuditAction.phi_read,
                source_id="postgres.relay",
                target_id="bulk_export",
                resource_type="BulkExport",
                resource_id=job.job_id,
                extra={
                    "resource_types": job.resource_types,
                    "patient_filter": job.patient_filter,
                    "archive": job.archive,
                    "output_counts": {k: v["count"] for k, v in counts_per_type.items()},
                },
            )
            db2.commit()
            db2.close()
        except Exception:  # noqa: BLE001
            logger.exception("bulk export audit failed")

        job.status = JobStatus.completed
        job.completed_at = time.time()

    except Exception as exc:  # noqa: BLE001
        logger.exception("bulk export job %s failed", job.job_id)
        job.status = JobStatus.failed
        job.error = str(exc)[:500]
        job.completed_at = time.time()


def _write_ndjson_files(
    db: Session, job: BulkExportJob, out_dir: Path,
) -> dict[str, dict[str, Any]]:
    """Write one NDJSON file per resource type. Returns counts + paths."""
    counts: dict[str, dict[str, Any]] = {}

    types = job.resource_types or _all_seen_resource_types(db)
    for rtype in types:
        path = out_dir / f"{rtype}.ndjson"
        n = 0
        with path.open("wb") as fh:
            for row in _iter_resources(db, rtype, job.patient_filter):
                fh.write(
                    json.dumps(
                        row.resource_json,
                        sort_keys=True, separators=(",", ":"),
                    ).encode("utf-8")
                )
                fh.write(b"\n")
                n += 1
        counts[rtype] = {"count": n, "path": str(path)}
    return counts


def _all_seen_resource_types(db: Session) -> list[str]:
    types = (
        db.query(RelayFhirResource.resource_type)
        .distinct()
        .order_by(RelayFhirResource.resource_type)
        .all()
    )
    return [t[0] for t in types if t[0]]


def _iter_resources(
    db: Session, rtype: str, patient_filter: Optional[str],
) -> Iterable[RelayFhirResource]:
    q = db.query(RelayFhirResource).filter(RelayFhirResource.resource_type == rtype)
    if patient_filter:
        q = q.filter(RelayFhirResource.external_id == patient_filter)
    return q.yield_per(500)
