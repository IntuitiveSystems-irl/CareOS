#!/usr/bin/env sh
# ─────────────────────────────────────────────────────────────────────────────
# Encrypted PostgreSQL backup for the CareOS platform (Policy §6 Availability /
# §8, remediation R-4). Runs `pg_dump` inside the db container, gzips, and
# symmetrically encrypts the dump with AES-256 before writing to disk.
#
# Run on the Docker host (e.g. via cron). REQUIRES BACKUP_PASSPHRASE in the
# environment — never hardcode it. Pull it from platform/.env or a secret store:
#
#   set -a; . /opt/patient-health-agent/.env; set +a   # loads BACKUP_PASSPHRASE
#   /opt/patient-health-agent/ops/backup-db.sh
#
# Restore with ops/restore-db.sh.
# ─────────────────────────────────────────────────────────────────────────────
set -eu

PROJECT_DIR="${PROJECT_DIR:-/opt/patient-health-agent}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${POSTGRES_USER:-agent}"
DB_NAME="${POSTGRES_DB:-patient_agent}"

: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE must be set (see platform/.env.example)}"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/db-$STAMP.sql.gz.enc"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
cd "$PROJECT_DIR"

# pg_dump → gzip → AES-256 (pbkdf2). Pipe fails loudly thanks to `set -e` + the
# pipefail emulation below.
( set -o pipefail 2>/dev/null || true
  docker compose exec -T "$DB_SERVICE" pg_dump -U "$DB_USER" -d "$DB_NAME" \
    | gzip -9 \
    | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_PASSPHRASE \
    > "$OUT" )

chmod 600 "$OUT"

# Retention: delete encrypted backups older than RETENTION_DAYS.
find "$BACKUP_DIR" -name 'db-*.sql.gz.enc' -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true

echo "[backup-db] wrote $OUT ($(wc -c < "$OUT") bytes); pruned >${RETENTION_DAYS}d"
