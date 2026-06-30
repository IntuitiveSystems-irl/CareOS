"""
SMART on FHIR Bulk Data Access — async `$export` operation.

Implements the export-kickoff / status-poll / file-download triad per the
HL7 IG: https://hl7.org/fhir/uv/bulkdata/

Phase-1 scope:
  * `$export` operation for system-level (all patients) and
    Patient-level export
  * NDJSON output, one resource per line
  * Optional cloud-archive offload (signed pickup URLs returned in the
    job manifest, replacing the inline NDJSON URLs)
  * Async via background tasks (a single in-process queue; production
    would use Celery/RQ)
"""

from .jobs import (
    BulkExportJob,
    JobStatus,
    create_export_job,
    get_export_job,
    list_export_jobs,
    run_export_job,
)
from .uscdi import USCDI_V3_RESOURCES, build_uscdi_bundle

__all__ = [
    "BulkExportJob",
    "JobStatus",
    "create_export_job",
    "get_export_job",
    "list_export_jobs",
    "run_export_job",
    "USCDI_V3_RESOURCES",
    "build_uscdi_bundle",
]
