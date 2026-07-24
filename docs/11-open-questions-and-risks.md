# 11 — Open Questions, Risks & Sign-off Sheet

**Purpose:** the decision document for BRB Digital sign-off (Mr Arvind Mehta / Mr Faizal Ansari) and the product owner (Steven). Consolidates the PRD's §23 open questions plus everything surfaced while producing this documentation suite. Each answer feeds directly into the specs (docs 02–10).

**How to use:** answer §1 before Phase 0 ends (blocking). §2 items are needed before the sprint noted. §4 items need a simple in/out ruling. Sign the block in §5.

---

## 1. Blocking decisions — required before/during Phase 0

| # | Question | Options / recommendation | Feeds into | Deadline |
|---|---|---|---|---|
| Q1 | **IVR / telephony vendor?** (PRD §23) | Exotel / Knowlarity / Ozonetel / MyOperator. Recommend trialing **Exotel + MyOperator** in Phase 0 (both have quick sandboxes); pick by call quality, recording API, and per-minute cost. Manual call-log fallback ships regardless. | Doc 04 §4, doc 09 | End of Sprint 2 (blocks S4) |
| Q2 | **E-signature vendor?** | Zoho Sign (cheaper, India-friendly, pairs with Zoho Books) vs DocuSign (client familiarity). Recommend **Zoho Sign**. Logged-written-approval fallback ships regardless. | Doc 04 §6, doc 05 §4 | Before Sprint 5 |
| Q3 | **Accounting tool: Zoho Books or Tally?** | **Not equivalent in effort.** Zoho Books has a clean REST API — days of work. Tally has no native cloud API (requires Tally Prime gateway/ODBC or a middleman like Zoho Flow) — weeks of work. Recommend **Zoho Books**; if BRB is committed to Tally, invoicing sync moves to Phase 2 and gets its own mini-project. | Doc 07 §4, doc 09 | Before Sprint 6 |
| Q4 | **API applications — start now.** Not a question but a Phase-0 action list: Meta app review (Lead Ads), Google Ads developer token, Meta Business verification + WhatsApp Cloud API + template approvals, MSG91 DLT registration (slow in India), IVR trial accounts. Owner + date per item in doc 09 §4. | — | Doc 09 | Week 1 of Phase 0 |
| Q5 | **BRB team roster & role mapping.** Need the actual 8 names → departments → system roles (multiple roles per person supported), plus territory/product-line/account-size rules and thresholds for auto-assignment (FR-1.5). | Collect in a 1-hour workshop with BRB. | Doc 04 §2, seed script | Before Sprint 2 |

## 2. Design gaps in the PRD — resolved in specs, confirm at sign-off

