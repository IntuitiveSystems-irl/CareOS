"""
SMART on FHIR Bulk Data Access + USCDI v3 patient export endpoints.

Mounted under /api/careos/*. Three Bulk-Data routes:

  POST  /api/careos/$export                       kick-off (returns 202 + polling URL)
  GET   /api/careos/$export-status/{job_id}       polling
  GET   /api/careos/$export-files/{job_id}/{rt}   NDJSON download

Plus the single-call USCDI v3 export:

  GET   /api/careos/patients/{external_id}/uscdi   FHIR Bundle, all USCDI v3 data classes
"""
from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.integration.bulk_data import (
    JobStatus,
    build_uscdi_bundle,
    create_export_job,
    get_export_job,
    list_export_jobs,
    run_export_job,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/careos", tags=["careos"])

# Where job NDJSON files live on disk. Kept inside the .data volume so
# they persist across container rebuilds.
_OUTPUT_ROOT = Path.cwd() / ".data" / "bulk-export"
_OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)


# ── Bulk Data $export ──────────────────────────────────────────────────────

@router.post("/$export", status_code=202)
async def bulk_export_kickoff(
    request: Request,
    background_tasks: BackgroundTasks,
    _type: Optional[str] = Query(None, description="comma-separated FHIR resourceTypes"),
    patient: Optional[str] = Query(None, description="restrict to one external patient id"),
    archive: bool = Query(False, description="upload outputs to the cloud archive"),
):
    """Kick off a Bulk Data export job. Returns 202 Accepted with a
    `Content-Location` header pointing at the polling endpoint."""
    rtypes = [t.strip() for t in (_type or "").split(",") if t.strip()]
    actor = "anonymous"  # plug in real auth context when available

    job = create_export_job(
        resource_types=rtypes,
        patient_filter=patient,
        actor=actor,
        archive=archive,
    )

    base_url = str(request.base_url).rstrip("/")
    poll_url = f"{base_url}/api/careos/$export-status/{job.job_id}"

    # Run the actual export off the request thread.
    background_tasks.add_task(
        _run_job_async,
        job_id=job.job_id,
        base_url=base_url,
    )

    return JSONResponse(
        status_code=202,
        content={
            "job_id": job.job_id,
            "status": job.status.value,
            "polling_url": poll_url,
            "resource_types": rtypes or "all-types",
            "patient_filter": patient,
            "archive": archive,
        },
        headers={"Content-Location": poll_url},
    )


async def _run_job_async(*, job_id: str, base_url: str) -> None:
    job = get_export_job(job_id)
    if job is None:
        return
    await run_export_job(
        job,
        db_session_factory=lambda: SessionLocal(),
        base_url=base_url,
        output_root=_OUTPUT_ROOT,
        cloud_archiver=None,  # wire CloudArchiver in once an env-configured bucket exists
    )


@router.get("/$export-status/{job_id}")
def bulk_export_status(job_id: str, request: Request):
    job = get_export_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Unknown job_id")

    if job.status in (JobStatus.accepted, JobStatus.running):
        return JSONResponse(
            status_code=202,
            content=job.to_summary(),
            headers={
                "X-Progress": (
                    "queued" if job.status == JobStatus.accepted else "exporting"
                ),
                "Retry-After": "1",
            },
        )

    if job.status == JobStatus.failed:
        return JSONResponse(status_code=500, content=job.to_summary())

    base_url = str(request.base_url).rstrip("/")
    return job.to_manifest(base_url)


@router.get("/$export-files/{job_id}/{resource_type}")
def bulk_export_file(job_id: str, resource_type: str):
    """Download one NDJSON file from a completed job."""
    job = get_export_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Unknown job_id")
    if job.status != JobStatus.completed:
        raise HTTPException(
            status_code=409,
            detail=f"Job is not complete (status={job.status.value})",
        )

    # Light validation — only allow simple identifiers, no path traversal.
    safe = resource_type.replace("/", "").replace("..", "").replace("\\", "")
    if safe != resource_type or not safe.isidentifier():
        raise HTTPException(status_code=400, detail="Invalid resource_type")

    path = _OUTPUT_ROOT / job.job_id / f"{resource_type}.ndjson"
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        path=str(path),
        media_type="application/fhir+ndjson",
        filename=f"{job.job_id}-{resource_type}.ndjson",
    )


@router.get("/$export-jobs")
def list_jobs(limit: int = Query(50, ge=1, le=200)):
    """Operator-facing list of recent Bulk Data jobs."""
    return {
        "count": len(list_export_jobs(limit=limit)),
        "jobs": [j.to_summary() for j in list_export_jobs(limit=limit)],
    }


# ── USCDI v3 patient export ────────────────────────────────────────────────

@router.get("/patients/{external_id}/uscdi")
def uscdi_export(
    external_id: str,
    source_id: Optional[str] = Query(None, description="filter to one source EHR"),
    db: Session = Depends(get_db),
):
    """Single-call USCDI v3 export. Returns a FHIR collection Bundle with
    every USCDI v3 data class CareOS has stored for the patient.

    Use this for patient-mediated portability (Cures-Act compliance) and
    for QHIN Patient Discovery responses."""
    bundle = build_uscdi_bundle(db, external_id=external_id, source_id=source_id)
    if not bundle.get("entry"):
        raise HTTPException(
            status_code=404,
            detail=f"No data on file for external_id={external_id}",
        )
    return bundle
