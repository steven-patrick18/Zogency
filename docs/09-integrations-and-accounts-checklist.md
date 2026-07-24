# 09 — Integration Spec & API Accounts Checklist

**Purpose:** every external integration Zogency needs, its status, lead time, and which sprint it blocks — plus the **"apply now" action list** for Phase 0. Several approvals take weeks; this is the phase plan's own #1 risk (R1 in [doc 11](11-open-questions-and-risks.md)).
**Related docs:** [02-technical-architecture.md](02-technical-architecture.md) §6 (adapter ports, webhook pattern), [11-open-questions-and-risks.md](11-open-questions-and-risks.md) (vendor decisions Q1–Q3).

---

## 1. Integration inventory

| Integration | Purpose | FR-IDs | Vendor status | Typical lead time | Blocks | Fallback while pending |
|---|---|---|---|---|---|---|
| **Meta Lead Ads API** | Real-time lead ingestion via webhook | FR-1.1 | Chosen (only option) — **app review required** | 2–6 weeks (app review + `leads_retrieval` permission) | P1-S2 | CSV import + website form |
| **Google Ads API** (Lead Form Extensions) | Real-time lead ingestion | FR-1.2 | Chosen — **developer token approval required** | 1–4 weeks (basic access) | P1-S2 | Lead-form webhook alternative: Google lead form webhook delivery (no token needed) — verify; else CSV |
| **IVR / cloud telephony** | Click-to-call, recording, call events | FR-2.1–2.4 | **Pending — Q1** (Exotel / Knowlarity / Ozonetel / MyOperator) | Days (KYC for virtual number) | P1-S4 | Manual call-log form |
| **WhatsApp Cloud API** | Welcome messages, notifications, reminders | FR-1.6, FR-10.1/10.2 | Chosen — **Meta Business verification + per-template approval** | 1–3 weeks verification; 1–3 days per template | P1-S4 | Email + in-app notifications |
| **Email (Amazon SES / SendGrid)** | Transactional email, reports | FR-10.2, FR-3.18 | Recommend **SES** (Mumbai) | Days (domain auth + production access request) | P1-S1 | SMTP via existing mailbox |
| **MSG91 (SMS, DLT)** | SMS notifications (India DLT-compliant) | FR-10.2 (optional channel) | Chosen per phase plan — **DLT registration slow** | 2–4 weeks (DLT entity + template registration) | P2 | WhatsApp/email channels |
| **Google Calendar** | Meeting scheduling, kickoff calls, interview slots | FR-2.21, FR-3.2, FR-4.3 | Chosen | Days (OAuth consent screen; internal use = fast) | P1-S5 | Manual scheduling + reminder notifications |
| **E-signature** | Contracts, client sign-offs | FR-2.17, FR-3.12 | **Pending — Q2** (recommend Zoho Sign) | Days | P1-S5 | Logged written approval + file evidence |
| **Accounting** | Invoice push, payment-status pull | FR-8.4 | **Pending — Q3** (recommend Zoho Books; Tally = major extra scope) | Days (Zoho) / weeks (Tally) | P1-S6 (Zoho) or P2 (Tally) | Invoices native in Zogency; manual reconciliation |
| **Object storage (S3 Mumbai / Hetzner)** | Recordings, assets, documents | NFR Call Quality, FR-3.9, FR-6.4 | Chosen with hosting decision | Same day | P0 | — |
| **Razorpay** | Payment links on invoices | Scope-orphan O4 | **Pending ruling** | ~1 week (KYC) | P1-S6 if in | Bank-transfer details on invoice PDF |
| **Sentry (or similar)** | Error monitoring | — | Recommend | Same day | P0 | — |

Phase-2+ connectors (per phase plan, pending scope-orphan rulings O3): Google Ads/Meta **Marketing** APIs for spend reporting, GA4, Search Console, Google Business Profile. Phase 3: LinkedIn Ads, Microsoft Ads, IndiaMART/JustDial import.

## 2. Per-integration mini-specs

Each integration implements a port from doc 02 §6.2. Credentials live in per-tenant `integration_credentials` (encrypted config), connected via an Admin settings UI.

### 2.1 Meta Lead Ads (`AdsLeadSourcePort`)
- **Auth:** Meta app (business type) + system-user token per tenant; `leads_retrieval`, `pages_manage_ads` permissions; app review required.
- **Flow:** `leadgen` webhook → verify `X-Hub-Signature-256` → store raw `webhook_events` → 200 → worker fetches full lead via Graph API (webhook payload carries only IDs) → map fields (incl. city/industry custom questions) → dedupe → create lead (source `meta`, `is_mql=true`).
- **Field mapping UI:** per-form mapping of Meta form fields → lead fields, per tenant.
- **Failure:** Graph fetch retries ×5 with backoff; event stays `failed` and is replayable; daily reconciliation job pulls last-24h leads to catch missed webhooks.

### 2.2 Google Ads Lead Form (`AdsLeadSourcePort`)
- **Auth/flow:** lead form **webhook delivery** (per-form webhook URL + key) is the primary path — no developer token needed for delivery; the Ads API (developer token + OAuth) is needed for reconciliation pulls and Phase-2 spend reporting. Apply for the token anyway (slow).
- **Mapping/dedupe:** as Meta; source `google`, `is_mql=true`.

