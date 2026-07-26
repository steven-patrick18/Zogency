#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Weekly Docker maintenance for a Zogency host.
#
# Reclaims the Docker BUILD CACHE and dangling images that accumulate every time
# the web image is rebuilt (manual deploys + vendor auto-updates). On a busy
# install this is the single biggest disk consumer.
#
# SAFE by construction: it removes only build cache and unreferenced image
# layers. It never touches running containers, named volumes (Postgres/Redis
# data, backups), or images currently in use.
#
# Installed as a weekly cron by deploy/install.sh. Writes a small status file the
# app reads to show "last cleanup" on Settings → Server.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

STAMP_DIR="${ZOGENCY_MAINT_DIR:-/opt/zogency/deploy/maintenance}"
mkdir -p "$STAMP_DIR"

used_bytes() { df -B1 --output=used / | tail -1 | tr -dc '0-9'; }

before=$(used_bytes)
docker builder prune -af >/dev/null 2>&1 || true
docker image prune -f    >/dev/null 2>&1 || true
after=$(used_bytes)

freed=$(( before - after ))
[ "$freed" -lt 0 ] && freed=0

printf '{"ranAt":"%s","freedBytes":%s,"usedBytesAfter":%s}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$freed" "$after" > "$STAMP_DIR/last-cleanup.json"

echo "[zogency-cleanup] freed $(( freed / 1024 / 1024 )) MB"
