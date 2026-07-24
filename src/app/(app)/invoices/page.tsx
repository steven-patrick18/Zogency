import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { maybeRunOverdueSweep } from '@/modules/invoices/service'
import { toggleRetainerAction } from '@/modules/retainer/actions'
import { maybeRunRetainerSweep } from '@/modules/retainer/service'
import { PaymentForm } from './payment-form'
import { RetainerForm } from './retainer-form'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  partial: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
}

export default async function InvoicesPage() {
  const session = await requirePermission('invoices.view')
  const { invoices, schedules, clients } = await withTenant(async () => {
    await maybeRunOverdueSweep()
    await maybeRunRetainerSweep()
    const [invoices, schedules, clients] = await Promise.all([
      prisma.invoice.findMany({
        include: { client: true, payments: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.retainerSchedule.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.client.findMany({ select: { id: true, name: true } }),
    ])
    return { invoices, schedules, clients }
  })
  const canManage = session.user.permissions.includes('invoices.manage')
  const clientName = new Map(clients.map((c) => [c.id, c.name]))
  const retainers = schedules.map((s) => ({
    id: s.id,
    client: clientName.get(s.clientId) ?? 'Unknown client',
    description: s.description,
    amount: Number(s.amount),
    billingDay: s.billingDay,
    nextInvoiceOn: s.nextInvoiceOn.toISOString().slice(0, 10),
    active: s.active,
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
      <p className="mt-1 text-sm text-slate-500">
        Draft invoices are raised automatically on handover (FR-2.19); overdue reminders run daily (FR-8.3).
      </p>
      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Issued</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Total (incl. GST)</th>
              <th className="px-4 py-3">Paid</th>
              <th className="px-4 py-3">Status</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No invoices yet.</td></tr>
            )}
            {invoices.map((inv) => {
              const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0)
              return (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{inv.number}</td>
                  <td className="px-4 py-3 text-slate-600">{inv.client.name}</td>
                  <td className="px-4 py-3 text-slate-600">{inv.issueOn.toDateString()}</td>
                  <td className="px-4 py-3 text-slate-600">{inv.dueOn.toDateString()}</td>
                  <td className="px-4 py-3 text-slate-900">₹{Number(inv.total).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-slate-600">₹{paid.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[inv.status]}`}>
                      {inv.status}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      {inv.status !== 'paid' && <PaymentForm invoiceId={inv.id} />}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-10 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Retainer schedules</h2>
          <p className="mt-1 text-sm text-slate-500">
            Active retainers auto-generate a monthly invoice on their billing day.
          </p>
        </div>
        {canManage && <RetainerForm clients={clients.map((c) => ({ id: c.id, name: c.name }))} />}
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Billing day</th>
              <th className="px-4 py-3">Next invoice</th>
              <th className="px-4 py-3">Status</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {retainers.length === 0 && (
              <tr>
                <td colSpan={canManage ? 7 : 6} className="px-4 py-10 text-center text-slate-400">
                  No retainer schedules yet.
                </td>
              </tr>
            )}
            {retainers.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{r.client}</td>
                <td className="px-4 py-3 text-slate-600">{r.description}</td>
                <td className="px-4 py-3 text-slate-900">₹{r.amount.toLocaleString('en-IN')}</td>
                <td className="px-4 py-3 text-slate-600">{r.billingDay}</td>
                <td className="px-4 py-3 text-slate-600">{r.nextInvoiceOn}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {r.active ? 'active' : 'paused'}
                  </span>
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <form action={toggleRetainerAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="text-xs font-medium text-indigo-600 hover:underline">
                        {r.active ? 'Pause' : 'Resume'}
                      </button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
