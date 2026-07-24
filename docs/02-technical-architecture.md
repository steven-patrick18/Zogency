# 02 — Technical Architecture Specification

**Product:** Zogency — multi-tenant, white-label agency CRM SaaS
**Status:** Draft for developer review
**Related docs:** [03-data-model-erd.md](03-data-model-erd.md) (schema contract), [09-integrations-and-accounts-checklist.md](09-integrations-and-accounts-checklist.md), [10-sprint-plan.md](10-sprint-plan.md)

---

## 1. Stack summary

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15+ (App Router) + TypeScript** | One codebase for UI + API; server actions for first-party mutations; route handlers for webhooks/public API; strong AI-codegen fit |
| Styling / UI | **Tailwind CSS + shadcn/ui** | Fast, consistent component library; themeable per tenant (white-label) |
| Database | **PostgreSQL 16** | Proven multi-tenant row-isolation pattern; JSONB for flexible config (automation rules, channel mixes) |
| ORM | **Prisma** | Velocity, migration tooling, `$extends` client extension for the tenant guard (ADR-003) |
| Cache / queues | **Redis 7 + BullMQ** | Job queues (webhook processing, reminders, renewals, report precompute), rate limiting, sessions cache |
| Auth | **Auth.js (NextAuth v5)** with credentials + TOTP 2FA | Session-based; integrates with App Router middleware |
| File storage | **S3-compatible object storage** (AWS S3 Mumbai / Hetzner Object Storage) | Call recordings (≥12-month retention NFR), creative assets, documents; signed URLs |
| PDF generation | Server-side (e.g. `@react-pdf/renderer` or headless Chromium) | Proposals, invoices, campaign reports (white-label) |
| Deploy | **Docker Compose** on **DigitalOcean (Bangalore BLR1)**, GitHub Actions CI/CD | Low cost, Indian latency, automated deploys; same image set works for cloud SaaS and self-hosted client servers (§12) |
| Monitoring | Sentry (errors) + uptime probe + BullMQ dashboard (bull-board) | Small-team observability |

> **Superseded decision:** the original phase-plan PDF proposed Next.js + a separate NestJS backend. That is replaced by a single Next.js app (see ADR-001). It also names the product "Agenzo" — the product is **Zogency** everywhere.

## 2. Application topology

**One repo, one Next.js application, two runtime processes:**

```
zogency/
├── src/
│   ├── app/                  # Next.js App Router (pages, layouts, route handlers)
│   │   ├── (auth)/           # login, 2FA, password reset
│   │   ├── (app)/            # authenticated tenant app (all modules)
│   │   ├── (platform)/       # platform-admin (cross-tenant) surfaces
│   │   └── api/
│   │       ├── webhooks/     # meta, google, ivr, esign, whatsapp — public route handlers
│   │       └── v1/           # future public API (mobile app, Phase 3)
│   ├── modules/              # feature folders — the domain layer (see §5)
│   ├── lib/                  # prisma client + tenant guard, auth, queue, storage, utils
│   └── jobs/
│       ├── worker.ts         # BullMQ worker entrypoint (second process)
│       └── processors/       # one processor per queue
├── prisma/                   # schema.prisma, migrations, seed
├── docker/                   # Dockerfiles, compose files
└── docs/                     # this documentation suite
```

**Runtime processes (Docker Compose services):**

| Service | Runs | Notes |
|---|---|---|
| `web` | `next start` | UI, server actions, webhook route handlers |
| `worker` | `node dist/jobs/worker.js` | BullMQ processors; imports the same `src/modules/*` domain services and Prisma client as `web` — no code duplication |
| `postgres` | PostgreSQL 16 | Volume-backed; nightly `pg_dump` to object storage |
| `redis` | Redis 7 | Queues + cache; AOF persistence |

The rule: **route handlers and server actions stay thin** — they validate input, resolve tenant/user context, and call functions in `src/modules/*`. The worker calls the same functions. Business logic never lives in a route handler or a React component.

## 3. Multi-tenancy enforcement

Tenancy model: **shared database, shared schema, `tenant_id` row isolation** (ADR-002).

