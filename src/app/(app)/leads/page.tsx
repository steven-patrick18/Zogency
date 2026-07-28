import Link from 'next/link'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { maskEmail, maskPhone } from '@/lib/mask'

const inputCls = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; source?: string; owner?: string }>
}) {
  const session = await requirePermission('leads.view')
  const canSeeContact = session.user.permissions.includes('leads.view_contact')
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const statusId = sp.status ?? ''
  const sourceId = sp.source ?? ''
  const owner = sp.owner ?? ''

  const [leads, owners, statuses, sources] = await withTenant(() =>
    Promise.all([
      prisma.lead.findMany({
        where: {
          archivedAt: null,
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { company: { contains: q, mode: 'insensitive' } },
                  { email: { contains: q, mode: 'insensitive' } },
                  { phone: { contains: q } },
                  { city: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(statusId ? { statusId } : {}),
          ...(sourceId ? { sourceId } : {}),
          ...(owner === 'unassigned' ? { ownerId: null } : owner ? { ownerId: owner } : {}),
        },
        include: { source: true, status: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.user.findMany({ select: { id: true, name: true } }),
      prisma.leadStatus.findMany({ orderBy: { sort: 'asc' }, select: { id: true, name: true } }),
      prisma.leadSource.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    ]),
  )
  const ownerName = new Map(owners.map((o) => [o.id, o.name]))
  const hasFilters = !!(q || statusId || sourceId || owner)
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

      {/* Search + filters (BRB) */}
      <form method="GET" className="mt-6 flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, company, email, phone, city…"
          className={`${inputCls} min-w-[16rem] flex-1`}
        />
        <select name="status" defaultValue={statusId} className={inputCls}>
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select name="source" defaultValue={sourceId} className={inputCls}>
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select name="owner" defaultValue={owner} className={inputCls}>
          <option value="">All owners</option>
          <option value="unassigned">Unassigned</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
          Search
        </button>
        {hasFilters && (
          <Link href="/leads" className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Clear
          </Link>
        )}
      </form>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
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
                  {hasFilters
                    ? 'No leads match your search or filters.'
                    : 'No leads yet — add one manually, import a CSV, or wire an ad campaign.'}
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
                    <p>{canSeeContact ? (l.phone ?? '—') : maskPhone(l.phone)}</p>
                    <p className="text-xs text-slate-400">
                      {canSeeContact ? (l.email ?? '') : maskEmail(l.email)}
                    </p>
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
