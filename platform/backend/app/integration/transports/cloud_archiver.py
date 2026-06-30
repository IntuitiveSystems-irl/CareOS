"""
Cloud archive transport — S3-compatible blob storage with envelope encryption.

Wire-compatible with: AWS S3, Cloudflare R2, Google Cloud Storage's S3
interop, Wasabi, Backblaze B2, MinIO, etc. The provider is selected
purely by `endpoint_url`; no code change required to switch.

Use cases:
  * Long-term archival of inbound HL7/FHIR payloads (envelope-encrypted)
  * Bulk Data `$export` output buckets — patient or QHIN downloads via
    short-lived signed URLs
  * Disaster-recovery target alongside the on-disk file_writer

`boto3` is imported lazily so this module can be loaded in environments
without it (e.g. local smoke tests). If boto3 isn't available at the
moment a transport actually runs, it raises a clear `StageError` instead
of crashing on import.
"""
from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime
from typing import Any, Optional

from app.integration.audit.recorder import AuditAction, append_audit, sha256_bytes
from app.integration.crypto.envelope import encrypt, kek_fingerprint
from app.integration.pipeline import (
    PipelineContext,
    PipelineMessage,
    StageError,
    Transport,
)

logger = logging.getLogger(__name__)


def _boto3():
    """Lazy import; returns the module or raises a friendly StageError."""
    try:
        import boto3  # type: ignore
        return boto3
    except ImportError as exc:  # noqa: F841
        raise StageError(
            "boto3 is not installed; add `boto3` to backend/requirements.txt "
            "to use the cloud archiver",
            code="boto3_missing",
        )


class CloudArchiver(Transport):
    """Envelope-encrypts a message and uploads it to S3-compatible storage.

    Object key layout:
        relay/{listener_id}/{YYYY/MM/DD}/{message_id}.bin

    The object body is the raw envelope bytes from
    `app.integration.crypto.envelope.encrypt`; the IV / KEK fingerprint /
    AAD (= message_id) are baked into the bytes themselves, so a
    reader needs only the bucket + KEK to decrypt.
    """

    name = "cloud_archiver"

    def __init__(
        self,
        *,
        target_id: str = "cloud.archive",
        # All four can be `None` to read at run-time from env vars, which is
        # the right pattern for ECS/K8s deployments using IAM roles.
        endpoint_url: Optional[str] = None,
        bucket: Optional[str] = None,
        access_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        region: Optional[str] = None,
        # Whether the archiver should ALSO emit a signed pickup URL into
        # message.metadata. Pickup URLs are short-lived (default: 10 min).
        emit_signed_url: bool = False,
        signed_url_ttl_seconds: int = 600,
    ):
        self.target_id = target_id
        self.endpoint_url = endpoint_url
        self.bucket = bucket
        self.access_key = access_key
        self.secret_key = secret_key
        self.region = region
        self.emit_signed_url = emit_signed_url
        self.signed_url_ttl_seconds = signed_url_ttl_seconds

    # ── Configuration helpers (read env at use-time, not import-time) ──

    def _resolved_bucket(self) -> str:
        b = self.bucket or os.environ.get("CAREOS_CLOUD_BUCKET")
        if not b:
            raise StageError(
                "CloudArchiver requires `bucket` or CAREOS_CLOUD_BUCKET",
                code="bucket_unset",
            )
        return b

    def _client(self):
        boto3 = _boto3()
        endpoint = self.endpoint_url or os.environ.get("CAREOS_CLOUD_ENDPOINT") or None
        access_key = self.access_key or os.environ.get("CAREOS_CLOUD_ACCESS_KEY") or None
        secret_key = self.secret_key or os.environ.get("CAREOS_CLOUD_SECRET_KEY") or None
        region = self.region or os.environ.get("CAREOS_CLOUD_REGION") or "auto"
        kwargs: dict[str, Any] = {"region_name": region}
        if endpoint:
            kwargs["endpoint_url"] = endpoint
        if access_key and secret_key:
            kwargs["aws_access_key_id"] = access_key
            kwargs["aws_secret_access_key"] = secret_key
        return boto3.client("s3", **kwargs)

    # ── Pipeline interface ──

    async def process(
        self, message: PipelineMessage, ctx: PipelineContext,
    ) -> list[PipelineMessage]:
        body = message.body
        if isinstance(body, (dict, list)):
            plaintext = json.dumps(body, sort_keys=True, separators=(",", ":")).encode("utf-8")
            content_type = "application/fhir+json"
        elif isinstance(body, str):
            plaintext = body.encode("utf-8")
            content_type = message.content_type or "text/plain"
        elif isinstance(body, (bytes, bytearray)):
            plaintext = bytes(body)
            content_type = message.content_type or "application/octet-stream"
        else:
            raise StageError(
                f"Unsupported body type for cloud archiver: {type(body).__name__}",
                code="bad_body_type",
            )

        aad = message.message_id.encode("utf-8")
        ciphertext = encrypt(plaintext, aad=aad)

        bucket = self._resolved_bucket()
        day = datetime.utcfromtimestamp(message.received_at).strftime("%Y/%m/%d")
        key = f"relay/{message.listener_id}/{day}/{message.message_id}.bin"

        # Upload + (optionally) signed URL — both run off the asyncio loop
        # since boto3 is sync.
        import asyncio

        def _do_upload() -> dict[str, Any]:
            client = self._client()
            client.put_object(
                Bucket=bucket,
                Key=key,
                Body=ciphertext,
                ContentType="application/octet-stream",
                Metadata={
                    "message_id": message.message_id,
                    "kek_fingerprint": kek_fingerprint(),
                    "inbound_content_type": content_type,
                    "source_id": message.source_id,
                    "listener_id": message.listener_id,
                    "received_at": str(message.received_at),
                },
            )
            receipt: dict[str, Any] = {
                "bucket": bucket,
                "key": key,
                "size": len(ciphertext),
                "kek_fingerprint": kek_fingerprint(),
                "uploaded_at": time.time(),
            }
            if self.emit_signed_url:
                receipt["signed_url"] = client.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": bucket, "Key": key},
                    ExpiresIn=self.signed_url_ttl_seconds,
                )
                receipt["signed_url_ttl_seconds"] = self.signed_url_ttl_seconds
            return receipt

        try:
            receipt = await asyncio.to_thread(_do_upload)
        except StageError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise StageError(
                f"Cloud upload failed: {exc}",
                code="cloud_upload_error",
                retryable=True,
            ) from exc

        # Audit (best-effort — like the file writer).
        if ctx.db_session_factory and ctx.audit_appender:
            db = ctx.db_session_factory()
            try:
                ctx.audit_appender(
                    db,
                    actor="relay.cloud_archiver",
                    action=AuditAction.delivered,
                    source_id=message.source_id,
                    target_id=self.target_id,
                    message_id=message.message_id,
                    content_sha256=sha256_bytes(plaintext),
                    extra={
                        "bucket": receipt["bucket"],
                        "key": receipt["key"],
                        "size": receipt["size"],
                        "kek_fingerprint": receipt["kek_fingerprint"],
                    },
                )
                db.commit()
            except Exception:  # noqa: BLE001
                db.rollback()
                logger.exception("cloud_archiver audit failed")
            finally:
                db.close()

        message.metadata["cloud_receipt"] = receipt
        return [message]
