import { redirect } from 'next/navigation'
import { prismaUnscoped } from '@/lib/db/prisma'
import { getPortalSession } from '@/lib/portal-session'

const STATUS_CHIP: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-700',
  partial: 'bg-sky-100 text-sky-700',
  pending: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
}

export default async function PortalInvoicesPage() {
  const session = await getPortalSession()
  if (!session) redirect('/portal/login')

  const invoices = await prismaUnscoped.invoice.findMany({
    where: { clientId: session.clientId, tenantId: session.tenantId },
    orderBy: { issueOn: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Invoices</h2>
        <p className="text-sm text-slate-500">Your billing history. Contact us to pay any outstanding invoice.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Issued</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{inv.number}</td>
                <td className="px-4 py-3 text-slate-600">{inv.issueOn.toDateString()}</td>
                <td className="px-4 py-3 text-slate-600">{inv.dueOn.toDateString()}</td>
                <td className="px-4 py-3 text-right text-slate-800">₹{Number(inv.total).toLocaleString('en-IN')}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_CHIP[inv.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {inv.status}
                  </span>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">No invoices yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">Online payments are coming soon — for now, please contact us to settle any invoice.</p>
    </div>
  )
}
