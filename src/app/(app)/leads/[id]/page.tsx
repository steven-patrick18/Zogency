import { notFound } from 'next/navigation'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { getLeadTimeline } from '@/modules/pipeline/service'
import { StatusChangeModal } from '@/modules/pipeline/status-modal'
import { maskEmail, maskPhone } from '@/lib/mask'
import { BantForm, ContactReveal, LogCallForm, ReassignForm } from './panels'
import { LeadMeetingForm } from './lead-meeting-form'

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('leads.view')
  const canSeeContact = session.user.permissions.includes('leads.view_contact')
  const canReveal = session.user.permissions.includes('calls.log')
  const canViewAll = session.user.permissions.includes('leads.reassign')
  const { id } = await params

  const data = await withTenant(async () => {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: { source: true, status: true },
    })
    if (!lead) return null
    // Reps can only open their own leads (privacy).
    if (!canViewAll && lead.ownerId !== session.user.id) return null
    const [statuses, users, bant, timeline, deal, meetings] = await Promise.all([
      prisma.leadStatus.findMany({ orderBy: { sort: 'asc' } }),
      prisma.user.findMany({ where: { status: 'active' }, select: { id: true, name: true } }),
      prisma.bantQualification.findUnique({ where: { leadId: id } }),
      getLeadTimeline(id),
      prisma.deal.findUnique({ where: { leadId: id } }),
      prisma.meeting.findMany({ where: { leadId: id }, orderBy: { meetingAt: 'desc' } }),
    ])
    return { lead, statuses, users, bant, timeline, deal, meetings }
  })
  if (!data) notFound()
  const { lead, statuses, users, bant, timeline, deal, meetings } = data
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
            <div className="col-span-2">
              <dt className="text-slate-500">Contact</dt>
              <dd className="font-medium text-slate-900">
                {canSeeContact ? (
                  <span>{lead.phone ?? '—'} · {lead.email ?? '—'}</span>
                ) : (
                  <ContactReveal
                    leadId={lead.id}
                    maskedPhone={maskPhone(lead.phone)}
                    maskedEmail={maskEmail(lead.email)}
                    canReveal={canReveal}
                  />
                )}
              </dd>
            </div>
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
                  {e.recordingUrl && (
                    <a
                      href={e.recordingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-indigo-600 hover:underline"
                    >
                      ▶ Play recording
                    </a>
                  )}
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
        {deal && (
          <a
            href={`/deals/${deal.id}`}
            className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 p-5 hover:bg-indigo-100"
          >
            <div>
              <h2 className="font-semibold text-indigo-900">Deal room</h2>
              <p className="text-xs text-indigo-600">
                {deal.stage.replace('_', ' ')}
                {deal.value ? ` · ₹${Number(deal.value).toLocaleString('en-IN')}` : ''}
              </p>
            </div>
            <span className="text-indigo-600">→</span>
          </a>
        )}
        <LogCallForm leadId={lead.id} />

        {/* Prospect meetings (BRB) */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Meetings</h2>
            <LeadMeetingForm leadId={lead.id} />
          </div>
          <ul className="mt-3 space-y-2">
            {meetings.map((m) => (
              <li key={m.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-800">{m.title}</span>
                  {m.recordingUrl && (
                    <a href={m.recordingUrl} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-medium text-indigo-600 hover:underline">
                      ▶ rec
                    </a>
                  )}
                </div>
                <p className="text-xs text-slate-400">{new Date(m.meetingAt).toLocaleString()}</p>
                {m.summaryStatus === 'done' && m.aiSummary && (
                  <p className="mt-1 whitespace-pre-wrap rounded bg-white p-2 text-xs text-slate-600">{m.aiSummary}</p>
                )}
                {m.summaryStatus === 'pending' && <p className="mt-1 text-xs text-amber-600">AI summary generating…</p>}
              </li>
            ))}
            {meetings.length === 0 && <p className="text-sm text-slate-400">No meetings logged for this prospect.</p>}
          </ul>
        </div>

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