| # | Gap | Proposed resolution (in specs) | Confirm |
|---|---|---|---|
| Q6 | **No "Lost" status.** The 7 lead statuses end at Won/Junk; SOP-SLS-01 has Closed-Lost. Where does a deal that dies after Meeting Done go? | Keep the 7 lead statuses intact; record losses as `deals.stage = lost` with a mandatory reason (ADR-004, doc 02 §10). Lost deals appear in pipeline reports; the lead itself may be set to Junk or remain for re-nurture. | ☐ |
| Q7 | **BANT gate wording ambiguous.** FR-2.10 says BANT applies "before a lead can move to Connected → Followup". | Gate pinned to the **Connected → Follow-up** transition: BANT fields must be complete before a lead can leave Connected for any forward status (Follow-up or Meeting Scheduled). Junk is always allowed. See doc 04 §3.4. | ☐ |
| Q8 | **Lead vs opportunity model.** PRD conflates lead statuses with SOP opportunity stages (Verbal Commit has no lead status). | Lead + Deal split per ADR-004: deal created at qualification, holds value/stage/Verbal Commit/Won/Lost; deal events render on the lead's single timeline so the PRD's UX is preserved. | ☐ |
| Q9 | **Client health-score formula undefined.** FR-7.3 names inputs (payment delays, approval turnaround, surveys) but no weights. | Default formula proposed in doc 07 §3.3 (40% payments / 30% approval turnaround / 30% survey, banded Green ≥70, Amber 40–69, Red <40). Tenant-configurable weights. | ☐ |
| Q10 | **Discount authority limits undefined.** FR-2.13 routes "beyond standard limits" for approval, but the SOP's referenced "Discount & Approval Matrix" document was not provided. | Model as tenant config: per-service-line standard price band + max rep discount %; anything beyond routes to Sales Manager. **Need BRB's actual matrix values.** | ☐ |
| Q11 | **Revision-round limit** (PRD §23): fixed agency-wide or per client? | Per-client-contract field with a tenant default (seeded: 2 rounds), per doc 05 §4. | ☐ |
| Q12 | **Department list for task boards** (PRD §23). | Seeded: SEO, Design, Social, Video, Content, Web, Performance — stored as a tenant-configurable table, so changes are settings, not code. Confirm the seed list. | ☐ |
| Q13 | **Client portal timing** (PRD §23): needed for Phase-1 campaign approvals? | Recommend **no portal in Phase 1** — client sign-offs captured via e-sign or logged written approval (email evidence attached). Portal lands in Phase 3 with the SaaS layer. | ☐ |
| Q14 | **Payroll boundary** (PRD §23): which external payroll tool, and what export? | HR module exports attendance/leave as CSV (or API if the tool has one) per pay period; payroll calculation stays external in Phases 1–2. **Name the payroll tool.** Payroll calc engine is a Phase-3 candidate (phase plan lists it). | ☐ |
| Q15 | **BGV & pre-boarding gap.** SOP-HR-01 steps 17–19 (background verification, joining-document collection, IT resource setup) are absent from the PRD's HR FRs. | Included as onboarding-checklist item types (cheap to add) — BGV as a tracked checklist item with vendor/report attachment, not an integration. Confirm in scope for Phase 2. | ☐ |
| Q16 | **Success-metric baselines missing.** PRD §22 targets (e.g. "90% of leads contacted within SLA") have no current-state numbers. | Capture BRB's pre-CRM baselines (response time, conversion rate, on-time delivery) during Phase-0 workshops; instrument the metrics from day 1 (doc 08 §6). | ☐ |

## 3. Risk register

Extends PRD §20 with platform-level risks.

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | Meta/Google/WhatsApp/DLT approvals take weeks and slip sprints | High | High | Apply week 1 of Phase 0 (Q4); Sprint 2 starts with CSV + website-form ingestion, webhooks attach when approved | Product owner |
| R2 | IVR vendor quality/downtime | Med | High | SLA-backed vendor (Q1); adapter port + manual call-log fallback always available (doc 02 §6.2) | Tech lead |
| R3 | Team resistance to logging (PRD §20) | Med | High | Data entry only via workflow-gated mandatory fields (status-change comment modal), never standalone forms; WhatsApp/in-app nudges | BRB (Faizal) |
| R4 | Scope creep across 4 module chains (PRD §20) | High | Med | Strict phased release (doc 10); new requests → next phase, never current sprint (phase-plan rule); scope-orphan list (§4 below) forces explicit rulings | Product owner |
| R5 | Incomplete SoW at handoff (PRD §20) | Med | High | `sow_deliverables` line items are mandatory before a deal can be marked Won (hard validation, doc 04 §7) | System-enforced |
| R6 | Meta/Google API changes (PRD §20) | Low | Med | Raw `webhook_events` capture + replay; CSV import fallback; version pinning + monitoring | Tech lead |
| R7 | **Multi-tenancy absent from the PRD** — BRB signs a single-tenant-looking document while the platform is multi-tenant | — | Med | This doc discloses it; BRB data lives cleanly on tenant #1 from day 1 (no retrofit); tenancy adds platform work owned by the sprint plan, not billed as BRB features | Product owner |
| R8 | **DPDP Act compliance** — 12-month retention of recorded calls with Indian consumers; candidate/employee PII | Med | High | Call-recording consent notice on IVR flow; India-region storage; documented retention/deletion policy; encrypted sensitive HR fields; DPDP policy doc before go-live | Product owner + BRB |
| R9 | 1–2 dev team = single point of failure; timeline ±25% (phase-plan note) | Med | Med | AI-assisted development loop; docs-first approach (this suite) makes handover/AI-resumption cheap; buffer in doc 10 timeline | Product owner |
| R10 | BRB legacy data import (leads/clients live in sheets?) underestimated | Med | Med | Import-mapping discovery workshop before Sprint 6; CSV importer built in Sprint 2 doubles as migration tool | BRB + dev |
| R11 | Naming/trademark — phase plan says "Agenzo", product is **Zogency**; domain/trademark unchecked | Low | Med | All new artifacts say Zogency; check domain + trademark before Phase 4 public launch | Product owner |
| R12 | WhatsApp template rejections delay automation messages | Med | Low | Submit templates early (Phase 0/S1); email/in-app fallback channel per notification | Dev |
| R13 | **Self-hosted mode support burden** — license-key installs on client servers (doc 02 §11) mean client-side upgrades, backups, and integration credentials are outside Zogency's control | Med | Med | Scripted install/update bundle; supported-versions policy; backup ownership stated in contract; license grace period keeps expired installs read-only, never data-locked | Product owner |

