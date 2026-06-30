"""
AES-256-GCM envelope encryption.

Two layers of keys:
  - KEK (Key Encryption Key) — 32 random bytes, lives in LAUNCHFLOW_RELAY_KEK.
    Rotated by re-wrapping each DEK; ciphertexts don't need to be touched.
  - DEK (Data Encryption Key) — 32 random bytes per ciphertext.

Wire format (single ciphertext blob, base64-encoded by `encrypt_text`):

    +------+-----------+--------------+----------+----------------+
    | ver  | dek_iv    | wrapped_dek  | data_iv  |   ciphertext   |
    |  1B  |  12B      |  32+16 = 48B |   12B    |   N bytes      |
    +------+-----------+--------------+----------+----------------+

The wrapped_dek field is 48 bytes = 32-byte DEK ciphertext + 16-byte GCM tag.
The ciphertext field carries its own 16-byte GCM tag at the end.

Optional `aad` (additional authenticated data) is bound into BOTH layers, so
swapping a DEK between rows or moving a ciphertext to a different message_id
fails authentication on decrypt.
"""
from __future__ import annotations

import base64
import hashlib
import os
import secrets
from typing import Optional

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# ── Constants ───────────────────────────────────────────────────────────────

VERSION = 1
KEK_ENV_VAR = "LAUNCHFLOW_RELAY_KEK"
KEY_BYTES = 32        # AES-256
IV_BYTES = 12         # GCM standard
TAG_BYTES = 16        # GCM tag
WRAPPED_DEK_LEN = KEY_BYTES + TAG_BYTES   # 48
ENVELOPE_PREFIX_LEN = 1 + IV_BYTES + WRAPPED_DEK_LEN + IV_BYTES  # 73


# ── Errors ──────────────────────────────────────────────────────────────────

class EnvelopeError(Exception):
    """Raised on KEK misconfiguration or ciphertext tampering."""


# ── KEK plumbing ────────────────────────────────────────────────────────────

def _load_kek() -> bytes:
    raw = os.environ.get(KEK_ENV_VAR)
    if not raw:
        raise EnvelopeError(
            f"{KEK_ENV_VAR} is not set. Generate one with "
            f"`python -c 'from app.integration.crypto import generate_kek; print(generate_kek())'` "
            f"and add it to the backend's environment."
        )
    try:
        kek = base64.b64decode(raw, validate=True)
    except Exception as exc:  # noqa: BLE001
        raise EnvelopeError(f"{KEK_ENV_VAR} is not valid base64") from exc
    if len(kek) != KEY_BYTES:
        raise EnvelopeError(
            f"{KEK_ENV_VAR} must decode to {KEY_BYTES} bytes (got {len(kek)})"
        )
    return kek


def generate_kek() -> str:
    """Return a fresh base64-encoded 32-byte KEK suitable for LAUNCHFLOW_RELAY_KEK."""
    return base64.b64encode(secrets.token_bytes(KEY_BYTES)).decode("ascii")


def kek_fingerprint() -> str:
    """Stable short fingerprint of the active KEK — safe to log/expose.

    First 16 hex chars of SHA-256(kek). Useful for proving two services are
    using the same key without revealing the key itself.
    """
    try:
        return hashlib.sha256(_load_kek()).hexdigest()[:16]
    except EnvelopeError:
        return "unset"


# ── Encrypt / Decrypt ───────────────────────────────────────────────────────

def encrypt(plaintext: bytes, aad: Optional[bytes] = None) -> bytes:
    """Encrypt `plaintext` with a fresh DEK wrapped by the active KEK.

    Returns the raw envelope bytes; use `encrypt_text` if you want a string.
    """
    if not isinstance(plaintext, (bytes, bytearray)):
        raise TypeError("plaintext must be bytes")
    kek = _load_kek()
    aesgcm_kek = AESGCM(kek)

    dek = secrets.token_bytes(KEY_BYTES)
    dek_iv = secrets.token_bytes(IV_BYTES)
    wrapped_dek = aesgcm_kek.encrypt(dek_iv, dek, aad)
    assert len(wrapped_dek) == WRAPPED_DEK_LEN

    data_iv = secrets.token_bytes(IV_BYTES)
    aesgcm_dek = AESGCM(dek)
    ciphertext = aesgcm_dek.encrypt(data_iv, bytes(plaintext), aad)

    return (
        bytes([VERSION])
        + dek_iv
        + wrapped_dek
        + data_iv
        + ciphertext
    )


def decrypt(envelope: bytes, aad: Optional[bytes] = None) -> bytes:
    """Reverse `encrypt`. Raises `EnvelopeError` if anything is off."""
    if not isinstance(envelope, (bytes, bytearray)):
        raise TypeError("envelope must be bytes")
    if len(envelope) < ENVELOPE_PREFIX_LEN + TAG_BYTES:
        raise EnvelopeError("envelope is truncated")
    if envelope[0] != VERSION:
        raise EnvelopeError(f"unsupported envelope version: {envelope[0]}")

    cursor = 1
    dek_iv = envelope[cursor:cursor + IV_BYTES]; cursor += IV_BYTES
    wrapped_dek = envelope[cursor:cursor + WRAPPED_DEK_LEN]; cursor += WRAPPED_DEK_LEN
    data_iv = envelope[cursor:cursor + IV_BYTES]; cursor += IV_BYTES
    ciphertext = envelope[cursor:]

    kek = _load_kek()
    try:
        dek = AESGCM(kek).decrypt(dek_iv, wrapped_dek, aad)
    except InvalidTag as exc:
        raise EnvelopeError(
            "DEK unwrap failed — wrong KEK, wrong AAD, or tampered envelope"
        ) from exc

    try:
        return AESGCM(dek).decrypt(data_iv, ciphertext, aad)
    except InvalidTag as exc:
        raise EnvelopeError(
            "ciphertext authentication failed — wrong AAD or tampered ciphertext"
        ) from exc


# ── Text helpers (base64 wrappers) ──────────────────────────────────────────

def encrypt_text(plaintext: str, aad: Optional[str] = None) -> str:
    """Encrypt a string. AAD (if any) is also UTF-8 encoded."""
    aad_bytes = aad.encode("utf-8") if aad is not None else None
    return base64.b64encode(encrypt(plaintext.encode("utf-8"), aad_bytes)).decode("ascii")


def decrypt_text(envelope_b64: str, aad: Optional[str] = None) -> str:
    aad_bytes = aad.encode("utf-8") if aad is not None else None
    envelope = base64.b64decode(envelope_b64, validate=True)
    return decrypt(envelope, aad_bytes).decode("utf-8")
