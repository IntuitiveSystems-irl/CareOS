#!/usr/bin/env bash
#
# init-letsencrypt.sh — first-time Let's Encrypt issuance for launchflow.tech
#
# WHY THIS EXISTS
#   nginx (the `frontend` service) refuses to start when the ssl_certificate
#   files referenced in nginx-security.conf are missing — but certbot needs
#   nginx already serving the ACME HTTP-01 challenge to issue those very
#   certs. This is the classic chicken-and-egg. We break it by writing
#   throwaway self-signed certs, booting nginx, then swapping in real certs.
#
# WHEN TO RUN
#   ONCE, on the server (89.167.38.156), from the platform/ directory:
#       sudo ./init-letsencrypt.sh
#   After that the `certbot` service auto-renews and the `frontend` service
#   reloads nginx every 6h, so you never need to run this again.
#
# SAFETY
#   Re-running asks before clobbering existing real certs. Use STAGING=1 to
#   dry-run against Let's Encrypt's staging CA (avoids the 5-per-week
#   duplicate-cert rate limit while testing).
#
set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
# One entry per certificate. Space-separated domains share a single SAN cert.
# These MUST match the server_name + ssl_certificate paths in
# nginx-security.conf (live/<first-domain>/...).
CERTS=(
  "launchflow.tech www.launchflow.tech"
  "wa.launchflow.tech"
  "buildops.launchflow.tech"
)
EMAIL="admin@launchflow.tech"   # Let's Encrypt expiry/security notices
RSA_KEY_SIZE=4096
STAGING="${STAGING:-0}"          # 1 = use LE staging CA (untrusted, no rate limit)

# ── Pick a compose command ──────────────────────────────────────────────────
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "Error: neither 'docker compose' nor 'docker-compose' is available." >&2
  exit 1
fi

cd "$(dirname "$0")"

primary() { echo "$1" | awk '{print $1}'; }

# ── Guard against accidentally wiping real certs ─────────────────────────────
existing=0
for cert in "${CERTS[@]}"; do
  d="$(primary "$cert")"
  [ -d "/etc/letsencrypt/live/$d" ] && existing=1
done
if [ "$existing" = "1" ]; then
  read -rp "Existing certificate(s) found under /etc/letsencrypt/live. Replace them? (y/N) " ans
  case "$ans" in [yY]*) : ;; *) echo "Aborted."; exit 0 ;; esac
fi

# ── Recommended TLS params (Mozilla intermediate) ────────────────────────────
if [ ! -e "/etc/letsencrypt/options-ssl-nginx.conf" ] || [ ! -e "/etc/letsencrypt/ssl-dhparams.pem" ]; then
  echo "### Downloading recommended TLS parameters ..."
  mkdir -p /etc/letsencrypt
  curl -fsSL https://raw.githubusercontent.com/certbot/certbot/main/certbot-nginx/src/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
    > /etc/letsencrypt/options-ssl-nginx.conf
  curl -fsSL https://raw.githubusercontent.com/certbot/certbot/main/certbot/certbot/ssl-dhparams.pem \
    > /etc/letsencrypt/ssl-dhparams.pem
fi

# ── 1. Dummy certs so nginx can boot ─────────────────────────────────────────
echo "### Creating dummy certificates ..."
for cert in "${CERTS[@]}"; do
  d="$(primary "$cert")"
  $COMPOSE run --rm --entrypoint /bin/sh certbot -c "
    mkdir -p '/etc/letsencrypt/live/$d' &&
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
      -keyout '/etc/letsencrypt/live/$d/privkey.pem' \
      -out    '/etc/letsencrypt/live/$d/fullchain.pem' \
      -subj '/CN=localhost'"
done

# ── 2. Boot nginx (serves the ACME challenge from /var/www/certbot) ──────────
echo "### Starting frontend (nginx) ..."
$COMPOSE up --force-recreate -d frontend

# ── 3. Drop the dummy certs ──────────────────────────────────────────────────
echo "### Deleting dummy certificates ..."
for cert in "${CERTS[@]}"; do
  d="$(primary "$cert")"
  $COMPOSE run --rm --entrypoint /bin/sh certbot -c "
    rm -Rf /etc/letsencrypt/live/$d \
           /etc/letsencrypt/archive/$d \
           /etc/letsencrypt/renewal/$d.conf"
done

# ── 4. Request the real certificates ─────────────────────────────────────────
echo "### Requesting Let's Encrypt certificates ..."
staging_arg=""
[ "$STAGING" != "0" ] && staging_arg="--staging"

for cert in "${CERTS[@]}"; do
  domain_args=""
  for d in $cert; do domain_args="$domain_args -d $d"; done
  $COMPOSE run --rm --entrypoint certbot certbot certonly \
    --webroot -w /var/www/certbot \
    $staging_arg \
    $domain_args \
    --email "$EMAIL" \
    --rsa-key-size "$RSA_KEY_SIZE" \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    --force-renewal
done

# ── 5. Reload nginx + start the auto-renewal loop ────────────────────────────
echo "### Reloading nginx ..."
$COMPOSE exec frontend nginx -s reload

echo "### Starting certbot auto-renewal service ..."
$COMPOSE up -d certbot

echo
echo "### Done. https://launchflow.tech should now serve a valid certificate."
echo "    Verify:  curl -vI https://launchflow.tech 2>&1 | grep -i 'SSL\\|expire'"
