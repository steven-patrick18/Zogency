# Zogency — Documentation Suite

**Zogency** is a multi-tenant, **white-label agency CRM SaaS**: sales pipeline with IVR calling, marketing campaign management, HR, delivery task boards, retention, and invoicing in one system. It is built first for **BRB Digital** (design partner, tenant #1) against their PRD and SOPs, then sold to other agencies — either as **cloud SaaS** or **self-hosted on the client's server, activated by a time-limited license key**.

## Reading order

| Doc | Title | Purpose | Primary reader | Sign-off owner | Status |
|---|---|---|---|---|---|
| [01](01-product-overview.md) | Product & Tenancy Overview | Vision, white-label model, roles, end-to-end flow, module map | Everyone | Product owner | Draft |
| [02](02-technical-architecture.md) | Technical Architecture | Stack, single-app + worker topology, tenancy guard, RBAC, integration ports, **license-key system**, **DigitalOcean server configs**, ADRs | Developers | Tech lead | Draft |
| [03](03-data-model-erd.md) | Data Model & ERD | The schema contract: ~66 entities, immutability classes, ERDs, enum catalog, indexes | Developers | Tech lead | Draft |
| [04](04-spec-sales-chain.md) | Spec — Sales Chain | Modules 1, 2, 5: lead capture → pipeline → IVR → proposals → closing → handover (FR-1.x, 2.x, 5.x) | Developers + BRB Sales | BRB | Draft |
| [05](05-spec-marketing-chain.md) | Spec — Marketing Chain | Module 3: brief → planning → creative → approvals → launch → reporting (FR-3.x) | Developers + BRB Marketing | BRB | Draft |
| [06](06-spec-hr-chain.md) | Spec — HR Chain | Module 4: recruitment → onboarding → attendance → performance (FR-4.x) | Developers + BRB HR | BRB | Draft |
| [07](07-spec-delivery-retention-finance.md) | Spec — Delivery, Retention & Finance | Modules 6, 7, 8: projects/tasks, renewals/health score, invoicing (FR-6.x, 7.x, 8.x) | Developers + BRB | BRB | Draft |
| [08](08-spec-automation-reporting.md) | Spec — Automation & Reporting | Automation engine, notifications, all dashboards (FR-9.x, 10.x) | Developers | Tech lead | Draft |
| [09](09-integrations-and-accounts-checklist.md) | Integrations & Accounts Checklist | Every integration, vendor status, lead times, **week-1 "apply now" list** | Product owner + dev | Product owner | Draft |
| [10](10-sprint-plan.md) | Roadmap & Sprint Plan | Phase 0 → MVP (6 sprints) → Phases 2–4; deltas from the original phase-plan PDF | Everyone | Product owner | Draft |
| [11](11-open-questions-and-risks.md) | Open Questions, Risks & Sign-off | **The decision sheet BRB signs**: blocking vendor choices, PRD gaps, risk register, scope-orphan rulings | BRB (Arvind/Faizal) + product owner | BRB | **Awaiting sign-off** |

## Source-of-truth hierarchy

1. **PRD-CRM-01 v3.0** (`BRB_Digital_CRM_PRD (1).pdf`) — all FR-IDs; what BRB signed.
2. **SOPs** — SOP-SLS-01 (Sales), SOP-MKT-01 (Marketing), SOP-HR-01 (HR): the processes the FRs operationalize; consulted when an FR is ambiguous.
3. **Phase-plan PDF** (`Zogency-Development-Phase-Plan.pdf`) — roadmap input only; superseded where it conflicts (see [doc 10 §1](10-sprint-plan.md): NestJS → single Next.js app, "Agenzo" → Zogency, hosting → DigitalOcean, PDF-only features → doc 11 §4 rulings).
4. **This documentation suite** — resolves conflicts and gaps; specs 04–08 are the build contract. Where implementation diverges, the spec is updated (doc 10 §8).

## Conventions

- **FR-IDs** (`FR-2.7`) refer to the PRD; every FR appears in exactly one spec's traceability matrix.
- **Entity names** (snake_case, e.g. `lead_status_history`) are defined in [doc 03](03-data-model-erd.md) and used identically everywhere.
- **Q/R/O numbers** (`Q7`, `R8`, `O3`) refer to [doc 11](11-open-questions-and-risks.md) questions, risks, and scope-orphan rulings.
- **Phase/sprint labels** (`P1-S4`, `P2`) refer to [doc 10](10-sprint-plan.md).

## Glossary

| Term | Definition |
|---|---|
| Tenant | One agency's isolated workspace on the platform (cloud mode); a self-hosted install is a single-tenant deployment |
| License key | Signed, time-limited key activating a self-hosted install (plan, seats, expiry) — doc 02 §11 |
| Lead / MQL / SQL | Potential customer; Marketing-qualified (from campaigns); Sales-qualified (vetted intent) |
| BANT | Budget, Authority, Need, Timeline — qualification framework (gate per doc 11 Q7) |
| Deal | The opportunity record created at qualification (value, stage incl. Verbal Commit / Won / Lost) — ADR-004 |
| 7 statuses | New, Connected, Follow-up, Meeting Scheduled, Meeting Done, Junk, Won (tenant-editable seed) |
| IVR | Cloud telephony for click-to-call + recording (vendor pending, doc 11 Q1) |
| Brief | Client/stakeholder requirements document opening a marketing campaign |
| SoW | Scope of Work — line-item deliverables attached at handover, mandatory before Won |
| Sign-off | Formal approval (internal via `approval_requests`; client via e-sign or logged written evidence) |
| MRF / ATS / BGV | Manpower Requisition Form; applicant tracking; background verification (SOP-HR-01) |
| DPDP | India's Digital Personal Data Protection Act — recordings/PII posture, doc 11 R8 |
