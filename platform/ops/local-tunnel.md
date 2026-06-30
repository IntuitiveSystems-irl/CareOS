# Local + Cloudflare Tunnel Deployment

Runs the full CareOS stack on your Mac and exposes it at **launchflow.tech** via
Cloudflare Tunnel. No VPS, no SSL certificates needed — Cloudflare terminates TLS
at the edge.

---

## One-time tunnel setup

The CareOS tunnel is **project-specific** and runs independently from other
cloudflared tunnels on this system. It uses its own launchd agent
(`com.careos.cloudflared`) and config file in the project directory.

### 1. Tunnel already configured

The tunnel `careos` (ID: a95c9c15-df12-470c-b2be-cfe9ff869e89) is already
created in Cloudflare Zero Trust under the launchflow.tech account.

### 2. Project-specific config

The tunnel config is at `platform/cloudflared.yml`:
- Tunnel ID: `a95c9c15-df12-470c-b2be-cfe9ff869e89`
- Hostname: `launchflow.tech` → `http://localhost:8082`
- No credentials file needed (token-based)

### 3. Launchd service (project-specific)

The service is installed as `com.careos.cloudflared`:
- **Config:** `/Users/me./WebDev/careos/platform/cloudflared.yml`
- **Logs:** `~/Library/Logs/com.careos.cloudflared.out.log` and `.err.log`
- **Working directory:** `/Users/me./WebDev/careos/platform`

To reload the service after config changes:
```bash
launchctl unload ~/Library/LaunchAgents/com.careos.cloudflared.plist
launchctl load ~/Library/LaunchAgents/com.careos.cloudflared.plist
```

### 4. Public hostname in Cloudflare dashboard

Go to **Cloudflare Zero Trust** → **Networks** → **Tunnels** → **careos**
→ **Public Hostnames**:

- **Subdomain:** *(blank)*
- **Domain:** `launchflow.tech`
- **Service type:** `HTTP`
- **URL:** `http://localhost:8082`

This auto-creates the DNS CNAME record pointing to the tunnel.

---

## First-time build

```bash
cd /Users/me./WebDev/careos/platform
docker compose -f docker-compose.local.yml up --build
```

The `data-model` container exits 0 after running migrations — that's expected.
Subsequent starts don't need `--build` unless code changed.

---

## Start / stop manually

```bash
# Start (detached)
docker compose -f docker-compose.local.yml up -d

# Stop (keeps volumes / database)
docker compose -f docker-compose.local.yml down

# Wipe database too
docker compose -f docker-compose.local.yml down -v

# Status
docker compose -f docker-compose.local.yml ps
```

---

## Auto-start at login (launchd)

The LaunchAgent and startup script are already created. Load them once:

```bash
chmod +x ~/bin/start-careos.sh
launchctl load ~/Library/LaunchAgents/com.careos.app.plist
```

The agent will now start CareOS automatically whenever Docker Desktop is running.

**Stop the auto-start:**
```bash
launchctl unload ~/Library/LaunchAgents/com.careos.app.plist
```

---

## Verify

```bash
# Stack is up
docker compose -f docker-compose.local.yml ps

# nginx reachable locally
curl -I http://localhost:8082

# Backend health (direct)
curl http://localhost:8001/api/health

# Through the tunnel
curl -I https://launchflow.tech
```

---

## Architecture

```
Browser  ──HTTPS──▶  Cloudflare Edge
                          │
                    Launchflow tunnel (token-based)
                          │
                     localhost:8082
                          │
              nginx (frontend container)  ← nginx-local.conf
              ┌──────────────────────────────────────────┐
              │  /api/*  /fhir/*  /auth/*  /ws/*         │
              │       proxy_pass → backend:8000           │
              │  /ai/*  → ai-layer:8100                   │
              │  /*     → SPA (index.html)                │
              └──────────────────────────────────────────┘
```

- TLS terminated by Cloudflare — nginx receives plain HTTP.
- `CF-Connecting-IP` restored to `$remote_addr` for per-client rate-limiting.
- `BASE_URL=https://launchflow.tech` so SMART/OAuth redirects and JWKS are correct.

---

## Key files

| File | Purpose |
|------|---------|
| `platform/docker-compose.local.yml` | Standalone local compose (no certbot, no buildops) |
| `platform/nginx-local.conf` | HTTP-only nginx; CF-Connecting-IP real-IP; no-cache index.html |
| `platform/cloudflared.yml` | Project-specific tunnel config (launchflow.tech → localhost:8082) |
| `platform/.env` | Secrets — git-ignored, copy from `.env.example` |
| `~/bin/start-careos.sh` | Docker startup script (waits for Docker Desktop) |
| `~/Library/LaunchAgents/com.careos.app.plist` | launchd agent — auto-start Docker stack |
| `~/Library/LaunchAgents/com.careos.cloudflared.plist` | Project-specific cloudflared tunnel agent |
