import Link from 'next/link'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'

export default async function LeadsPage() {
  await requirePermission('leads.view')
  const leads = await withTenant(() =>
    prisma.lead.findMany({
      where: { archivedAt: null },
      include: { source: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  )
  const owners = await withTenant(() =>
    prisma.user.findMany({ select: { id: true, name: true } }),
  )
  const ownerName = new Map(owners.map((o) => [o.id, o.name]))
  // Server component renders once per request — reading the clock is safe here.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
        <div className="flex gap-2">
          <Link
            href="/leads/import"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Import CSV
          </Link>
          <Link
            href="/leads/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            New lead
          </Link>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">SLA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                  No leads yet — add one manually, import a CSV, or wire an ad campaign.
                </td>
              </tr>
            )}
            {leads.map((l) => {
              const slaBreached = l.slaDueAt && !l.firstContactedAt && l.slaDueAt.getTime() < now
              return (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${l.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                      {l.name}
                    </Link>
                    {l.company && <p className="text-xs text-slate-500">{l.company}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{l.phone ?? '—'}</p>
                    <p className="text-xs text-slate-400">{l.email ?? ''}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{l.city ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.source.name}
                    {l.source.isMql && (
                      <span className="ml-1 rounded bg-blue-100 px-1 text-[10px] font-semibold text-blue-700">MQL</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: l.status.color }}
                    >
                      {l.status.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.ownerId ? (ownerName.get(l.ownerId) ?? '?') : (
                      <span className="text-amber-600">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {l.firstContactedAt ? (
                      <span className="text-green-600">Contacted</span>
                    ) : slaBreached ? (
                      <span className="font-semibold text-red-600">Overdue</span>
                    ) : l.slaDueAt ? (
                      <span className="text-slate-500">
                        due {l.slaDueAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : (
                      '—'
                    )}
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
