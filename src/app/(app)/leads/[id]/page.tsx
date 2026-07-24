import { notFound } from 'next/navigation'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { getLeadTimeline } from '@/modules/pipeline/service'
import { StatusChangeModal } from '@/modules/pipeline/status-modal'
import { BantForm, LogCallForm, ReassignForm } from './panels'

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('leads.view')
  const { id } = await params

  const data = await withTenant(async () => {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: { source: true, status: true },
    })
    if (!lead) return null
    const [statuses, users, bant, timeline] = await Promise.all([
      prisma.leadStatus.findMany({ orderBy: { sort: 'asc' } }),
      prisma.user.findMany({ where: { status: 'active' }, select: { id: true, name: true } }),
      prisma.bantQualification.findUnique({ where: { leadId: id } }),
      getLeadTimeline(id),
    ])
    return { lead, statuses, users, bant, timeline }
  })
  if (!data) notFound()
  const { lead, statuses, users, bant, timeline } = data
  const userName = new Map(users.map((u) => [u.id, u.name]))

  return (
    <div className="grid max-w-5xl grid-cols-5 gap-6">
      <div className="col-span-3 space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{lead.name}</h1>
              <p className="text-sm text-slate-500">{lead.company ?? '—'}</p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="rounded-full px-2.5 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: lead.status.color }}
              >
                {lead.status.name}
              </span>
              {!lead.status.isTerminal && (
                <StatusChangeModal
                  leadId={lead.id}
                  leadName={lead.name}
                  currentStatusId={lead.statusId}
                  statuses={statuses.map((s) => ({ id: s.id, name: s.name, color: s.color, isJunk: s.isJunk }))}
                />
              )}
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div><dt className="text-slate-500">Phone</dt><dd className="font-medium text-slate-900">{lead.phone ?? '—'}</dd></div>
            <div><dt className="text-slate-500">Email</dt><dd className="font-medium text-slate-900">{lead.email ?? '—'}</dd></div>
            <div><dt className="text-slate-500">City</dt><dd className="font-medium text-slate-900">{lead.city ?? '—'}</dd></div>
            <div><dt className="text-slate-500">Industry</dt><dd className="font-medium text-slate-900">{lead.industry ?? '—'}</dd></div>
            <div><dt className="text-slate-500">Source</dt><dd className="font-medium text-slate-900">{lead.source.name}{lead.source.isMql ? ' (MQL)' : ''}</dd></div>
            <div>
              <dt className="text-slate-500">Owner</dt>
              <dd className="font-medium text-slate-900">
                {lead.ownerId ? (userName.get(lead.ownerId) ?? '—') : 'Unassigned'}
              </dd>
            </div>
          </dl>
          {lead.junkReason && (
            <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
              Junk reason: {lead.junkReason}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">Timeline</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Append-only — entries are never edited or deleted (Data Integrity NFR).
          </p>
          <ol className="mt-4 space-y-3">
            {timeline.map((e, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span
                  className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                    e.kind === 'status'
                      ? 'bg-indigo-500'
                      : e.kind === 'assignment'
                        ? 'bg-amber-400'
                        : e.kind === 'call'
                          ? 'bg-green-500'
                          : 'bg-slate-300'
                  }`}
                />
                <div>
                  <p className="text-slate-800">{e.text}</p>
                  <p className="text-xs text-slate-400">
                    {e.at.toLocaleString()} · {e.actorId ? (userName.get(e.actorId) ?? 'user') : 'system'}
                  </p>
                </div>
              </li>
            ))}
            {timeline.length === 0 && <p className="text-sm text-slate-400">No activity yet.</p>}
          </ol>
        </div>
      </div>

      <div className="col-span-2 space-y-6">
        <LogCallForm leadId={lead.id} />
        <BantForm leadId={lead.id} bant={bant} />
        <ReassignForm
          leadId={lead.id}
          currentOwnerId={lead.ownerId}
          users={users.map((u) => ({ id: u.id, name: u.name }))}
        />
      </div>
    </div>
  )
}
