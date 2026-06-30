# CareOS Deploy Runbook (launchflow.tech)

Server: `root@89.167.38.156`, compose project `patient-health-agent` at
`/opt/patient-health-agent/`. No git remote — deploy is rsync from the Mac.

---

## 0. If the site is unreachable ("Safari cannot reach the server")

Diagnose from your Mac:

```bash
dig +short launchflow.tech            # should print 89.167.38.156
ping -c 2 89.167.38.156               # host alive?
nc -zv -G 5 89.167.38.156 22          # SSH
nc -zv -G 5 89.167.38.156 443         # HTTPS
```

- **All ports time out + ping fails** → the VPS itself is DOWN. This is an
  infrastructure issue, not code. Log into the VPS provider control panel for
  `89.167.38.156` and **reboot / power on** the server (or check for a
  suspension / billing hold). Nothing can be deployed until SSH (22) answers.
  (Observed 2026-06-26: ICMP + 22/80/443 all timed out → host down.)
- **22 open but 443 refused/down** → host up, containers down. SSH in and run
  `cd /opt/patient-health-agent && docker compose ps` then bring services up
  (step 2).

Once SSH responds, continue.

---

## 1. Push code (rsync from `platform/`)

```bash
rsync -rlptzc --no-owner --no-group platform/backend/app/  root@89.167.38.156:/opt/patient-health-agent/backend/app/
rsync -rlptzc --no-owner --no-group platform/frontend/src/ root@89.167.38.156:/opt/patient-health-agent/frontend/src/
```

Do **NOT** rsync `docker-compose.yml` or `nginx-security.conf` wholesale — the
server copies have local edits (inline secrets; `buildops-checkout` upstream
neutralized to `return 404;`). Overwriting them breaks nginx startup.

## 2. Rebuild + restart (on the server)

```bash
ssh root@89.167.38.156 'cd /opt/patient-health-agent && docker compose up -d --build --no-deps backend frontend'
```

`--no-deps` avoids re-running the data-model migration container that exits(1).
New SQLAlchemy tables (external_ehr_tokens, ehr_auth_sessions, clinicians,
patient_feedback) auto-create via `create_all` on backend start. No ALTERs
needed (no new columns on existing tables).

## 3. nginx: add the CDS Hooks proxy (one-time)

The new HL7 CDS Hooks endpoint is the top-level path `/cds-services` (NOT under
`/api`). The server nginx must proxy it or Epic/our UI hits the SPA fallback.
Because we don't rsync nginx wholesale, add the block surgically to the server's
live config (inside the `server { listen 443; server_name launchflow.tech; }`
block, e.g. next to the `location /fhir/` block):

```nginx
location /cds-services {
    proxy_pass http://backend:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Then validate + reload:

```bash
ssh root@89.167.38.156 'cd /opt/patient-health-agent && docker compose exec -T frontend nginx -t && docker compose exec -T frontend nginx -s reload'
```

(The repo `platform/nginx-security.conf` already contains this block as the
source of truth.)

## 4. Backend env (one-time, for OAuth callback correctness)

The OUTBOUND SMART connect flow builds its callback from `BASE_URL`. In the
server's `docker-compose.yml` backend `environment:`, set:

```
BASE_URL=https://launchflow.tech
```

(Default is `http://localhost:8000`, which would produce a wrong redirect_uri.)
Then `docker compose up -d --no-deps backend`. For real Epic/Cerner OAuth, the
per-org `client_id` must be registered with redirect_uri
`https://launchflow.tech/api/ehr-connect/callback`.

## 5. Verify

```bash
curl -sS -I https://launchflow.tech/                       # 200, SPA
curl -sS https://launchflow.tech/cds-services | head        # {"services":[...]}
curl -sS https://launchflow.tech/api/relational/sources | head
curl -sS https://launchflow.tech/.well-known/smart-configuration | head
# bundle changed:
curl -sS https://launchflow.tech/ | grep -o 'assets/index-[^"]*\.js'
```

Smoke-test the deterministic core locally any time:

```bash
cd platform/backend && python3 scripts/test_relational_cds.py   # 32/32
```
