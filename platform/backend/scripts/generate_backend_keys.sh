#!/usr/bin/env bash
# Generate the RSA 2048 key pair used by Epic Backend Services JWT signing.
#
# Run once from the backend/ directory. The private key never leaves the
# server. The public key is exposed by GET /.well-known/jwks.json once the
# backend is running — register that URL in Epic's Backend Systems app config.
#
# Usage:
#   cd backend/
#   ./scripts/generate_backend_keys.sh
set -euo pipefail

KEY_DIR=".data/keys"
KEY_PATH="${KEY_DIR}/private.pem"

if [[ -f "${KEY_PATH}" ]]; then
  echo "Refusing to overwrite existing key at ${KEY_PATH}." >&2
  echo "Delete it first if you really want to rotate keys." >&2
  exit 1
fi

mkdir -p "${KEY_DIR}"
openssl genrsa -out "${KEY_PATH}" 2048
chmod 600 "${KEY_PATH}"

echo
echo "Generated ${KEY_PATH}"
echo
echo "Next steps:"
echo "  1. Start the backend (uvicorn app.main:app --reload --port 8000)"
echo "  2. Curl http://localhost:8000/.well-known/jwks.json to confirm"
echo "  3. Register the JWKS URL in Epic's Backend Systems app config:"
echo "       Non-Production JWK Set URL: https://<your-host>/.well-known/jwks.json"
echo "       Production  JWK Set URL: https://<your-host>/.well-known/jwks-prod.json"
echo "  4. Wait 30-60min for Epic to propagate before /api/epic-backend/test will succeed."
