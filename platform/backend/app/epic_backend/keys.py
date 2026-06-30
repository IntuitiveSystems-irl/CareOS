"""
RSA key management for Epic Backend Services (client_credentials JWT auth).

Loads the PEM-encoded private key from .data/keys/private.pem (relative to the
backend service's working directory) and exposes:

  - get_private_key()  → cryptography PrivateKey for signing JWTs
  - get_public_jwk()   → {kty,n,e,kid,use,alg} dict for /.well-known/jwks.json
  - get_jwks()         → {"keys": [public_jwk]}

The `kid` is the RFC 7638 JWK Thumbprint (SHA-256, base64url) of the public
key. Epic uses this to select the right key when verifying signed JWTs.

To generate a key pair (one-time setup):
  openssl genrsa -out backend/.data/keys/private.pem 2048

Alternative: set EPIC_BACKEND_PRIVATE_KEY_PEM env var to the PEM contents.
This is useful in Docker where mounting a file is inconvenient.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
from pathlib import Path
from typing import TypedDict

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey, RSAPublicKey

PRIVATE_KEY_PATH = Path.cwd() / ".data" / "keys" / "private.pem"
_PRIVATE_KEY_ENV = "EPIC_BACKEND_PRIVATE_KEY_PEM"


class PublicJwk(TypedDict):
    kty: str
    n: str
    e: str
    kid: str
    use: str
    alg: str


def _b64url_uint(value: int) -> str:
    """Encode a non-negative integer as base64url without padding (RFC 7518)."""
    if value == 0:
        return "AA"
    byte_length = (value.bit_length() + 7) // 8
    return base64.urlsafe_b64encode(value.to_bytes(byte_length, "big")).rstrip(b"=").decode("ascii")


def _load_pem_from_env_or_disk() -> bytes:
    """Prefer EPIC_BACKEND_PRIVATE_KEY_PEM env var; fall back to disk."""
    env_pem = os.environ.get(_PRIVATE_KEY_ENV)
    if env_pem:
        return env_pem.encode("utf-8")
    if not PRIVATE_KEY_PATH.exists():
        raise FileNotFoundError(
            f"Backend private key missing at {PRIVATE_KEY_PATH}. "
            f"Generate with: openssl genrsa -out {PRIVATE_KEY_PATH} 2048 "
            f"(or set {_PRIVATE_KEY_ENV} env var)."
        )
    return PRIVATE_KEY_PATH.read_bytes()


def get_private_key() -> RSAPrivateKey:
    """Load the private key fresh from env or disk. Raises if missing."""
    pem = _load_pem_from_env_or_disk()
    key = serialization.load_pem_private_key(pem, password=None)
    if not isinstance(key, rsa.RSAPrivateKey):
        raise ValueError("Loaded key is not an RSA private key.")
    return key


def _compute_kid(jwk: dict) -> str:
    """RFC 7638 JWK Thumbprint (SHA-256, base64url) over {e,kty,n}."""
    canonical = json.dumps(
        {"e": jwk["e"], "kty": jwk["kty"], "n": jwk["n"]},
        separators=(",", ":"),
        sort_keys=False,
    )
    digest = hashlib.sha256(canonical.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def _public_jwk_from_rsa(public_key: RSAPublicKey) -> dict:
    numbers = public_key.public_numbers()
    return {
        "kty": "RSA",
        "n": _b64url_uint(numbers.n),
        "e": _b64url_uint(numbers.e),
    }


def get_public_jwk() -> PublicJwk:
    """Public JWK with kid/use/alg ready for /.well-known/jwks.json."""
    private_key = get_private_key()
    public_key = private_key.public_key()
    base = _public_jwk_from_rsa(public_key)
    kid = _compute_kid(base)
    return {**base, "kid": kid, "use": "sig", "alg": "RS384"}  # type: ignore[return-value]


def get_jwks() -> dict:
    """Return the JWK Set (single key) for serving at /.well-known/jwks.json."""
    return {"keys": [get_public_jwk()]}
