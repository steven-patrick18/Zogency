import Link from 'next/link'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { StatusChangeModal } from '@/modules/pipeline/status-modal'
import { maybeRunSlaSweep } from '@/modules/automation/service'

export default async function PipelinePage() {
  await requirePermission('leads.view')
  const [statuses, leads, users] = await withTenant(async () => {
    await maybeRunSlaSweep()
    return Promise.all([
      prisma.leadStatus.findMany({ orderBy: { sort: 'asc' } }),
      prisma.lead.findMany({ where: { archivedAt: null }, orderBy: { createdAt: 'desc' } }),
      prisma.user.findMany({ select: { id: true, name: true } }),
    ])
  })
  const userName = new Map(users.map((u) => [u.id, u.name]))
  const statusOptions = statuses.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    isJunk: s.isJunk,
  }))
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
      <p className="mt-1 text-sm text-slate-500">
        Every move requires a comment. BANT is required to progress past Connected.
      </p>
      <div className="mt-6 flex gap-3 overflow-x-auto pb-4">
        {statuses.map((status) => {
          const column = leads.filter((l) => l.statusId === status.id)
          return (
            <div key={status.id} className="w-64 shrink-0 rounded-xl bg-slate-200/60 p-2">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                  {status.name}
                </span>
                <span className="text-xs font-medium text-slate-500">{column.length}</span>
              </div>
              <div className="mt-1 space-y-2">
                {column.map((l) => {
                  const overdue = l.slaDueAt && !l.firstContactedAt && l.slaDueAt.getTime() < now
                  return (
                    <div key={l.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                      <Link href={`/leads/${l.id}`} className="block">
                        <p className="text-sm font-medium text-slate-900 hover:text-indigo-600">{l.name}</p>
                        {l.company && <p className="text-xs text-slate-500">{l.company}</p>}
                      </Link>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                          {l.ownerId ? (userName.get(l.ownerId) ?? '') : 'Unassigned'}
                          {overdue && <span className="ml-1 font-semibold text-red-600">· SLA overdue</span>}
                        </span>
                        {!status.isTerminal && (
                          <StatusChangeModal
                            leadId={l.id}
                            leadName={l.name}
                            currentStatusId={l.statusId}
                            statuses={statusOptions}
                            triggerClass="rounded px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50"
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
                {column.length === 0 && (
                  <p className="px-2 py-3 text-center text-xs text-slate-400">Empty</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
