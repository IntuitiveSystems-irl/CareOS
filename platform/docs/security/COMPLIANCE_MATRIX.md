# CareOS Research — Security Compliance Matrix & Remediation Plan

Companion to `SECURITY_POLICY.md`. Maps each policy requirement to the system **as implemented**,
with an honest status, evidence, and a prioritized remediation backlog. This is the artifact an IRB
or institutional reviewer should read to see that the policy is real, not aspirational.

**Assessment date:** _[DATE]_ · **Assessed by:** _[NAME]_ · **Next review:** _[DATE]_

**Status legend:** ✅ Met · 🟡 Partial · ❌ Gap

---

## 1. Executive Scorecard

| Domain | Status | Notes |
|--------|--------|-------|
| Transport security (TLS/HSTS/headers) | ✅ Met | Strong nginx hardening; auto-renewing certs |
| Network exposure | ✅ Met | DB/API loopback-bound; only nginx is public |
| Data minimization & consent | ✅ Met | Minimal identifiers; consent recorded; no PHI; no webcam |
| Identifier/response separation | 🟡 Partial | Logically separated tables; identifiers not encrypted at column level |
| Secrets management | 🟡 Partial | Externalized to git-ignored `.env` (R-1 done); key **never in git history**. Rotate key + mirror on server. |
| Researcher access control | 🟡 Partial | Header-only credential + auth rate-limit done (R-3/R-7); single **shared** passcode remains — per-user/MFA pending (R-2) |
| Audit logging (researcher access/export) | ✅ Met | Append-only audit log of every gated access/export (R-6 done) |
| Backups & recovery | 🟡 Partial | Encrypted backup/restore scripts delivered (R-4); host cron + restore test pending |
| Encryption at rest (L3 identifiers) | 🟡 Partial | Relies on host disk; no column-level encryption |
| Data retention & disposal | 🟡 Partial | Policy defined; not yet codified/automated |
| Vendor risk review | 🟡 Partial | Vendors known; formal review not documented |

---

## 2. Control-by-Control Matrix

| # | Policy ref | Control | Status | Evidence / Gap |
|---|-----------|---------|--------|----------------|
| C1 | §5.3 | HTTPS only, HTTP→HTTPS redirect, HSTS preload | ✅ | `nginx-security.conf` (301 redirect; `Strict-Transport-Security max-age=63072000; includeSubDomains; preload`) |
| C2 | §5.3 | Modern TLS only (1.2/1.3), strong ciphers | ✅ | `nginx-security.conf` (`ssl_protocols TLSv1.2 TLSv1.3`) |
| C3 | §5.3 | Security headers (CSP, X-Frame DENY, nosniff, Referrer-Policy) | ✅ | `nginx-security.conf` |
| C4 | §5.4 / §11 | Camera/mic/geolocation disabled site-wide | ✅ | `Permissions-Policy: camera=(), microphone=(), geolocation=()` — enforces "no webcam" consent claim |
| C5 | §5.3 | Database & API not publicly exposed | ✅ | `docker-compose.yml` ports `127.0.0.1:5432`, `127.0.0.1:8000` |
| C6 | §5.3 | Dotfile/secret-path requests blocked | ✅ | `nginx-security.conf` (`location ~ /\.` → 404) |
| C7 | §6 (Availability) | TLS certificate auto-renewal | ✅ | `docker-compose.yml` `certbot` (renew every 12h) + nginx reload every 6h |
| C8 | §5.1 | Researcher routes fail-closed, constant-time compare | ✅ | `app/research/auth.py` (`secrets.compare_digest`; 503 if unset) |
| C9 | §4 / §5.4 | Data minimization (only name+email as identifiers) | ✅ | `app/research/models.py`; consent text states purpose |
| C10 | §5.4 | Identifiers separated from responses | 🟡 | Responses keyed by `participant_id` in separate tables; identifiers and responses share one DB; no column encryption on `full_name`/`email` |
| C11 | §5.4 / §8 | Secrets not in source control | ✅ | `docker-compose.yml` is **untracked** and the key was **never in git history** (verified `git log -S`); secrets now externalized to git-ignored `.env` via `${VAR}` (R-1). Server mirror + key rotation recommended. |
| C12 | §5.1 / §14 | Unique per-user accounts, no shared logins | ❌ | Single shared `RESEARCH_ADMIN_PASSCODE` for all researchers → R-2 |
| C13 | §5.1 | MFA on accounts reaching research data | 🟡 | Depends on host/Git/vendor account config; app-level researcher gate has none → R-2 |
| C14 | §5.1 / §5.3 | Credentials not exposed in URLs/logs | ✅ | Query-param credential removed; `X-Research-Key` header only (R-3 done) |
| C15 | §6 (Integrity) / §7 | Audit trail of researcher access & exports | ✅ | `research_access_audit` logs every gated request (action, ok, IP, time); viewable at `/api/research/results/audit` (R-6 done) |
| C16 | §6 (Availability) / §8 | Automated encrypted backups + tested restore | 🟡 | Encrypted `pg_dump` backup/restore scripts delivered (`ops/`, R-4); host cron + restore test pending |
| C17 | §5.4 / §8 | Encryption at rest for L3 identifiers | 🟡 | Host-volume dependent; no app/column encryption → R-5 |
| C18 | §7 / §5.3 | Brute-force protection / rate limiting on auth | ✅ | nginx `limit_req` on `/api/research/auth/` + `/results/` (R-7 done); constant-time compare in app |
| C19 | §13 | Retention & secure disposal procedure | 🟡 | Purge + withdrawal endpoints implemented (R-9); end-of-study run is operational/scheduled by the team |
| C20 | §10 | Documented vendor risk review | 🟡 | Vendors enumerated below; dispositions not formally recorded → R-8 |
| C21 | §9 | Participant data kept out of public AI tools | ✅ | Research records not sent to AI layer; AI component uses synthetic data |
| C22 | §11 | Consent recorded, withdrawal honored | ✅ | Consent captured; `/participants/{id}/withdraw` erases identifiers + marks withdrawn (R-9 done) |

