"""
LaunchFlow Integration Engine — Pilotfish-style ETL pipeline for healthcare
interoperability.

Pipeline stages (mirrors the Pilotfish "Source System → Listener → Source
Transform → Route → Target Transform → Transport → Target System" model):

    [Listener]   inbound channel (HL7 MLLP, FHIR webhook, FHIR pull, SFTP)
        ↓
    [Source Transform]   wire format → canonical (HL7v2 → FHIR R4 → dict)
        ↓
    [Route]   content/source rules choose downstream transport(s)
        ↓
    [Target Transform]   canonical → target format (SQLAlchemy rows, FHIR)
        ↓
    [Transport]   encrypted delivery + audit (Postgres writer, FHIR push)
        ↓
    [Target System]   our DB, or a downstream FHIR server

Every PHI access flows through `audit.recorder.append_audit()` for a
hash-chained tamper-evident log (HIPAA §164.312(b)).

Every payload at rest beyond ingress is wrapped via `crypto.envelope`
(AES-256-GCM with envelope-keyed DEKs).
"""

from .pipeline import (
    Listener,
    Pipeline,
    PipelineContext,
    PipelineMessage,
    Route,
    Stage,
    StageError,
    Transform,
    Transport,
)

__all__ = [
    "Listener",
    "Pipeline",
    "PipelineContext",
    "PipelineMessage",
    "Route",
    "Stage",
    "StageError",
    "Transform",
    "Transport",
]
