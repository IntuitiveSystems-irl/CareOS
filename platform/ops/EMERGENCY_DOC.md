# Emergency Operations Documentation

**Last Updated:** June 16, 2026  
**Purpose:** Rapid triage and recovery procedures for CareOS production infrastructure

---

## Server Blocks

### Server 1: Production
- **IP:** 89.167.38.156
- **User:** root
- **Purpose:** CareOS production hosting (launchflow.tech)
- **Project Path:** /opt/patient-health-agent/
- **Services:** Docker Compose (backend, frontend, db), Nginx, Certbot

---

## SSH Access Commands

### Key-Based Access (Preferred)
```bash
ssh root@89.167.38.156
```

### Password Fallback
```bash
ssh root@89.167.38.156
# Enter password when prompted
```

### From Termux (Android)
```bash
ssh root@89.167.38.156
```

---

## Key Services & Ports

| Service | Port | Purpose | Health Check |
|---------|------|---------|--------------|
| Nginx | 80, 443 | Reverse proxy, SSL termination | `curl -I https://launchflow.tech` |
| Backend (FastAPI) | 8000 | API server | `curl https://launchflow.tech/api/health` |
| Frontend (React/Vite) | 3000 | Web UI | `curl https://launchflow.tech` |
| PostgreSQL | 5432 | Database | `docker compose exec -T db pg_isready` |
| Certbot | N/A | SSL certificate management | Check cert expiry |

---

## Critical Commands by Service Type

### Docker Compose
```bash
# Navigate to project
cd /opt/patient-health-agent

# Check status
docker compose ps

# View logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db

# Restart services
docker compose restart backend
docker compose restart frontend

# Rebuild and deploy (no data migration)
docker compose up -d --build --no-deps backend frontend

# Full rebuild (use with caution)
docker compose down
docker compose up -d --build
```

### Nginx
```bash
# Test configuration
nginx -t

# Reload configuration
nginx -s reload

# Restart nginx
systemctl restart nginx

# View error logs
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log

# Check status
systemctl status nginx
```

### SSL/Certbot
```bash
# Check certificate expiry
docker run --rm -v /etc/letsencrypt:/etc/letsencrypt certbot/certbot certificates

# Manual renewal (webroot)
docker run --rm -v /etc/letsencrypt:/etc/letsencrypt -v /var/www/certbot:/var/www/certbot certbot/certbot certonly --webroot -w /var/www/certbot --cert-name launchflow.tech -d launchflow.tech -d www.launchflow.tech --force-renewal

# Renewal (dry-run)
docker run --rm -v /etc/letsencrypt:/etc/letsencrypt -v /var/www/certbot:/var/www/certbot certbot/certbot renew --dry-run
```

### PostgreSQL
```bash
# Connect to database
docker compose exec -T db psql -U agent -d patient_agent

# Check connection
docker compose exec -T db pg_isready

# Backup database
cd /opt/patient-health-agent/ops
./backup-db.sh

# Restore database
./restore-db.sh <backup_file>
```

### System
```bash
# Check disk space
df -h

# Check memory
free -h

# Check CPU
top

# View system logs
journalctl -f
```

---

## Health Check Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| https://launchflow.tech | Frontend | HTML page |
| https://launchflow.tech/api/health | Backend health | 200 OK |
| https://launchflow.tech/api/research/auth/check | Research auth | 401 (no key) or 200 (with key) |
| https://buildops.launchflow.tech | Buildops redirect | 301 to buildopshq.site |

---

## File Locations

### Production Server
- **Project Root:** /opt/patient-health-agent/
- **Docker Compose:** /opt/patient-health-agent/docker-compose.yml
- **Nginx Config:** /etc/nginx/nginx-security.conf
- **SSL Certs:** /etc/letsencrypt/live/launchflow.tech/
- **Backend Code:** /opt/patient-health-agent/backend/app/
- **Frontend Code:** /opt/patient-health-agent/frontend/src/
- **Backup Scripts:** /opt/patient-health-agent/ops/
- **Backups:** /opt/patient-health-agent/backups/
- **Nginx Logs:** /var/log/nginx/

