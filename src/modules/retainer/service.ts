// Retainer auto-invoicing (Phase 2 / Reporting-v2 billing). Generates a monthly
// invoice per active retainer schedule when the billing date arrives. Worker
// cron in production; throttled opportunistic sweep on the invoices page in dev.
import { Prisma } from '@/generated/prisma/client'
import { audit } from '@/lib/audit'
import { prisma, scoped } from '@/lib/db/prisma'
import { createInvoice } from '@/modules/invoices/service'

function nextMonth(day: number, from: Date): Date {
  const d = new Date(from)
  d.setMonth(d.getMonth() + 1)
  d.setDate(Math.min(day, 28))
  return d
}

export async function runRetainerSweep(): Promise<number> {
  const due = await prisma.retainerSchedule.findMany({
    where: { active: true, nextInvoiceOn: { lte: new Date() } },
  })
  let generated = 0
  for (const r of due) {
    const invoice = await createInvoice({
      clientId: r.clientId,
      projectId: r.projectId,
      lineItems: [{ description: `${r.description} (monthly retainer)`, rate: Number(r.amount) }],
    })
    await prisma.retainerSchedule.update({
      where: { id: r.id },
      data: { nextInvoiceOn: nextMonth(r.billingDay, r.nextInvoiceOn) },
    })
    await audit('retainer.invoiced', 'client', r.clientId, null, { invoice: invoice.number, amount: r.amount.toString() })
    generated++
  }
  return generated
}

let lastSweep = 0
export async function maybeRunRetainerSweep(): Promise<void> {
  if (Date.now() - lastSweep < 60_000) return
  lastSweep = Date.now()
  await runRetainerSweep()
}

export async function addRetainerSchedule(input: {
  clientId: string
  projectId?: string | null
  description: string
  amount: number
  billingDay: number
}) {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), Math.min(input.billingDay, 28))
  if (first < now) first.setMonth(first.getMonth() + 1)
  const schedule = await prisma.retainerSchedule.create({
    data: scoped({
      clientId: input.clientId,
      projectId: input.projectId ?? null,
      description: input.description,
      amount: new Prisma.Decimal(input.amount),
      billingDay: input.billingDay,
      nextInvoiceOn: first,
    }),
  })
  await audit('retainer.scheduled', 'client', input.clientId, null, { amount: input.amount, billingDay: input.billingDay })
  return schedule
}
