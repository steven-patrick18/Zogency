import Link from 'next/link'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'

export default async function ClientsPage() {
  await requirePermission('clients.view')
  const clients = await withTenant(() =>
    prisma.client.findMany({
      where: { archivedAt: null },
      include: {
        contacts: { where: { isPrimary: true } },
        projects: true,
        invoices: true,
        onboardingItems: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  )

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
      <p className="mt-1 text-sm text-slate-500">
        Created automatically when a deal closes Won (FR-5.1).
      </p>
      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Primary contact</th>
              <th className="px-4 py-3">Onboarding</th>
              <th className="px-4 py-3">Projects</th>
              <th className="px-4 py-3">Invoiced</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No clients yet — win a deal.</td></tr>
            )}
            {clients.map((c) => {
              const done = c.onboardingItems.filter((i) => i.doneAt).length
              const invoiced = c.invoices.reduce((s, i) => s + Number(i.total), 0)
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/clients/${c.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.contacts[0]?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{done}/{c.onboardingItems.length} done</td>
                  <td className="px-4 py-3 text-slate-600">{c.projects.length}</td>
                  <td className="px-4 py-3 text-slate-600">₹{invoiced.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">{c.status}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
