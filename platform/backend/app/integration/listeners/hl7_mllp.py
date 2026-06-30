"""
HL7 v2.x MLLP listener (Minimal Lower Layer Protocol).

MLLP framing (per HL7 spec):
    <VT> hl7-message <FS><CR>
where VT = 0x0B, FS = 0x1C, CR = 0x0D.

One message in → one HL7 ACK (MSA segment) out, on the same TCP connection.
ACK codes: AA (application accept) / AE (application error) / AR (reject).

Optional MLLP-over-TLS (HL7 §3.5) when `tls_certfile`/`tls_keyfile` are
provided to the constructor.

Trust model:
  - Each peer is authenticated by source IP (set `allowed_peers={"10.0.0.5"}`
    in production), or by mTLS when configured.
  - No HL7 message content is logged at INFO; only headers + sha256.
  - Every accept/reject emits an audit entry through the pipeline.
"""
from __future__ import annotations

import asyncio
import logging
import ssl
import time
from typing import Any, Iterable, Optional

from app.integration.pipeline import (
    Listener,
    PipelineMessage,
    StageError,
)

logger = logging.getLogger(__name__)


# ── MLLP framing constants ──────────────────────────────────────────────────

MLLP_START_BLOCK = b"\x0b"   # <VT>
MLLP_END_BLOCK = b"\x1c"     # <FS>
MLLP_CARRIAGE_RETURN = b"\x0d"  # <CR>
MLLP_END_FRAME = MLLP_END_BLOCK + MLLP_CARRIAGE_RETURN

# Reasonable safety cap; real HL7 messages are usually <8 KB. Raise for
# bulky ORU/MDM if your sources need it.
DEFAULT_MAX_MESSAGE_BYTES = 1024 * 1024  # 1 MB
DEFAULT_READ_TIMEOUT = 30.0              # seconds per message


# ── Minimal HL7 helpers (only what's needed to build an ACK) ─────────────

