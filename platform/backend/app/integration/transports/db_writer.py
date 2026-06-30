"""
Postgres FHIR writer — terminal stage for the HL7 pipeline.

For each inbound message it:
  1. Envelope-encrypts the raw inbound bytes (AAD = message_id).
  2. INSERTs a `RelayInboundMessage` row (the cipher of the wire payload +
     the FHIR Bundle the transform produced, kept as JSON for indexability).
  3. Extracts each `Bundle.entry.resource` into a `RelayFhirResource` row.
  4. Emits hash-chained audit entries for `received` and `phi_write`.

The whole sequence runs in a single DB transaction. If any step fails the
transaction rolls back and the StageError bubbles up — the MLLP listener
turns that into an AE/AR HL7 ACK so the source can retry.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Iterable, Optional

from sqlalchemy.orm import Session

from app.integration.audit.recorder import (
    AuditAction,
    append_audit,
    sha256_bytes,
)
from app.integration.crypto.envelope import encrypt, kek_fingerprint
from app.integration.pipeline import (
    PipelineContext,
    PipelineMessage,
    StageError,
    Transport,
)
from app.integration.storage.models import RelayFhirResource, RelayInboundMessage

logger = logging.getLogger(__name__)


def _canonical_json_bytes(obj: Any) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _iter_resources(bundle: dict[str, Any]) -> Iterable[dict[str, Any]]:
    for entry in bundle.get("entry") or []:
        if isinstance(entry, dict) and isinstance(entry.get("resource"), dict):
            yield entry["resource"]


class PostgresFhirWriter(Transport):
    """Writes an inbound HL7→FHIR pipeline message into the relay schema."""

    name = "postgres_fhir_writer"

    def __init__(
        self,
        target_id: str = "postgres.relay",
        *,
        # If True, raw inbound bytes are also kept in the message's
        # `metadata["raw_inbound"]` (must be bytes). Otherwise the transform
        # may have replaced them — we fall back to encoding the FHIR Bundle.
        require_raw_inbound: bool = False,
    ):
        self.target_id = target_id
        self.require_raw_inbound = require_raw_inbound

    async def process(
        self, message: PipelineMessage, ctx: PipelineContext,
    ) -> list[PipelineMessage]:
        if ctx.db_session_factory is None:
            raise StageError(
                "PostgresFhirWriter requires PipelineContext.db_session_factory",
                code="missing_db_session",
            )

        # Body at this point should be a FHIR Bundle (dict) produced by the
        # source transform. We also need the original wire bytes for the
        # encrypted body column.
        fhir_payload = message.body
        if not isinstance(fhir_payload, dict):
            raise StageError(
                f"Expected dict (FHIR Bundle) body, got {type(fhir_payload).__name__}",
                code="bad_body_type",
            )

        raw_inbound: Optional[bytes] = message.metadata.get("raw_inbound")
        if raw_inbound is None:
            if self.require_raw_inbound:
                raise StageError(
                    "raw_inbound bytes missing from message.metadata",
                    code="missing_raw_inbound",
                )
            # Fall back to encrypting the FHIR Bundle itself.
            raw_inbound = _canonical_json_bytes(fhir_payload)

        inbound_sha = message.inbound_digest or sha256_bytes(raw_inbound)
        aad = message.message_id.encode("utf-8")
        ciphertext = encrypt(raw_inbound, aad=aad)

        # Pre-compute resource hashes & rows outside the transaction.
        resource_rows: list[dict[str, Any]] = []
        for res in _iter_resources(fhir_payload):
            res_type = res.get("resourceType") or "Unknown"
            res_id = str(res.get("id") or "")
            external_id = _extract_external_id(res)
            canonical = _canonical_json_bytes(res)
            resource_rows.append({
                "resource_type": res_type,
                "resource_id": res_id,
                "external_id": external_id,
                "source_id": message.source_id,
                "resource_json": res,
                "content_sha256": sha256_bytes(canonical),
            })

        # Run the writes synchronously inside an async stage. The session
        # factory is expected to return a sync Session (FastAPI's default).
        def _do_write() -> dict[str, Any]:
            db: Session = ctx.db_session_factory()
            try:
                inbound_row = RelayInboundMessage(
                    message_id=message.message_id,
                    received_at=datetime.utcfromtimestamp(message.received_at),
                    listener_id=message.listener_id,
                    source_id=message.source_id,
                    peer=message.headers.get("peer"),
                    content_type=message.headers.get("inbound_content_type", "application/hl7-v2"),
                    inbound_sha256=inbound_sha,
                    hl7_message_type=message.metadata.get("hl7_message_type"),
                    hl7_control_id=message.headers.get("hl7_control_id"),
                    hl7_processing_id=message.headers.get("hl7_processing_id"),
                    hl7_version=message.headers.get("hl7_version"),
                    encrypted_body=ciphertext,
                    kek_fingerprint=kek_fingerprint(),
                    fhir_bundle=fhir_payload,
                    status="delivered",
                )
                db.add(inbound_row)
                db.flush()  # populate inbound_row.id

                for r in resource_rows:
                    db.add(RelayFhirResource(
                        inbound_message_id=inbound_row.id,
                        resource_type=r["resource_type"],
                        resource_id=r["resource_id"],
                        external_id=r["external_id"],
                        source_id=r["source_id"],
                        resource_json=r["resource_json"],
                        content_sha256=r["content_sha256"],
                    ))

                # Audit entries: one "received" + one "phi_write" per resource.
                append_audit(
                    db,
                    actor=message.listener_id,
                    action=AuditAction.received,
                    source_id=message.source_id,
                    message_id=message.message_id,
                    content_sha256=inbound_sha,
                    extra={
                        "peer": message.headers.get("peer"),
                        "hl7_message_type": message.metadata.get("hl7_message_type"),
                        "resource_count": len(resource_rows),
                    },
                )
                for r in resource_rows:
                    append_audit(
                        db,
                        actor="relay.postgres_fhir_writer",
                        action=AuditAction.phi_write,
                        source_id=message.source_id,
                        target_id=self.target_id,
                        resource_type=r["resource_type"],
                        resource_id=r["resource_id"] or r["external_id"],
                        message_id=message.message_id,
                        content_sha256=r["content_sha256"],
                    )

                db.commit()
                return {
                    "inbound_id": inbound_row.id,
                    "resource_count": len(resource_rows),
                }
            except Exception:
                db.rollback()
                raise
            finally:
                db.close()

        import asyncio
        try:
            receipt = await asyncio.to_thread(_do_write)
        except Exception as exc:  # noqa: BLE001
            raise StageError(
                f"DB write failed: {exc}",
                code="db_write_error",
                retryable=True,
            ) from exc

        message.metadata["write_receipt"] = receipt
        return [message]


def _extract_external_id(resource: dict[str, Any]) -> Optional[str]:
    """Pull the originating-system identifier from a FHIR resource if present.

    For Patient: identifier[0].value (typically the MRN).
    For everything else: subject/patient.reference (the Patient id).
    """
    rtype = resource.get("resourceType")
    if rtype == "Patient":
        identifiers = resource.get("identifier") or []
        for ident in identifiers:
            if isinstance(ident, dict) and ident.get("value"):
                return ident["value"]
        return None
    for key in ("subject", "patient"):
        ref = resource.get(key)
        if isinstance(ref, dict) and isinstance(ref.get("reference"), str):
            return ref["reference"].split("/")[-1]
    return None
