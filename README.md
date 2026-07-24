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

🚀 **Phase 1 MVP (M1) complete** — full sales chain live: lead ingestion (Meta/Google/website/CSV) → 7-status pipeline with BANT gate → calls + SLA escalation → deal room (versioned proposals, discount approvals) → SoW-gated Closed-Won → auto handover (client, checklist, project, tasks, GST invoice) → payments + dashboard.

🔨 **Phase 2 in progress** — marketing campaign chain (brief → sign-off → planning → creative → client approvals → launch → KPIs → closure). Still pending: [doc 11](docs/11-open-questions-and-risks.md) vendor decisions (IVR, e-sign, accounting) and BRB sign-off.

**Dev quickstart:** PostgreSQL 15 + Node 20+; `cp .env.example .env`, `npm install`, `npx prisma migrate dev`, `npx tsx prisma/seed.ts`, `npm run dev` → login `admin@brb.digital` / `Admin@123`.

**Self-hosted install (client servers):** one command on a fresh Ubuntu VPS — see [docs/12-self-hosted-install.md](docs/12-self-hosted-install.md):

```bash
curl -fsSL https://raw.githubusercontent.com/steven-patrick18/Zogency/main/deploy/install.sh | sudo bash
```
