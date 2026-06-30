"""
Envelope encryption helpers for PHI at rest.

Wraps PHI columns and stored message bodies in AES-256-GCM with a 12-byte
random IV. The Key Encryption Key (KEK) lives in `LAUNCHFLOW_RELAY_KEK`
(32 bytes base64-encoded); each ciphertext carries its own Data Encryption
Key (DEK) wrapped by the KEK.

Layout of a single envelope (base64 of):
    [version=1 (1B)] [wrapped_dek_iv (12B)] [wrapped_dek (44B)] [data_iv (12B)] [ciphertext + GCM tag]

This keeps the KEK rotation cheap: re-wrap each DEK with the new KEK without
touching the (large) ciphertext.
"""

from .envelope import (
    EnvelopeError,
    decrypt,
    decrypt_text,
    encrypt,
    encrypt_text,
    generate_kek,
    kek_fingerprint,
)

__all__ = [
    "EnvelopeError",
    "decrypt",
    "decrypt_text",
    "encrypt",
    "encrypt_text",
    "generate_kek",
    "kek_fingerprint",
]