def _parse_msh(message: bytes) -> dict[str, str]:
    """Pull just the fields we need from the MSH segment for ACKing.

    Does NOT validate or parse the rest of the message — that's the
    transform stage's job. We only need:
        MSH-3..6  sending/receiving app + facility (echoed in ACK)
        MSH-9     message type (e.g. "ADT^A01")
        MSH-10    control id (echoed in ACK MSA-2)
        MSH-11    processing id (P=production, T=test, D=debug)
        MSH-12    version id
    """
    try:
        text = message.decode("utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        text = message.decode("latin-1", errors="replace")
    # MSH segment is the first segment.
    first_line = text.split("\r", 1)[0].split("\n", 1)[0]
    if not first_line.startswith("MSH"):
        raise ValueError("Message does not start with MSH segment")
    # Field separator is MSH-1 (the 4th character of the segment).
    field_sep = first_line[3]
    fields = first_line.split(field_sep)
    # MSH-1 is the field separator itself; MSH-2 is the encoding chars.
    # So fields[0]="MSH", fields[1]=encoding_chars, fields[2]=sending_app,...
    def get(idx: int) -> str:
        return fields[idx] if idx < len(fields) else ""
    return {
        "field_sep": field_sep,
        "encoding_chars": get(1),
        "sending_app": get(2),
        "sending_facility": get(3),
        "receiving_app": get(4),
        "receiving_facility": get(5),
        "datetime": get(6),
        "security": get(7),
        "message_type": get(8),
        "control_id": get(9),
        "processing_id": get(10),
        "version_id": get(11),
    }


def build_ack(
    msh: dict[str, str],
    *,
    code: str = "AA",
    text_message: str = "",
    receiving_app: str = "LAUNCHFLOW",
    receiving_facility: str = "RELAY",
) -> bytes:
    r"""Build a minimal HL7 ACK^R01 message.

    Format:
        MSH|^~\&|<recv-app>|<recv-fac>|<orig-send-app>|<orig-send-fac>|<ts>||ACK|<ctrlid>|P|2.5
        MSA|<code>|<orig-ctrlid>|<text>
    """
    code = code.upper()
    if code not in {"AA", "AE", "AR"}:
        raise ValueError(f"Invalid ACK code: {code!r}")
    sep = msh.get("field_sep") or "|"
    enc = msh.get("encoding_chars") or "^~\\&"
    ts = time.strftime("%Y%m%d%H%M%S")
    ctrlid = msh.get("control_id") or f"ACK{int(time.time())}"
    version = msh.get("version_id") or "2.5"
    processing = msh.get("processing_id") or "P"

    msh_line = sep.join([
        "MSH",
        enc,
        receiving_app,
        receiving_facility,
        msh.get("sending_app", ""),
        msh.get("sending_facility", ""),
        ts,
        "",
        "ACK",
        ctrlid,
        processing,
        version,
    ])
    msa_line = sep.join([
        "MSA",
        code,
        ctrlid,
        text_message.replace(sep, " ").replace("\r", " ")[:180],
    ])
    return (msh_line + "\r" + msa_line + "\r").encode("utf-8")


# ── Listener ────────────────────────────────────────────────────────────────

class Hl7MllpListener(Listener):
    """Long-running MLLP TCP server.

    Spawns one asyncio Task per connection. Each connection may carry many
    messages (HL7 senders typically keep the socket open).
    """

    def __init__(
        self,
        *,
        host: str = "0.0.0.0",
        port: int = 2575,
        listener_id: str = "hl7_mllp",
        source_id: str = "hl7_mllp",
        max_message_bytes: int = DEFAULT_MAX_MESSAGE_BYTES,
        read_timeout: float = DEFAULT_READ_TIMEOUT,
        allowed_peers: Optional[Iterable[str]] = None,
        tls_certfile: Optional[str] = None,
        tls_keyfile: Optional[str] = None,
        require_client_cert: bool = False,
        client_ca_file: Optional[str] = None,
    ):
        super().__init__()
        self.host = host
        self.port = port
        self.listener_id = listener_id
        self.source_id = source_id
        self.max_message_bytes = max_message_bytes
        self.read_timeout = read_timeout
        self.allowed_peers = set(allowed_peers) if allowed_peers else None
        self.tls_certfile = tls_certfile
        self.tls_keyfile = tls_keyfile
        self.require_client_cert = require_client_cert
        self.client_ca_file = client_ca_file
        self._server: Optional[asyncio.AbstractServer] = None

    # ── Lifecycle ──

    def _build_tls_context(self) -> Optional[ssl.SSLContext]:
        if not self.tls_certfile or not self.tls_keyfile:
            return None
        ctx = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        ctx.load_cert_chain(certfile=self.tls_certfile, keyfile=self.tls_keyfile)
        if self.require_client_cert:
            ctx.verify_mode = ssl.CERT_REQUIRED
            if self.client_ca_file:
                ctx.load_verify_locations(cafile=self.client_ca_file)
        return ctx

    async def start(self) -> None:
        if self._server is not None:
            return
        ssl_ctx = self._build_tls_context()
        self._server = await asyncio.start_server(
            self._handle_connection,
            host=self.host,
            port=self.port,
            ssl=ssl_ctx,
            start_serving=True,
        )
        self._started_at = time.time()
        sockets = self._server.sockets or []
        bound = ", ".join(str(s.getsockname()) for s in sockets) or f"{self.host}:{self.port}"
        logger.info(
            "[%s] MLLP listener up on %s (tls=%s, mtls=%s)",
            self.listener_id, bound,
            bool(ssl_ctx), self.require_client_cert and bool(ssl_ctx),
        )

    async def stop(self) -> None:
        if self._server is None:
            return
        self._server.close()
        await self._server.wait_closed()
        self._server = None
        self._started_at = None
        logger.info("[%s] MLLP listener stopped", self.listener_id)

    # ── Connection / message reading ──

    async def _handle_connection(
        self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter,
    ) -> None:
        peer = writer.get_extra_info("peername")
        peer_host = peer[0] if peer else "?"
        if self.allowed_peers is not None and peer_host not in self.allowed_peers:
            logger.warning(
                "[%s] rejected connection from %s (not in allowed_peers)",
                self.listener_id, peer_host,
            )
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:  # noqa: BLE001
                pass
            return

        logger.info("[%s] connection from %s", self.listener_id, peer_host)
        try:
            while not reader.at_eof():
                msg_bytes = await self._read_one_message(reader)
                if msg_bytes is None:
                    break
                ack_bytes = await self._handle_message(msg_bytes, peer_host)
                writer.write(MLLP_START_BLOCK + ack_bytes + MLLP_END_FRAME)
                await writer.drain()
        except (asyncio.IncompleteReadError, ConnectionResetError):
            logger.info("[%s] peer %s closed connection", self.listener_id, peer_host)
        except asyncio.TimeoutError:
            logger.warning("[%s] read timeout from %s", self.listener_id, peer_host)
        except Exception:  # noqa: BLE001
            logger.exception("[%s] error handling connection from %s",
                             self.listener_id, peer_host)
        finally:
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:  # noqa: BLE001
                pass

    async def _read_one_message(
        self, reader: asyncio.StreamReader,
    ) -> Optional[bytes]:
        """Read one MLLP-framed HL7 message. Returns None on clean EOF."""
        # Skip junk until <VT>.
        try:
            header = await asyncio.wait_for(
                reader.readuntil(MLLP_START_BLOCK),
                timeout=self.read_timeout,
            )
        except asyncio.IncompleteReadError:
            return None
        # `header` ends with MLLP_START_BLOCK by definition; anything before
        # it is non-HL7 garbage we ignore.
        try:
            payload_with_end = await asyncio.wait_for(
                reader.readuntil(MLLP_END_FRAME),
                timeout=self.read_timeout,
            )
        except asyncio.LimitOverrunError as exc:
            raise StageError("HL7 message exceeded buffer limit",
                             code="message_too_large") from exc

        body = payload_with_end[:-len(MLLP_END_FRAME)]
        if len(body) == 0:
            raise StageError("Empty HL7 frame", code="empty_message")
        if len(body) > self.max_message_bytes:
            raise StageError(
                f"HL7 message exceeded max_message_bytes ({self.max_message_bytes})",
                code="message_too_large",
            )
        # Normalize segment separators to <CR> as HL7 spec requires.
        body = body.replace(b"\r\n", b"\r").replace(b"\n", b"\r")
        return body

    # ── Dispatch into pipeline + craft ACK ──

    async def _handle_message(
        self, raw_bytes: bytes, peer_host: str,
    ) -> bytes:
        # Try to parse MSH first so we can build a correlated ACK even on failure.
        try:
            msh = _parse_msh(raw_bytes)
        except Exception as exc:  # noqa: BLE001
            logger.warning("[%s] malformed MSH: %s", self.listener_id, exc)
            # Without MSH we have no control id to echo. Return a generic AR ACK.
            return build_ack(
                {"field_sep": "|", "encoding_chars": "^~\\&"},
                code="AR",
                text_message=f"Malformed MSH: {exc}",
            )

        from app.integration.audit.recorder import sha256_bytes
        digest = sha256_bytes(raw_bytes)

        message = PipelineMessage(
            body=raw_bytes,
            source_id=self.source_id,
            content_type="application/hl7-v2",
            listener_id=self.listener_id,
            inbound_digest=digest,
            headers={
                "peer": peer_host,
                "hl7_control_id": msh.get("control_id", ""),
                "hl7_message_type": msh.get("message_type", ""),
                "hl7_sending_app": msh.get("sending_app", ""),
                "hl7_sending_facility": msh.get("sending_facility", ""),
                "hl7_processing_id": msh.get("processing_id", ""),
                "hl7_version": msh.get("version_id", ""),
            },
            metadata={"msh": msh},
        )

        try:
            await self.emit(message)
            return build_ack(msh, code="AA", text_message="OK")
        except StageError as exc:
            logger.warning(
                "[%s] message %s rejected: %s",
                self.listener_id, msh.get("control_id"), exc,
            )
            return build_ack(msh, code="AR" if not exc.retryable else "AE",
                             text_message=str(exc))
        except Exception as exc:  # noqa: BLE001
            logger.exception(
                "[%s] message %s failed",
                self.listener_id, msh.get("control_id"),
            )
            # AE = application error (transient — sender may retry).
            return build_ack(msh, code="AE", text_message=f"Server error: {exc}")