### Local Machine
- **Project Root:** /Users/me./WebDev/careos/platform/
- **Backend:** /Users/me./WebDev/careos/platform/backend/
- **Frontend:** /Users/me./WebDev/careos/platform/frontend/
- **Docs:** /Users/me./WebDev/careos/platform/docs/
- **Ops:** /Users/me./WebDev/careos/platform/ops/

---

## SSH Keys Section

### Local Machine SSH Keys
```bash
# List all SSH keys
ls -la ~/.ssh/

# Common locations:
# ~/.ssh/id_rsa
# ~/.ssh/id_ed25519
# ~/.ssh/id_ecdsa
```

### Key Mapping
- **Server:** 89.167.38.156
- **User:** root
- **Auth Method:** Password-based (no key mapping configured)
- **Note:** Current setup uses password authentication. Key-based auth recommended for improved security.

---

## Critical URLs

### Production
- **Main Site:** https://launchflow.tech
- **Research Study:** https://launchflow.tech/research
- **Research Dashboard:** https://launchflow.tech/research/dashboard
- **Theme Explorer:** https://launchflow.tech/research/themes
- **Relational Showcase:** https://launchflow.tech/relational

### Admin/Debug
- **Research Auth Check:** https://launchflow.tech/api/research/auth/check
- **Backend Health:** https://launchflow.tech/api/health

### Redirects
- **Buildops:** https://buildops.launchflow.tech → https://buildopshq.site (301)

---

## Emergency Checklist

### 8-Step Rapid Triage Procedure

1. **Check Server Connectivity**
   ```bash
   ssh root@89.167.38.156
   # If unreachable, check network/ISP issues
   ```

2. **Verify Site Accessibility**
   ```bash
   curl -I https://launchflow.tech
   # Expected: 200 OK with SSL headers
   ```

3. **Check Service Status**
   ```bash
   cd /opt/patient-health-agent
   docker compose ps
   systemctl status nginx
   ```

4. **Check Disk Space**
   ```bash
   df -h
   # Alert if >80% used
   ```

5. **Check SSL Certificate**
   ```bash
   docker run --rm -v /etc/letsencrypt:/etc/letsencrypt certbot/certbot certificates
   # Check expiry date
   ```

6. **Review Recent Logs**
   ```bash
   docker compose logs --tail=50 backend
   docker compose logs --tail=50 frontend
   tail -50 /var/log/nginx/error.log
   ```

7. **Check Database Connectivity**
   ```bash
   docker compose exec -T db pg_isready
   docker compose exec -T db psql -U agent -d patient_agent -c "SELECT 1;"
   ```

8. **Verify Research Subsystem**
   ```bash
   curl -H "X-Research-Key: fd35fd898133ad2bc55b" https://launchflow.tech/api/research/auth/check
   # Expected: 200 OK
   ```

---

## Termux Setup

### Package Installation
```bash
pkg update
pkg install openssh
```

### SSH Server Startup (if using Termux as server)
```bash
sshd
# Start SSH server on port 8022 (Termux default)
```

### Key Copy Procedure from Local Machine
```bash
# Generate key pair on local machine (if not exists)
ssh-keygen -t ed25519 -C "termux"

# Copy public key to Termux
scp ~/.ssh/id_ed25519.pub <termux_user>@<termux_ip>:/data/data/com.termux/files/home/.ssh/authorized_keys

# Or use ssh-copy-id if available
ssh-copy-id -p 8022 <termux_user>@<termux_ip>
```

### Permission Setup (on Termux)
```bash
# Ensure correct permissions
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### Test Commands
```bash
# From local machine to Termux
ssh -p 8022 <termux_user>@<termux_ip>

# From Termux to production server
ssh root@89.167.38.156
```

---

## SSH Config (Optional)

### Config File Template
Create/Edit `~/.ssh/config`:

```
# CareOS Production
Host careos-prod
    HostName 89.167.38.156
    User root
    Port 22
    # IdentityFile ~/.ssh/id_ed25519  # Uncomment if using key-based auth

# Termux (if using as jump host)
Host termux
    HostName <termux_ip>
    User <termux_user>
    Port 8022