### 3.1 Tenant resolution
1. **Subdomain** (`brb.zogency.com`) or custom domain → looked up in `tenants` → tenant context. Phase 1 may run single-tenant on one domain, but the resolution layer exists from day 1.
2. The authenticated session carries `tenant_id`; a user belongs to exactly one tenant (platform admins are separate).
3. Request context (`AsyncLocalStorage`) carries `{ tenantId, userId, roles }` for the duration of every request and every job (jobs carry `tenantId` in their payload and establish the same context).

### 3.2 ORM-level tenant guard
A Prisma client extension wraps every query on tenant-scoped models:
- **Reads:** automatically injects `where: { tenant_id: ctx.tenantId }`.
- **Writes:** automatically sets `tenant_id: ctx.tenantId` on create; rejects updates/deletes whose `where` doesn't resolve within the tenant.
- Models are declared tenant-scoped in one registry list; a unit test asserts every model in `schema.prisma` is either in the registry or on an explicit global allowlist (`tenants`, `permissions`, platform tables). **A model missing from both fails CI.**
- The only escape hatch is an explicit `prismaUnscoped` client used solely in `(platform)/` admin code and migrations — its imports are lint-restricted to those paths.

### 3.3 Defense in depth (optional, recommended before Phase 3)
Postgres Row-Level Security: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` with policy `tenant_id = current_setting('app.current_tenant')::uuid`, set per connection/transaction. Turned on when self-serve signup opens the platform to untrusted tenants.

### 3.4 Scoped uniqueness
All unique constraints are composite with `tenant_id` — e.g. `@@unique([tenantId, phone])` on leads, `@@unique([tenantId, email])` on users.

## 4. Authentication & authorization

### 4.1 AuthN
- Email + password (argon2id) with **TOTP 2FA** (required for Admin/Manager roles, optional for others — tenant-configurable).
- Session cookies (httpOnly, secure, sameSite=lax), 12h rolling expiry; device/session list with remote revoke.
- Login throttling per IP + per account (Redis); password reset via signed one-time token.

### 4.2 RBAC
- `roles` ↔ `permissions` many-to-many; **users hold multiple roles** (`user_roles`) — BRB has 8 people covering ~14 functional hats.
- Permissions are fine-grained keys per module: `leads.view`, `leads.reassign`, `deals.approve_discount`, `hr.view_salaries`, `settings.manage`, etc. Global catalog in code; roles are tenant-scoped rows seeded from system defaults (Admin, Sales Manager, Sales Rep, Marketing Manager, Account Servicing, Creative, HR Manager, Finance, Delivery).
- Enforcement points:
  1. **Middleware** — route-group access (is authenticated, has tenant).
  2. **Server action / route handler guard** — `requirePermission('leads.reassign')` at the top of every mutation.
  3. **UI** — permission-aware components hide unavailable actions (convenience only, never the security boundary).
- **Audit trail NFR:** every mutation passes through a domain-service layer that writes `audit_logs` (actor, entity, before/after diff) in the same transaction.

## 5. Module / folder convention

Each feature folder under `src/modules/` owns its domain end to end:

```
src/modules/leads/
├── actions.ts        # server actions (thin: validate → service)
├── service.ts        # domain logic (used by actions AND job processors)
├── queries.ts        # read models for pages/dashboards
├── schemas.ts        # zod input schemas
├── components/       # module UI (Kanban board, lead drawer, timeline…)
└── jobs.ts           # queue names + payload types this module enqueues
```

Planned modules: `platform` (tenants, settings, branding), `auth`, `users-roles`, `departments`, `leads`, `pipeline`, `calls`, `deals`, `clients`, `handover`, `campaigns`, `creative`, `approvals` (generic workflow), `delivery-tasks`, `hr-recruitment`, `hr-employees`, `hr-attendance`, `hr-performance`, `retention`, `invoicing`, `automation`, `notifications`, `reporting`, `files`, `integrations`.

## 6. Integration architecture

### 6.1 Inbound: webhook intake pattern
Every inbound webhook (Meta Lead Ads, Google Lead Forms, IVR callbacks, e-sign events, WhatsApp inbound) follows the same pipeline:

```
POST /api/webhooks/{source}
  1. Verify signature / token (per provider)
  2. INSERT raw payload into webhook_events (append-only) — status 'received'
  3. Respond 200 immediately (<2s; providers retry on timeout)
  4. Enqueue BullMQ job with webhook_events.id
