# Ops — Encrypted Database Backups (R-4)

Implements **Policy §6 (Availability)** and **§8 (Secure Data Handling)**: scheduled,
encrypted PostgreSQL backups with a tested restore path.

## Scripts
- `backup-db.sh` — `pg_dump` → gzip → AES-256 (pbkdf2) → `backups/db-<timestamp>.sql.gz.enc`; prunes
  backups older than `RETENTION_DAYS` (default 30).
- `restore-db.sh <file>` — decrypt → gunzip → `psql` (test into a scratch DB first).

## Requirements
- `BACKUP_PASSPHRASE` in the environment (see `../.env.example`). Store it in a secret manager; the
  passphrase is **not** recoverable — without it, backups cannot be decrypted.
- Run on the Docker host from the project directory (default `/opt/patient-health-agent`).

## Schedule (cron, daily at 03:15)
```cron
15 3 * * * cd /opt/patient-health-agent && set -a && . ./.env && set +a && \
  ops/backup-db.sh >> /var/log/careos-backup.log 2>&1
```
Make the scripts executable once: `chmod +x ops/backup-db.sh ops/restore-db.sh`.

## Off-host copy (recommended)
Local backups protect against accidental deletion, not host loss. Sync the encrypted files to an
institution-approved, access-controlled location (already encrypted, so safe in transit/at rest):
```sh
rsync -az --delete /opt/patient-health-agent/backups/ <secure-offsite-target>/
```

## Restore test (do this at least once, then quarterly)
```sh
set -a && . /opt/patient-health-agent/.env && set +a
# 1. Pick the latest backup
LATEST=$(ls -t /opt/patient-health-agent/backups/db-*.sql.gz.enc | head -1)
# 2. Verify it decrypts and contains SQL (no data written):
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in "$LATEST" | gunzip | head -n 20
# 3. Full restore should be validated against a scratch DB/container, never prod, until trusted.
```

## RPO / RTO
- **RPO:** 24h (daily backups) — tighten the cron cadence if the protocol requires less data loss.
- **RTO:** minutes (single `restore-db.sh` run) once the encrypted file is on the host.

Record completed restore tests (date, file, outcome) in the study's security log for IRB evidence.