## 4. Scope-orphan features — need an in/out ruling

These appear in the phase-plan PDF but have **no FR-ID in the PRD**. Each needs an explicit decision; if "in", it gets an FR-ID and a phase assignment.

| # | Feature (from phase-plan PDF) | Recommendation | Ruling |
|---|---|---|---|
| O1 | Privacy vault / phone-number masking + unlock audit + export blocking | Valuable for a telecalling agency (reps can't steal leads). Recommend **in, Phase 2** — needs its own mini-spec | ☐ In / ☐ Out |
| O2 | WhatsApp team inbox (two-way conversations) | Recommend **in, Phase 2** — Phase 1 ships outbound template messages only | ☐ In / ☐ Out |
| O3 | Ads spend reporting (Google/Meta daily sync, per-client spend dashboards, white-label PDF) | Recommend **in, Phase 2** — distinct from lead capture; needs Marketing API scopes | ☐ In / ☐ Out |
| O4 | Razorpay payment links on invoices | Recommend **in, Phase 1 S6** if Zoho Books chosen (trivial), else Phase 2 | ☐ In / ☐ Out |
| O5 | GST invoice engine detail (HSN/SAC codes, e-invoice) | Basic GST fields are in the schema; full e-invoicing **out** until Phase 3 | ☐ In / ☐ Out |
| O6 | Screen-time desktop tracker (Tauri) + productivity dashboards | **Phase 2 at earliest**; requires signed employee consent + HR policy doc first (phase-plan risk) | ☐ In / ☐ Out |
| O7 | Content calendar + email campaign builder | Recommend **Phase 2** (phase plan already places it there) | ☐ In / ☐ Out |
| O8 | Internal chat + @mentions | Recommend **out** (comments + notifications cover it); revisit post-launch | ☐ In / ☐ Out |
| O9 | Meetings module (recording upload, AI transcription/summary) | Phase 3 per phase plan | ☐ In / ☐ Out |
| O10 | Funnel builder + social scheduler (GoHighLevel parity) | Phase 4 per phase plan | ☐ In / ☐ Out |

## 5. Sign-off

| Role | Name | Decision | Date | Signature |
|---|---|---|---|---|
| BRB Digital — Approver | Mr Arvind Mehta | ☐ Approved ☐ Approved with notes | | |
| BRB Digital — Owner | Mr Faizal Ansari | ☐ Approved ☐ Approved with notes | | |
| Product Owner — Zogency | Steven Patrick | ☐ Approved | | |

**Version:** 1.0 draft · Supersedes: PRD §23 open questions (all carried into this sheet)
