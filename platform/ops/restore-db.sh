#!/usr/bin/env sh
# ─────────────────────────────────────────────────────────────────────────────
# Restore an encrypted CareOS database backup produced by ops/backup-db.sh
# (remediation R-4). Decrypts → gunzips → pipes into psql.
#
#   set -a; . /opt/patient-health-agent/.env; set +a
#   /opt/patient-health-agent/ops/restore-db.sh /opt/patient-health-agent/backups/db-YYYYMMDD-HHMMSS.sql.gz.enc
#
# WARNING: applies the dump to the live database. Test restores into a scratch
# database/container first; verify before running against production.
# ─────────────────────────────────────────────────────────────────────────────
set -eu

PROJECT_DIR="${PROJECT_DIR:-/opt/patient-health-agent}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${POSTGRES_USER:-agent}"
DB_NAME="${POSTGRES_DB:-patient_agent}"

FILE="${1:-}"
[ -n "$FILE" ] || { echo "usage: restore-db.sh <backup-file.sql.gz.enc>" >&2; exit 2; }
[ -f "$FILE" ] || { echo "no such file: $FILE" >&2; exit 2; }
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE must be set}"

cd "$PROJECT_DIR"

openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in "$FILE" \
  | gunzip \
  | docker compose exec -T "$DB_SERVICE" psql -U "$DB_USER" -d "$DB_NAME"

echo "[restore-db] restored from $FILE"