Worker processor:
  5. Parse + validate payload
  6. Dedupe (external_id unique index; for leads also phone/email per FR-1.4)
  7. Execute domain action (create lead → run assignment → notify)
  8. Mark webhook_events 'processed' (or 'failed' + error, with retry/backoff)
```

Benefits: replayability (reprocess a failed event), auditability, and the <1-minute lead-to-assignment NFR is measured from `webhook_events.received_at` to `lead_assignments.created_at`.

### 6.2 Outbound: vendor-agnostic adapter ports
Vendor selections are still pending for several integrations (see doc 09/11). Domain code depends on **interfaces**, with vendor adapters registered per tenant from `integration_credentials`:

| Port | Methods (illustrative) | Candidate adapters |
|---|---|---|
| `TelephonyPort` | `clickToCall()`, `getRecordingUrl()`, `parseCallEvent()` | Exotel, Knowlarity, Ozonetel, MyOperator, **ManualLog** (fallback) |
| `MessagingPort` | `sendWhatsApp(template, vars)`, `sendSms()` | WhatsApp Cloud API, MSG91 (DLT) |
| `EmailPort` | `send(template, vars)` | Amazon SES, SendGrid, SMTP |
| `ESignPort` | `createEnvelope()`, `parseSignedEvent()` | Zoho Sign, DocuSign, **LoggedApproval** (fallback) |
| `AccountingPort` | `pushInvoice()`, `pullPaymentStatus()` | Zoho Books; Tally (materially harder — see doc 11 Q3) |
| `CalendarPort` | `createEvent()`, `freeBusy()` | Google Calendar |
| `AdsLeadSourcePort` | `verifyWebhook()`, `mapLead()` | Meta Lead Ads, Google Lead Form Extensions, WebsiteForm, CsvImport |

Every port ships with a **manual/fallback adapter** so no sprint is blocked on a vendor decision (PRD risk table: manual call-logging fallback, CSV lead-import fallback).

### 6.3 Credentials
`integration_credentials` rows are per-tenant, config JSON encrypted at rest (AES-256-GCM, key from environment/KMS — never in the DB). Platform admin UI to connect/rotate/disable.

## 7. Files & storage

- All uploads via signed URLs to object storage; `files` table stores metadata + storage key; polymorphic attachment (`entity_type`, `entity_id`).
- **Versioning:** `files.version_of` self-reference chains versions — shared by creative assets (FR-3.9) and delivery task files (FR-6.4).
- **Call recordings:** worker downloads from the telephony provider post-call and stores in a `recordings/` prefix with a ≥12-month lifecycle rule (Call Quality NFR). Access via short-lived signed URLs, permission-gated.
- Bucket region: India (Mumbai) — data-residency posture for DPDP (see doc 11 Q18).

## 8. NFR → mechanism mapping

| PRD NFR (§16) | Mechanism |
|---|---|
| IVR recordings retrievable ≥12 months | Worker persists recordings to object storage; lifecycle ≥12 months; `calls.recording_file_id` |
| Status/comment history immutable | Append-only tables (`lead_status_history`, `comments`, …): no UPDATE/DELETE in domain layer; DB trigger blocks UPDATE/DELETE as backstop; corrections via new row + `supersedes_id` |
| Lead-to-assignment < 1 minute | Webhook 200-fast + queued processing; assignment runs in the same job as lead creation; measured `webhook_events.received_at → lead_assignments.created_at`, alert on p95 > 60s |
| Call-log save < 2 seconds | Synchronous write of the call row; recording fetch deferred to worker |
| Dashboards load < 3 seconds | Precomputed `report_snapshots`/`kpi_snapshots` via scheduled worker jobs; live queries only for small scopes; indexes per doc 03 §7 |
| RBAC across all modules | §4.2 — permission keys enforced at server-action layer |
| Encrypted storage | TLS everywhere; disk encryption on VPS volumes; app-level AES-256-GCM for integration credentials and sensitive HR fields (offer compensation) |
| Audit trail on all changes | `audit_logs` written in-transaction by the domain-service layer |
| Configurability without code | Tenant-scoped config tables with seeded defaults: `lead_statuses`, `departments`, `automation_rules`, `message_templates`, `proposal_templates`, `tenant_settings` — Admin UI for each |
| Scalability (multi-city rollout) | Stateless `web`, horizontal scale behind reverse proxy; queue-based ingestion absorbs bursts; Postgres vertical headroom + read replica path |

## 9. Environments, CI/CD, backups

- **Environments:** `dev` (local Docker Compose), `staging`, `prod` — separate DBs, buckets, Redis; per-env secrets via environment files/secrets manager. Webhook testing on dev via tunnel (cloudflared/ngrok).
- **CI (GitHub Actions):** typecheck → lint → unit tests (incl. the tenant-guard registry test) → integration tests against ephemeral Postgres → build images. Migrations applied automatically on staging, manually gated on prod.
- **Backups:** nightly `pg_dump` to object storage (30-day retention) + weekly restore drill on staging; Redis is rebuildable (queues drained on deploy).
- **Deploys:** GitHub Actions builds/pushes images; compose pull + rolling restart on VPS. Worker drains gracefully (BullMQ `close()`), so in-flight jobs finish.

## 10. Architecture Decision Records

### ADR-001 — Single Next.js app instead of Next.js + NestJS
**Context:** Phase-plan PDF assumed a separate NestJS REST backend. Team is 1–2 devs + AI pair.
**Decision:** One Next.js app; server actions for first-party mutations, route handlers for webhooks; separate worker process shares the domain layer.
**Consequences:** ~1–2 sprints of integration overhead removed (no API-contract coordination, one deploy pipeline, no duplicated DTO/validation). A public REST API (`/api/v1`) is added in Phase 3 for the mobile app, exposing the same `src/modules/*` services — the split remains possible later because domain logic never lives in the framework layer.

### ADR-002 — Shared-schema row isolation (`tenant_id`) over schema-per-tenant
**Context:** White-label SaaS targeting many small agencies.
**Decision:** One schema, `tenant_id` on every tenant-scoped table, ORM-enforced guard, optional RLS hardening.
**Consequences:** Simple migrations and ops at small-team scale; cross-tenant analytics trivial for the platform; discipline required — mitigated by the guard extension + CI registry test + RLS before self-serve signup.

### ADR-003 — Prisma over Drizzle
**Decision:** Prisma for schema-as-source-of-truth migrations, mature `$extends` for the tenant guard, best AI-codegen familiarity. Revisit only if p95 query overhead becomes measurable at scale.

### ADR-004 — Lead + Deal split
**Context:** The PRD's 7 lead statuses (New … Won/Junk) conflate the lead journey with SOP-SLS-01's opportunity stages (Opportunity, Verbal Commit, Closed-Won/Lost); the 7 statuses have no "Lost".
**Decision:** `leads` carries the 7-status journey (tenant-configurable status table). A `deals` record is created at qualification (BANT complete) holding value, forecast, proposal linkage, and stage — including `verbal_commit`, `won`, `lost` (+ reason).
**Consequences:** The PRD's single-timeline UX is preserved (deal events render on the lead timeline); Sales Manager gets a true pipeline/forecast view; post-Meeting-Done losses are representable. Needs product-owner confirmation (doc 11 Q6/Q8).

## 11. Deployment models & license-key system

Zogency sells in **two deployment modes**, both built from the same Docker images:

| Mode | Description | Who runs it |
|---|---|---|
| **Cloud SaaS** (multi-tenant) | Zogency-operated cluster; agencies are tenants on shared infrastructure; subscription billing (Phase 3) | Zogency |
| **Self-hosted** (single-tenant) | The full stack deployed on the **client's own server**; activated by a **time-limited license key** sold to the client | Client (with a Zogency install script) |

### 11.1 License-key design

- A license is a **signed token (Ed25519, PASETO/JWT-style)** issued by Zogency's license service. Claims: `license_id, customer, edition/plan, seats, features[], issued_at, expires_at, grace_days`.
- The private signing key lives only with Zogency; every build embeds the **public key** — self-hosted installs can verify a license **offline**.
- **Verification:** at boot and once daily (worker job). States: `valid` → full function; `expiring` (≤15 days) → admin banner; `grace` (expired, within `grace_days`, default 14) → banner + warnings; `expired` → app becomes **read-only** (data always accessible/exportable — never hold client data hostage; writes disabled except license update).
- **Renewal:** customer pays → Zogency issues a new key → admin pastes it into Settings → License (no redeploy). Optional **online activation ping** (daily, non-blocking) to license.zogency.com for telemetry/revocation; failure to reach it never disables a valid unexpired key (client servers may be firewalled).
- **Feature gating:** plan features carried in license claims; the same flags drive cloud-tenant plans — one entitlement system for both modes.
- **Anti-abuse (pragmatic):** key bound to a `customer` name shown in the UI footer/reports; instance ID reported on activation ping. No hard hardware locking — small-agency market, keep friction low.
- **Build implication (Phase 1):** entitlement check middleware + license settings page + issuer CLI script are small (~a few days) but must exist **before the first self-hosted sale**; the license claims schema is designed now so cloud plans reuse it.

### 11.2 Self-hosted install & update path

- **Install:** single `docker compose up` bundle (web, worker, postgres, redis, caddy for TLS) + interactive install script (domain, admin user, license key, SMTP). Minimum client-server spec in §12.
- **Updates:** versioned images in a registry; `zogency update` script = pull + migrate + rolling restart. Self-hosted customers on a supported-versions policy (latest two minor versions).
- **Backups:** bundled nightly `pg_dump` cron + optional off-server upload; the install doc makes backup ownership explicitly the client's.
- **Support boundary:** integrations (Meta/Google/WhatsApp/IVR) use the **client's own** API accounts/credentials on self-hosted — doc 09's checklist becomes part of the client onboarding runbook.

## 12. Server configuration — DigitalOcean

Region: **Bangalore (BLR1)** for Indian latency. All sizes are current DO Premium AMD (NVMe) droplets; Docker Compose stack from §2.

| Environment | Configuration | ~Cost/mo | Notes |
|---|---|---|---|
| **Dev/Staging** | 1× Basic droplet **2 vCPU / 4 GB / 80 GB NVMe** | ~$24 | Whole stack incl. Postgres+Redis in Compose |
| **Production — launch (BRB + early tenants)** | 1× Premium AMD **4 vCPU / 8 GB / 160 GB NVMe** + **DO Managed PostgreSQL Basic 2 GB** + **Spaces** (object storage, 250 GB) + droplet backups | ~$56 + $30 + $5 + 20% backup ≈ **$100–110** | Managed PG = automated backups/failover path; Spaces for recordings/assets with lifecycle rules |
| **Production — growth (10+ tenants)** | 2× **4 vCPU / 8 GB** droplets (web / worker split) behind a **DO Load Balancer** + Managed PG **4 GB (with standby)** + Managed Redis 1 GB + Spaces | ~$250–300 | Horizontal path; stateless web scales by adding droplets |
| **Self-hosted client server (minimum)** | **2 vCPU / 4 GB / 80 GB** (DO or equivalent) | ~$24 | Fine for a single ≤15-user agency; full Compose stack incl. DB |
| **Self-hosted client server (recommended)** | **4 vCPU / 8 GB / 160 GB NVMe** | ~$48 | Headroom for call recordings + report jobs; the spec we quote clients |

Standard hardening for every droplet: ufw (80/443/22 only), SSH keys only, fail2ban, unattended security updates, Caddy/Nginx TLS termination, DO monitoring alerts (CPU >80%, disk >80%), weekly snapshot.

**Recommendation:** start production on the single 4 vCPU/8 GB droplet + Managed Postgres + Spaces (≈$100/mo); move to the growth tier only when tenant count or queue latency demands it.

## 13. Security posture (summary)

- OWASP baseline: zod validation on every input, CSRF-safe server actions, output encoding, rate limits on auth + webhooks, dependency audit in CI.
- Secrets never committed; per-env secret stores.
- Uploaded files: type/size validation, served via signed URLs from storage (never from app disk).
- Pen test scheduled in Phase 3 (per phase plan) before self-serve tenants.
- DPDP Act considerations for call recordings and candidate/employee PII — policy decisions tracked in doc 11 (Q18).