### 2.3 Website form / generic intake
- `POST /api/webhooks/website-form` with per-tenant API key; honeypot + rate limit; same dedupe pipeline. Doubles as the Zapier-style generic intake.

### 2.4 CSV import
- Admin upload → column-mapping UI → validation report (dupes flagged, bad rows downloadable) → import as leads or clients. **Doubles as the BRB legacy-data migration tool** (R10).

### 2.5 IVR / telephony (`TelephonyPort`)
- **Click-to-call:** rep clicks → `POST` to provider (rep's phone + lead phone masked via virtual number) → provider bridges the call.
- **Events:** provider webhook (call started/ended) → `webhook_events` → worker finalizes `calls` row (duration, disposition prompt to rep in-app) → recording fetched to object storage (12-month retention) → attached to lead timeline.
- **Manual fallback adapter:** rep logs call outcome/duration by hand; same `calls` row shape (`is_manual_log=true`).
- **Vendor evaluation criteria (Q1):** recording API quality, webhook reliability, per-minute cost, virtual-number KYC speed, SLA.

### 2.6 WhatsApp Cloud API (`MessagingPort`)
- **Auth:** Meta Business verification → WABA → phone number + permanent token per tenant.
- **Outbound (Phase 1):** approved template messages only (welcome, reminders, notifications). Template catalog synced to `message_templates` with approval status; unapproved → automatic fallback channel (email/in-app).
- **Inbound (Phase 2, ruling O2):** webhook → team inbox.
- **Rate/quality:** respect messaging limits; per-tenant sender.

### 2.7 Email (`EmailPort` — SES)
- Domain authentication (SPF/DKIM/DMARC) per tenant sender domain; white-label "from" per `tenant_settings`; bounce/complaint webhook → notification status; production-access request in Phase 0 (starts sandboxed).

### 2.8 Google Calendar (`CalendarPort`)
- OAuth per user (rep/interviewer connects own calendar); create events with Meet links for kickoff calls (FR-2.21), campaign kickoffs (FR-3.2), interviews (FR-4.3); store `calendar_event_ref` on the owning record; token refresh handled centrally.

### 2.9 E-signature (`ESignPort` — Zoho Sign recommended)
- Create envelope from generated PDF (proposal/contract) → signer = client contact → status webhook (`signed`/`declined`) → `webhook_events` → update `contracts`/`client_signoffs`; signed PDF stored in `files`.
- **LoggedApproval fallback adapter:** upload email/written evidence + mark approved (records who logged it).

### 2.10 Accounting (`AccountingPort` — Zoho Books recommended)
- **Direction:** Zogency → push invoices (on issue) + push payment records if entered locally; pull payment status (webhook or 6-hourly poll). The accounting tool remains the books of record; Zogency never computes tax filings.
- Every operation logged to `accounting_sync_log`; conflicts (invoice edited both sides) surface as admin alerts, accounting side wins.
- **If Tally (Q3):** no cloud API — requires Tally Prime local gateway or middleware; becomes a Phase-2 mini-project; Phase 1 falls back to CSV export of invoices.

### 2.11 MSG91 SMS
- DLT entity + header + template registration prerequisite; used only for critical notifications where WhatsApp/email unavailable; sender per tenant (Phase 3 multi-tenant DLT is per-agency — note for SaaS phase).

## 3. Credentials & security

- `integration_credentials`: per-tenant row per provider; config JSON encrypted (AES-256-GCM, env-held key); status (connected/error/disabled); connect/rotate/disconnect via Admin UI; secrets never rendered back after save (masked display).
- Webhook endpoints: per-provider signature verification; per-tenant routing via webhook URL path token where the provider doesn't support custom headers.
- All outbound calls through adapter ports — no provider SDK imports outside `src/modules/integrations`.

## 4. "Apply now" action list — Phase 0, week 1

| # | Action | Owner | Prereqs | Target date |
|---|---|---|---|---|
| A1 | Create Meta App (business) + start **app review** for Lead Ads permissions | Product owner | Meta Business Manager access from BRB | P0 wk 1 |
| A2 | Start **Meta Business verification** (also unlocks WhatsApp) | BRB (docs: GST, incorporation) | Business documents | P0 wk 1 |
| A3 | Apply for **Google Ads developer token** (basic access) | Product owner | Google Ads MCC account | P0 wk 1 |
| A4 | Set up **WhatsApp Cloud API** WABA + submit first message templates (welcome, follow-up, meeting reminder, invoice reminder) | Dev | A2 complete | P0 wk 2 |
| A5 | Register **MSG91 DLT** entity + templates | BRB | GST + entity docs | P0 wk 1 (slowest) |
| A6 | Open **IVR trial accounts** (Exotel + MyOperator) for Q1 evaluation | Dev | KYC docs | P0 wk 1 |
| A7 | **SES production access** request + domain auth for BRB sender domain | Dev | DNS access | P0 wk 2 |
| A8 | **Zoho Sign / Zoho Books** trial org (pending Q2/Q3) | Dev | — | P0 wk 2 |
| A9 | Object storage bucket (Mumbai) + lifecycle rules | Dev | Hosting account | P0 wk 1 |
| A10 | Google Cloud project + OAuth consent screen (Calendar) | Dev | — | P0 wk 2 |

Track each item's status in the project board; a red item here is a red flag for the sprint it blocks (§1 table).
