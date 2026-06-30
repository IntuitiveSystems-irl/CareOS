"""
Envelope-encrypted file writer — useful as a DR/backup target and as a
test transport when Postgres isn't available.

Writes one file per message to .data/relay/{listener_id}/{YYYYMMDD}/{message_id}.bin.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from app.integration.audit.recorder import AuditAction
from app.integration.crypto.envelope import encrypt
from app.integration.pipeline import (
    PipelineContext,
    PipelineMessage,
    StageError,
    Transport,
)

DEFAULT_ROOT = Path.cwd() / ".data" / "relay"


class EncryptedFileWriter(Transport):
    """Persist each message as an envelope-encrypted blob on disk."""

    name = "encrypted_file_writer"

    def __init__(self, root: Path | str = DEFAULT_ROOT, target_id: str = "fs.relay"):
        self.root = Path(root)
        self.target_id = target_id

    async def process(
        self, message: PipelineMessage, ctx: PipelineContext,
    ) -> list[PipelineMessage]:
        body = message.body
        if isinstance(body, (dict, list)):
            plaintext = json.dumps(body, sort_keys=True, separators=(",", ":")).encode("utf-8")
        elif isinstance(body, str):
            plaintext = body.encode("utf-8")
        elif isinstance(body, (bytes, bytearray)):
            plaintext = bytes(body)
        else:
            raise StageError(
                f"Unsupported body type for file writer: {type(body).__name__}",
                code="bad_body_type",
            )

        ciphertext = encrypt(plaintext, aad=message.message_id.encode("utf-8"))

        day = datetime.utcfromtimestamp(message.received_at).strftime("%Y%m%d")
        out_dir = self.root / message.listener_id / day
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{message.message_id}.bin"
        out_path.write_bytes(ciphertext)

        # Audit (best-effort: only if context has a session factory + appender).
        if ctx.db_session_factory and ctx.audit_appender:
            db = ctx.db_session_factory()
            try:
                ctx.audit_appender(
                    db,
                    actor="relay.encrypted_file_writer",
                    action=AuditAction.delivered,
                    source_id=message.source_id,
                    target_id=self.target_id,
                    message_id=message.message_id,
                    extra={"path": str(out_path)},
                )
                db.commit()
            finally:
                db.close()

        message.metadata["file_receipt"] = {"path": str(out_path), "size": len(ciphertext)}
        return [message]
