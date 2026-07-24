# Zogency

**All-in-one, white-label agency CRM** — sales pipeline with IVR calling, marketing campaign management, HR, delivery task boards, retention, and invoicing in one system.

- **Stage 1:** built for **BRB Digital** (design partner / tenant #1) against their PRD and SOPs.
- **Stage 2:** sold white-label to other agencies as **cloud SaaS** or **self-hosted on the client's server with a time-limited license key**.

## Documentation

The complete planning suite lives in [`docs/`](docs/) — start with [`docs/00-index.md`](docs/00-index.md).

| Doc | Contents |
|---|---|
| [00-index](docs/00-index.md) | Reading guide, conventions, glossary |
| [01-product-overview](docs/01-product-overview.md) | Vision, white-label & licensing model, roles, module map |
| [02-technical-architecture](docs/02-technical-architecture.md) | Next.js single-app + worker, multi-tenancy, license-key system, DigitalOcean sizing, ADRs |
| [03-data-model-erd](docs/03-data-model-erd.md) | Schema contract — ~66 entities, ERDs, immutability rules |
| [04–08](docs/04-spec-sales-chain.md) | Functional specs: Sales, Marketing, HR, Delivery/Retention/Finance, Automation/Reporting |
| [09-integrations](docs/09-integrations-and-accounts-checklist.md) | Integration specs + week-1 API application checklist |
| [10-sprint-plan](docs/10-sprint-plan.md) | Phase 0 → MVP (6 sprints) → SaaS launch |
| [11-open-questions](docs/11-open-questions-and-risks.md) | Decision & sign-off sheet, risk register |

Source documents (PRD + SOPs) are the PDF files in the repository root.

## Stack (planned)

Next.js (App Router, TypeScript) · PostgreSQL + Prisma (`tenant_id` row isolation) · Redis + BullMQ · Tailwind + shadcn/ui · Docker on DigitalOcean (BLR1)

## Status

📋 **Planning phase** — documentation complete, awaiting BRB sign-off on [doc 11](docs/11-open-questions-and-risks.md) before Phase 0 build starts.
