# 10 — Roadmap & Sprint Plan

**Purpose:** the executable build plan — replaces the original phase-plan PDF's sprint grid, restructured for the single-Next.js-app stack (ADR-001) and reconciled with the PRD's own 5-phase release plan (PRD §21).
**Related docs:** [02-technical-architecture.md](02-technical-architecture.md), [03-data-model-erd.md](03-data-model-erd.md), specs 04–08, [09-integrations-and-accounts-checklist.md](09-integrations-and-accounts-checklist.md), [11-open-questions-and-risks.md](11-open-questions-and-risks.md).

---

## 1. Deltas from the original phase-plan PDF

| PDF assumption | Now | Why |
|---|---|---|
| Next.js + separate NestJS backend | **Single Next.js app + worker process** | ADR-001 — removes API-contract coordination, duplicate DTO/validation, second deploy pipeline; recovers ~1–2 sprints |
| Product name "Agenzo" / agenzo.com | **Zogency** | User decision; R11 (check domain/trademark before Phase 4) |
| Hetzner/AWS hosting | **DigitalOcean BLR1** (doc 02 §12) | User decision; sizing table in doc 02 |
| Cloud SaaS only | **Cloud SaaS + self-hosted license-key mode** (doc 02 §11) | User decision — keys sold to clients, time-limited, hosted on client servers; adds the license work item to S1/S6 |
| PDF-only features inside MVP (privacy vault, WhatsApp inbox, ads spend reports, Razorpay, screen-time tracker, content calendar, internal chat) | **Pulled out of MVP** → scope-orphan rulings O1–O10 in doc 11 | MVP tracks the PRD's own Phase 1+2 scope, which is what BRB signed |
| IVR in sprint 6–7 | IVR in **S4** (mid-MVP) | PRD makes IVR Phase-1-core; sequenced after the vendor decision (Q1, due end of S2) |

**Feature reconciliation:** every PDF feature is either (a) in the sprint tables below with an FR-ID, or (b) on the doc 11 §4 orphan list awaiting a ruling. Nothing silently dropped.

## 2. Phase 0 — Foundation (2–3 weeks)

| Work item | Detail | Exit artifact |
|---|---|---|
| Docs sign-off | This documentation suite reviewed; **doc 11 §1 blocking decisions answered**; BRB workshop (roster/roles/territories Q5, discount matrix Q10, baselines Q16, legacy-data survey R10) | Signed doc 11 |
| API applications | Doc 09 §4 "apply now" list A1–A10 — week 1 | All applications submitted |
| Repo & skeleton | GitHub repo (`steven-patrick18/Zogency`), Next.js + TS + Tailwind + Prisma scaffold, Docker Compose (web/worker/postgres/redis), CI pipeline (typecheck/lint/test/build) | Green CI |
| Schema v1 | Migration 1 from doc 03 §8 (platform tables) + seed (roles, permissions, BRB tenant) | Migration applied |
| Tenancy + auth | Tenant guard extension + CI registry test (doc 02 §3); Auth.js credentials + TOTP 2FA; session management | Login works, guard test green |
| Staging deploy | DO staging droplet (doc 02 §12), GitHub Actions deploy, Sentry | **M0: logged-in empty app skeleton on staging** |

## 3. Phase 1 — MVP for BRB (10–12 weeks, 6 × 2-week sprints)

| Sprint | Goal | Scope (FR-IDs) | Spec | Key dependency |
|---|---|---|---|---|
| **S1 — Platform core** | The shell everything hangs on | Users/roles/multi-role RBAC UI, departments, tenant settings + branding, audit log framework, notification framework (in-app + email), message templates, **license/entitlement middleware + license settings page + issuer script** (doc 02 §11) | 02, 08 | SES sandbox OK |
| **S2 — Leads** | Leads flowing in and assigned | FR-1.1–1.7: manual entry, **CSV import** (doubles as BRB migration tool), website-form endpoint, Meta + Google webhook intake, dedupe, assignment rules + engine, SLA timers, assignee notification | 04 §2–3, 09 | Meta/Google approvals (fallback: CSV + website form live first); Q5 roster data |
| **S3 — Pipeline** | The 7-status board BRB works in daily | FR-2.6–2.10: Kanban board, mandatory-comment status modal, append-only timeline (status + comments + calls interleaved), BANT gate, lead detail page, lead search/filters | 04 §4 | — |
| **S4 — Calling + automation v1** | Calls recorded against leads; first automations | FR-2.1–2.5: click-to-call via TelephonyPort, call events webhook, recordings to Spaces, dispositions, manual-log fallback, SLA escalation; automation engine core + seeded rules (welcome WhatsApp/email, follow-up, meeting reminders) FR-10.1/10.2/10.4 subset | 04 §5, 08 §2–3 | **Q1 IVR vendor (decide end of S2)**; WhatsApp templates approved (fallback email) |
| **S5 — Deal room** | Qualification through signature | FR-2.11–2.18: deals (ADR-004), discovery notes, proposal templates + versions + PDF, discount approval routing (approval_requests), verbal commit, e-sign via ESignPort + logged fallback, Closed-Won capture | 04 §6–7 | Q2 e-sign vendor; Q10 discount matrix values |
| **S6 — Handover chain + hardening** | Won → delivery, invoicing; go-live | FR-2.19–2.21, FR-5.1–5.5: SoW line items (mandatory-before-Won), client auto-create, onboarding checklists, kickoff scheduling; FR-6.1–6.3 basic projects + task boards; FR-8.1–8.3 invoices + payments + overdue reminders; FR-9.1 basic sales dashboard; QA pass, load test, **BRB data import**, training, **self-hosted install bundle v1** (doc 02 §11.2) | 04 §7, 07, 08 §5 | Q3 accounting tool (Zoho Books sync in S6 if chosen; else CSV export); R10 import mapping |

