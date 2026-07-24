import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { maybeRunOverdueSweep } from '@/modules/invoices/service'
import { PaymentForm } from './payment-form'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  partial: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
}

export default async function InvoicesPage() {
  const session = await requirePermission('invoices.view')
  const invoices = await withTenant(async () => {
    await maybeRunOverdueSweep()
    return prisma.invoice.findMany({
      include: { client: true, payments: true },
      orderBy: { createdAt: 'desc' },
    })
  })
  const canManage = session.user.permissions.includes('invoices.manage')

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
    </div>
  )
}
