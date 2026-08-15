import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { summarizeMeetingAction } from '@/modules/meetings/actions'
import { MeetingForm } from './meeting-form'

export default async function MeetingsPage() {
  const session = await requirePermission('clients.view')
  const canViewAll = session.user.permissions.includes('leads.reassign')

  const [meetings, clients, leads] = await withTenant(() =>
    Promise.all([
      prisma.meeting.findMany({ orderBy: { meetingAt: 'desc' } }),
      prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.lead.findMany({
        where: { archivedAt: null, ...(canViewAll ? {} : { ownerId: session.user.id }) },
        select: { id: true, name: true, company: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ]),
  )
  const clientName = new Map(clients.map((c) => [c.id, c.name]))
  const leadName = new Map(leads.map((l) => [l.id, l.company ? `${l.name} · ${l.company}` : l.name]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Meetings</h1>
        <p className="mt-0.5 text-sm text-slate-500">Recordings, transcripts, and AI summaries.</p>
      </div>

      <MeetingForm
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        leads={leads.map((l) => ({ id: l.id, name: leadName.get(l.id) ?? l.name }))}
      />

      <div className="space-y-4">
        {meetings.map((m) => (
          <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-900">{m.title}</h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  {new Date(m.meetingAt).toLocaleString()} ·{' '}
                  {m.clientId
                    ? (clientName.get(m.clientId) ?? 'Unknown client')
                    : m.leadId
                      ? `Prospect: ${leadName.get(m.leadId) ?? 'lead'}`
                      : 'No client'}
                </p>
              </div>
              {m.recordingUrl && (
                <a
                  href={m.recordingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                >
                  ▶ recording
                </a>
              )}
            </div>

            <div className="mt-3">
              {m.summaryStatus === 'done' && m.aiSummary ? (
                <div className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  {m.aiSummary}
                </div>
              ) : m.summaryStatus === 'pending' ? (
                <p className="text-sm text-amber-600">generating…</p>
              ) : m.transcript ? (
                <form action={summarizeMeetingAction} className="flex items-center gap-3">
                  <input type="hidden" name="meetingId" value={m.id} />
                  <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
                    Summarize with AI
                  </button>
                  {m.summaryStatus === 'failed' && (
                    <span className="text-xs text-red-600">Previous attempt failed — retry.</span>
                  )}
                </form>
              ) : (
                <p className="text-sm text-slate-400">No transcript — add one to enable an AI summary.</p>
              )}
            </div>
          </div>
        ))}
        {meetings.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            No meetings yet — add one above.
          </div>
        )}
      </div>
    </div>
  )
}
