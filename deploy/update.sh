#!/usr/bin/env bash
# Zogency client auto-updater (vendor-managed installs only).
# Installed by install.sh when ZOGENCY_MASTER_URL is set; runs via cron.
# Polls the master's release channel and updates to the published ref.
set -euo pipefail
DIR="/opt/zogency"
cd "$DIR"

MASTER_URL=$(grep '^ZOGENCY_MASTER_URL=' .env.production | cut -d= -f2- || true)
DOMAIN=$(grep '^DOMAIN=' .env.production | cut -d= -f2- || true)
# License key authenticates our check-in to the master (URL-encode not needed:
# zgy1.* keys are base64url + dots, all URL-safe).
LICENSE=$(grep '^SEED_LICENSE_KEY=' .env.production | cut -d= -f2- || true)
[ -n "$MASTER_URL" ] || exit 0

CURRENT=$(git rev-parse HEAD)
# Report our version regardless of update outcome.
curl -fsS --max-time 15 "$MASTER_URL/api/vendor/checkin?domain=${DOMAIN}&version=${CURRENT}&key=${LICENSE}" >/dev/null 2>&1 || true

REF=$(curl -fsS --max-time 15 "$MASTER_URL/api/vendor/release" 2>/dev/null || true)
[ -n "$REF" ] && [ "$REF" != "none" ] || exit 0

git fetch --quiet origin
if [ "$REF" = "main" ]; then
  TARGET=$(git rev-parse origin/main)
else
  TARGET="$REF"
fi
[ "$TARGET" != "$CURRENT" ] || exit 0

echo "[zogency-update] $(date -u +%FT%TZ) updating ${CURRENT:0:8} -> ${TARGET:0:8}"
git reset --hard "$TARGET"
docker compose --env-file "$DIR/.env.production" -f "$DIR/deploy/docker-compose.yml" up -d --build
NEW=$(git rev-parse HEAD)
curl -fsS --max-time 15 "$MASTER_URL/api/vendor/checkin?domain=${DOMAIN}&version=${NEW}&key=${LICENSE}" >/dev/null 2>&1 || true
echo "[zogency-update] done, now on ${NEW:0:8}"