**M1 (Go-Live):** BRB running leads, calls, pipeline, proposals, handover, and invoicing on Zogency daily. Collect 2–4 weeks of real feedback before Phase 2 starts.

## 4. Phase 2 — Full agency operations (8–10 weeks)

Epic-level; sequence adjustable on BRB feedback:

| Epic | Scope | Spec |
|---|---|---|
| Marketing chain end-to-end | FR-3.1–3.20 (brief → planning → creative → approvals → launch → monitoring → reporting/closure) | 05 |
| Delivery completion | FR-6.4–6.7: file version chains, task dependencies, recurring retainer tasks, deliverable status view, capacity view | 07 |
| HR module | FR-4.1–4.13 (recruitment → onboarding → attendance/leave → performance) + payroll export (Q14) | 06 |
| Retention | FR-7.1–7.6: check-ins, renewals + 60/30/15 triggers, health score (Q9), churn flags, upsell tracker, weekly review view | 07 §5 |
| Reporting suite | FR-9.2–9.6 dashboards + report_snapshots + white-label PDF + exec dashboard | 08 §5–7 |
| Automation admin UI | Rule builder for Admin (FR-10.1 configurability) | 08 §2 |
| Orphan features ruled "in, P2" | Per doc 11 §4 rulings (likely: privacy vault O1, WhatsApp inbox O2, ads spend reporting O3, content calendar O7) | mini-specs to write |

**M2:** BRB fully operating on Zogency — demo-ready for other agencies.

## 5. Phase 3 — SaaS + self-hosted scale (8–10 weeks)

- Self-serve SaaS layer: agency signup, plan management, subscription billing (Razorpay), usage limits, tenant onboarding wizard; Postgres RLS hardening (doc 02 §3.3)
- **License operations:** issuance portal (replace CLI), renewal reminders, revocation list on activation pings
- Client portal (branded login, live reports, creative approvals, tickets, invoice payment) — resolves Q13's Phase-1 deferral
- Mobile app (React Native) on `/api/v1` (ADR-001's split path)
- Payroll & exit deepening (if ruled in), meetings module (O9), more connectors (LinkedIn/Microsoft Ads, IndiaMART/JustDial)
- Security review / penetration test before opening self-serve signup

**M3:** an agency can sign up (cloud) or buy a key and self-host without Zogency touching their server.

## 6. Phase 4 — Launch (ongoing)

Marketing site (zogency.com — R11 domain check), pricing (INR tiers per-user/per-agency + self-hosted key pricing), BRB case study, help docs + support system, AI features (lead-reply suggestions, report insights, WhatsApp AI assistant — Claude API), funnel builder + social scheduler (O10). **Target: 10 paying agencies in 6 months.**

## 7. Critical path & dependency notes

1. **Week-1 API applications** (doc 09 §4) — Meta app review and DLT are the longest poles; S2/S4 have fallbacks but real webhook ingestion needs them.
2. **Q1 IVR decision by end of S2** — S4 slips otherwise (manual logging keeps S4 shippable but degrades the demo).
3. **Q5 BRB roster/territory data before S2** — assignment rules need real values.
4. **Q10 discount matrix before S5**; **Q3 accounting choice before S6**.
5. **License claims schema fixed in S1** — cloud plans and self-hosted keys share it; changing it later touches entitlement checks everywhere.
6. Timeline assumes 1–2 devs + AI pair; apply the phase plan's ±25% (R9).

## 8. Definition of Done (every sprint)

- All FR acceptance criteria in the owning spec pass (manual QA checklist + automated tests).
- Unit tests for domain services; integration tests for webhooks/jobs; tenant-guard registry test green.
- Audit logging verified on every new mutation; append-only tables have trigger backstops.
- Migrations reversible on staging; seed updated.
- Deployed to staging; demoed to BRB; feedback logged as next-sprint candidates (never current-sprint additions — R4).
- Docs 04–08 updated where behavior diverged from spec (spec is source of truth).

## 9. Milestone / sign-off gates

| Gate | Criteria | Sign-off |
|---|---|---|
| M0 (end P0) | Doc 11 §1 answered; skeleton on staging; applications submitted | BRB + product owner |
| M1 (end P1) | BRB daily-active on sales chain; import complete; training done | BRB (Arvind/Faizal) |
| M2 (end P2) | All 9 PRD modules live for BRB | BRB |
| M3 (end P3) | Self-serve signup + self-hosted install proven with a pilot | Product owner |
| M4 (P4) | Public launch | Product owner |