```

### Alias-Based Connections
```bash
# After config setup, use:
ssh careos-prod
ssh termux
```

---

## Notes Section

### Authentication Method Notes
- **Current:** Password-based authentication for production server
- **Research Passcode:** fd35fd898133ad2bc55b (X-Research-Key header)
- **Recommendation:** Migrate to SSH key-based auth for improved security
- **Research Auth:** Header-only (X-Research-Key), query param ?key= disabled

### Data Persistence Notes
- **Database:** PostgreSQL in Docker container, volumes mapped
- **Backups:** Encrypted pg_dump stored in /opt/patient-health-agent/backups/
- **Backup Passphrase:** Set via BACKUP_PASSPHRASE environment variable
- **Backup Schedule:** Manual (cron not yet installed - see COMPLIANCE_MATRIX R-4)

### Critical File Locations
- **Docker Compose:** /opt/patient-health-agent/docker-compose.yml (server has local copy, not rsynced)
- **Nginx Security:** /etc/nginx/nginx-security.conf (rsynced from repo)
- **Environment:** /opt/patient-health-agent/.env (server-only, not in git)
- **Backup Scripts:** /opt/patient-health-agent/ops/backup-db.sh, restore-db.sh

### Backup Procedures
```bash
# Create backup
cd /opt/patient-health-agent/ops
./backup-db.sh

# Restore from backup
./restore-db.sh <backup_file.sql.gz>

# Manual backup command
docker compose exec -T db pg_dump -U agent patient_agent | gzip > backup.sql.gz
```

### Monitoring/Alerting Info
- **Current Status:** No automated monitoring/alerting configured
- **Manual Checks:** Use emergency checklist
- **Log Locations:** Docker logs, Nginx logs, system journal
- **SSL Expiry:** Valid until Sep 7, 2026 (manual renewal required)
- **Disk Space:** Monitor with `df -h` (alert at 80%)

### Deployment Procedure
```bash
# From local machine
rsync -rlptzc --no-owner --no-group \
  /Users/me./WebDev/careos/platform/backend/app/ \
  root@89.167.38.156:/opt/patient-health-agent/backend/app/

rsync -rlptzc --no-owner --no-group \
  /Users/me./WebDev/careos/platform/frontend/src/ \
  root@89.167.38.156:/opt/patient-health-agent/frontend/src/

# On server
cd /opt/patient-health-agent
docker compose up -d --build --no-deps backend frontend
docker compose exec -T frontend nginx -t && nginx -s reload

# Verify deployment
curl https://launchflow.tech/ | grep assets/*.js
```

### Known Issues
- **SSL Auto-Renewal:** Cron not installed (cert expires Sep 7, 2026)
- **Browser Caching:** index.html lacks no-cache header (stale after deploy)
- **Docker Compose Divergence:** Server compose has inline secrets, not rsynced
- **Research Auth:** Single shared passcode (no per-user/MFA)

### Vendor/External Services
- **Resend:** Email service (API key in server .env)
- **SSL:** Let's Encrypt (certbot)
- **Domain:** launchflow.tech, www.launchflow.tech

### Security Headers (Verified)
- **Permissions-Policy:** camera=() (webcam blocked site-wide)
- **CSP:** script-src 'self' 'unsafe-inline' 'unsafe-eval' (external scripts blocked)
- **Note:** Webcam eye-tracking requires header relaxation to camera=(self)

### Database Schema Notes
- **Auto-Creation:** New tables created via SQLAlchemy create_all on startup
- **Column Changes:** Manual ALTER required for existing tables
- **Example:** `ALTER TABLE research_participants ADD COLUMN IF NOT EXISTS style_preference VARCHAR(10);`

### Research Subsystem Endpoints
- **Participant Registration:** POST /api/research/participants/register
- **Participant Login:** POST /api/research/participants/login
- **Exploration Metrics:** POST /api/research/participants/{id}/exploration
- **Style Preference:** POST /api/research/participants/{id}/style-preference
- **Withdraw:** POST /api/research/participants/{id}/withdraw (gated)
- **Results Export:** GET /api/research/results/export.csv (gated)
- **Audit Log:** GET /api/research/results/audit (gated)

### Contact Information
- **Server Provider:** [Add provider info]
- **Domain Registrar:** [Add registrar info]
- **Emergency Contact:** [Add contact info]
