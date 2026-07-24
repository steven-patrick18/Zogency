# 12 — Self-Hosted Installation Guide

**Audience:** anyone installing Zogency on a client agency's server (doc 02 §11.2).
**Prereqs:** a fresh Ubuntu 22.04/24.04 (or Debian 12) VPS — 4 vCPU / 8 GB / 160 GB recommended (2/4/80 minimum) — with SSH sudo access, ports 80/443 open, and a subdomain's DNS A-record pointed at the server.

## One-command install

SSH into the server and run:

```bash
curl -fsSL https://raw.githubusercontent.com/steven-patrick18/Zogency/main/deploy/install.sh | sudo bash
```

The installer:
1. Installs Docker (if missing) and clones the code to `/opt/zogency`
2. Asks four questions: **domain**, **agency name**, **admin email**, **admin password**
3. Generates all secrets (session key, credential-encryption key, DB password) into `/opt/zogency/.env.production` (mode 600)
4. Builds and starts the stack: app, PostgreSQL 16, Redis 7, Caddy (automatic HTTPS via Let's Encrypt), nightly DB backup container

First build takes a few minutes. Then open `https://<domain>` and log in with the admin credentials.

## After install (the agency does this themselves)

1. **Settings → License** — paste the Zogency license key. Self-hosted workspaces are **read-only until activated** (doc 02 §11.1); activation is always allowed.
2. **Settings → Integrations** — connect their own Meta, Google, WhatsApp, IVR (Exotel/Knowlarity/Ozonetel/MyOperator), Zoho Sign/Books, email accounts (doc 11 Q4/Q5). Webhook URLs to paste into vendor consoles are shown on each card.
3. **Settings → Users** — add the team, set roles, photos.

## Operations

| Task | Command |
|---|---|
| Update to latest | Re-run the install one-liner (safe — pulls + rebuilds, keeps config/data) |
| Logs | `docker compose -f /opt/zogency/deploy/docker-compose.yml logs -f web` |
| Restart | `docker compose -f /opt/zogency/deploy/docker-compose.yml restart` |
| Stop | `docker compose -f /opt/zogency/deploy/docker-compose.yml down` (data persists in volumes) |
| Backups | Nightly gzip dumps in `/opt/zogency/deploy/backups`, 30-day retention — **copy offsite**; backup ownership is the operator's (doc 02 §11.2) |
| Restore | `gunzip -c backup.sql.gz \| docker compose -f …/docker-compose.yml exec -T postgres psql -U postgres zogency` |

## One-click provisioning from the master server (Vendor console)

On the master server (demo.zogency.com), add to `/opt/zogency/.env.production`:

```
ZOGENCY_VENDOR_MODE=1
ZOGENCY_LICENSE_PRIVATE_KEY=<production private key>
```

and restart. A **Vendor** item appears in the sidebar. For each new client:

1. Client provides: **company name, admin email, domain (A-record already pointed at their server), server IP, root SSH password**
2. Vendor → **New client install** → enter those + plan/seats/days → **Issue license & install**
3. The console issues the license, SSHes in, runs the installer non-interactively (license pre-activated, admin seeded with a one-time setup token), streams the log, and — on success — **deletes the SSH credentials** and shows a **setup link**
4. Share `https://<their-domain>/setup/<token>` with the client — they set their own name + password on first open (single-use link) and log in. Done.

Failures keep the log + a Retry button (re-enter the SSH password if it was already cleared).

## Issuing the license key manually (vendor side — you)

```bash
ZOGENCY_LICENSE_PRIVATE_KEY=<prod-private-key> npx tsx scripts/issue-license.ts \
  --customer "Agency Name" --plan pro --seats 15 --days 365
```

Production keypair: generate once with `npx tsx scripts/issue-license.ts --gen-keys`, set the **public** key as `ZOGENCY_LICENSE_PUBLIC_KEY` in the client's `.env.production` (or bake into the release), and keep the private key offline. The dev keypair in the repo's `.env` is for development only.

## Notes & current limitations

- `REDIS_URL` ships empty — the BullMQ worker transport lands in a later release; background sweeps run opportunistically in-process meanwhile.
- Uploaded photos store in the DB; S3-compatible storage connects via Settings → Integrations when file features ship.
- The stack has not yet been burn-tested on a live VPS — treat the first client install as supervised (watch `logs -f web` during boot).