---

## 3. Remediation Backlog (prioritized)

> **Implemented in this change:** R-1 (secrets externalized), R-3 (header-only credential),
> R-6 (access audit log), R-7 (auth rate-limiting), R-9 (withdrawal + purge endpoints), and the
> R-4 backup/restore tooling. **Remaining for the team:** rotate the email key + mirror `.env` on
> the server (R-1), schedule the backup cron + run a restore test (R-4), per-user identity/MFA (R-2),
> and column-level identifier encryption (R-5).

### P0 — Secrets hygiene (repo ✅ done; finish on server)

**R-1 · Externalize secrets (✅ repo) + rotate & mirror on server**
- **Correction:** `docker-compose.yml` is **untracked** and the email key was **never committed** to
  Git history (verified with `git log -S`). This is *plaintext in an untracked deploy file*, not a
  Git leak — so the original P0 "committed live secret" severity was overstated.
- **Done:** secrets removed from `docker-compose.yml` (now `${POSTGRES_PASSWORD}` / `${RESEND_API_KEY}`);
  `platform/.env.example` added; `.env` confirmed git-ignored.
- **Remaining (you):**
  1. Create `platform/.env` from `.env.example` for local dev.
  2. On the **server**, externalize the same way and create `/opt/patient-health-agent/.env`.
  3. **Rotate the Resend API key** (it has sat in plaintext on disk) and update `.env`.
- Effort: ~30 min. _Owner: _[NAME]_._

### P1 — Before/at recruitment scale-up

**R-2 · Per-researcher identity + MFA (replace shared passcode)**
- Introduce individual researcher accounts (or front the dashboard with the institution's SSO/MFA).
  Interim hardening until then: restrict dashboard access to a VPN/IP allowlist, rotate the passcode
  on personnel change, and record who holds it.
- Effort: 1–2 days (app accounts) or hours (SSO/VPN front). _Owner: _[NAME]_._

**R-3 · Header-only researcher credential**
- Stop accepting the passcode as a `?key=` query parameter (`app/research/auth.py`); require the
  `X-Research-Key` header so credentials don't land in proxy/server logs or browser history. Update
  the CSV/JSON export download to use an authenticated fetch rather than a query-string link.
- Effort: ~1–2 hrs. _Owner: _[NAME]_._

**R-4 · Automated encrypted backups + restore test**
- Add a scheduled `pg_dump` to encrypted, access-controlled off-host storage; document and **test**
  the restore. Define RPO/RTO in the policy.
- Effort: ~half day. _Owner: _[NAME]_._

**R-6 · Researcher access & export audit log**
- Log authenticated researcher actions (dashboard auth success/failure, each export) with timestamp
  and source IP to an append-only audit table/log for integrity and incident review.
- Effort: ~half day. _Owner: _[NAME]_._

**R-9 · Codify retention, disposal & withdrawal**
- Implement a documented routine to purge L3 identifiers (`full_name`, `email`, signature) at the
  IRB-approved time while retaining coded responses, plus an on-request participant withdrawal/erasure
  action. Schedule end-of-study deletion.
- Effort: ~half day. _Owner: _[NAME]_._

### P2 — Hardening / completeness

**R-5 · Column/app-level encryption for L3 identifiers** — encrypt `full_name`/`email` at rest (pgcrypto
or app-layer envelope encryption, mirroring the integration relay's KEK approach); confirm host
full-disk encryption. _Effort: ~1 day._

**R-7 · Rate limiting & lockout on researcher auth** — add nginx `limit_req` on `/api/research/` and/or
app-level lockout after repeated failures. _Effort: ~1–2 hrs._

**R-8 · Document vendor risk review** — record dispositions in the Vendor Register below. _Effort: ~2 hrs._

**R-10 · Tighten CORS** — drop the plain-`http://` origin if unused and review `allow_methods`/
`allow_headers` wildcards in `app/main.py`. _Effort: ~1 hr._

---

## 4. Vendor Register (to complete for R-8 / Policy §10)

| Vendor | Purpose | Data exposed | Storage region | Trains on data? | Disposition |
|--------|---------|--------------|----------------|-----------------|-------------|
| Hosting / VPS provider _[NAME]_ | Compute, DB volume | All study data (at rest) | _[REGION]_ | N/A | _[APPROVED?]_ |
| Resend | Transactional email (login/contact) | Name, email (L3) | _[REGION]_ | _[VERIFY]_ | _[APPROVED?]_ |
| OpenAI (AI layer) | Consent assistant (synthetic data only) | None (no participant data) | US | Per API terms (no training on API data) | Approved — no participant data path |
| Let's Encrypt | TLS certificate issuance | Domain only | US | No | Approved |

---

## 5. Sign-off

| Role | Name | Date |
|------|------|------|
| Principal Investigator | _[NAME]_ | _[DATE]_ |
| Data Security Reviewer | _[NAME]_ | _[DATE]_ |
| IRB Acknowledgment (if required) | _[NAME]_ | _[DATE]_ |
