#!/bin/sh
# Boot sequence: apply migrations → idempotent seed → start the app.
set -e

echo "[zogency] applying database migrations…"
npx prisma migrate deploy

echo "[zogency] seeding (idempotent)…"
npx tsx prisma/seed.ts

echo "[zogency] starting…"
exec npm start
