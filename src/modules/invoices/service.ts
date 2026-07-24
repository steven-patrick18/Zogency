// Invoicing basics (Sprint 6 — FR-8.1–8.3). Zogency invoices natively;
// accounting sync (FR-8.4, Zoho Books per doc 11 Q3) attaches in Phase 2.
import { Prisma } from '@/generated/prisma/client'
import { audit } from '@/lib/audit'
import { prisma, scoped } from '@/lib/db/prisma'
import { notify } from '@/lib/notify'

const GST_RATE = 18

/** Tenant-scoped sequential number: ZG-<year>-<seq>. */
async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await prisma.invoice.count({
    where: { number: { startsWith: `ZG-${year}-` } },
  })
  return `ZG-${year}-${String(count + 1).padStart(4, '0')}`
}

export async function createInvoice(input: {
  clientId: string
  projectId?: string | null
  dueInDays?: number
  lineItems: Array<{ description: string; qty?: number; rate: number; sowDeliverableId?: string | null }>
}) {
  const subtotal = input.lineItems.reduce((sum, li) => sum + (li.qty ?? 1) * li.rate, 0)
  const gstAmount = (subtotal * GST_RATE) / 100
  const invoice = await prisma.invoice.create({
    data: scoped({
      clientId: input.clientId,
      projectId: input.projectId ?? null,
      number: await nextInvoiceNumber(),
      issueOn: new Date(),
      dueOn: new Date(Date.now() + (input.dueInDays ?? 15) * 86_400_000),
      subtotal: new Prisma.Decimal(subtotal),
      gstRate: new Prisma.Decimal(GST_RATE),
      gstAmount: new Prisma.Decimal(gstAmount),
      total: new Prisma.Decimal(subtotal + gstAmount),
    }),
  })
  for (const li of input.lineItems) {
    await prisma.invoiceLineItem.create({
      data: scoped({
        invoiceId: invoice.id,
        description: li.description,
        sowDeliverableId: li.sowDeliverableId ?? null,
        qty: li.qty ?? 1,
        rate: new Prisma.Decimal(li.rate),
        amount: new Prisma.Decimal((li.qty ?? 1) * li.rate),
      }),
    })
  }
  await audit('invoice.create', 'invoice', invoice.id, null, {
    number: invoice.number, total: invoice.total.toString(), clientId: input.clientId,
  })
  return invoice
}

export async function recordPayment(
  invoiceId: string,
  input: { amount: number; method?: string; reference?: string | null },
): Promise<{ ok: boolean; error?: string; status?: string }> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
  if (!invoice) return { ok: false, error: 'Invoice not found' }
  if (invoice.status === 'paid') return { ok: false, error: 'Invoice is already paid' }
  if (input.amount <= 0) return { ok: false, error: 'Amount must be positive' }

  await prisma.payment.create({
    data: scoped({
      invoiceId,
      amount: new Prisma.Decimal(input.amount),
      method: input.method ?? 'bank_transfer',
      receivedOn: new Date(),
      reference: input.reference ?? null,
    }),
  })
  const payments = await prisma.payment.findMany({ where: { invoiceId } })
  const paidTotal = payments.reduce((s, p) => s + Number(p.amount), 0)
  const status = paidTotal >= Number(invoice.total) ? 'paid' : 'partial'
  await prisma.invoice.update({ where: { id: invoiceId }, data: { status } })
  await audit('invoice.payment', 'invoice', invoiceId, { status: invoice.status }, { status, amount: input.amount })
  return { ok: true, status }
}

/**
 * Overdue sweep (FR-8.2/8.3): pending/partial invoices past due → overdue +
 * reminder logged + owner/Finance notified. Worker cron in production;
 * throttled opportunistic trigger on the invoices page in dev.
 */
export async function runOverdueSweep(): Promise<number> {
  const overdue = await prisma.invoice.findMany({
    where: { status: { in: ['pending', 'partial'] }, dueOn: { lt: new Date() } },
    include: { client: true },
  })
  for (const inv of overdue) {
    await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'overdue' } })
    await prisma.paymentReminder.create({
      data: scoped({ invoiceId: inv.id, templateKey: 'invoice.overdue' }),
    })
    const finance = await prisma.role.findFirst({
      where: { name: 'Finance' },
      include: { userRoles: true },
    })
    const recipients = new Set<string>(finance?.userRoles.map((ur) => ur.userId) ?? [])
    if (inv.client.ownerId) recipients.add(inv.client.ownerId)
    for (const userId of recipients) {
      await notify(userId, 'invoice.overdue', {
        number: inv.number, client: inv.client.name, total: inv.total.toString(),
      })
    }
  }
  return overdue.length
}

let lastSweepAt = 0
export async function maybeRunOverdueSweep(): Promise<void> {
  if (Date.now() - lastSweepAt < 60_000) return
  lastSweepAt = Date.now()
  await runOverdueSweep()
}
