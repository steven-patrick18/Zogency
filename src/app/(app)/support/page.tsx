import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { setTicketStatusAction, staffReplyTicketAction } from '@/modules/portal/admin-actions'

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-slate-200 text-slate-600',
}

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  normal: 'bg-slate-100 text-slate-600',
  high: 'bg-red-100 text-red-700',
}

const COLUMNS: Array<{ key: string; label: string }> = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
]

export default async function SupportPage() {
  await requirePermission('clients.view')
  const [rawTickets, clients] = await withTenant(() =>
    Promise.all([
      prisma.supportTicket.findMany({
        include: { messages: { orderBy: { createdAt: 'asc' } } },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.client.findMany({ select: { id: true, name: true } }),
    ]),
  )
  const clientName = new Map(clients.map((c) => [c.id, c.name]))

  const tickets = rawTickets.map((t) => ({
    id: t.id,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    client: clientName.get(t.clientId) ?? 'Unknown client',
    messages: t.messages.map((m) => ({
      id: m.id,
      authorKind: m.authorKind,
      authorName: m.authorName,
      body: m.body,
      at: m.createdAt.toISOString(),
    })),
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Support tickets</h1>
      <p className="mt-1 text-sm text-slate-500">
        Client portal requests routed to the team. Reply and move tickets through resolution.
      </p>
      <div className="mt-6 flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const column = tickets.filter((t) => t.status === col.key)
          return (
            <div key={col.key} className="w-80 shrink-0 rounded-xl bg-slate-200/60 p-2">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-sm font-semibold text-slate-700">{col.label}</span>
                <span className="text-xs text-slate-500">{column.length}</span>
              </div>
              <div className="mt-1 space-y-2">
                {column.map((t) => (
                  <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{t.subject}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_STYLES[t.priority] ?? PRIORITY_STYLES.normal}`}
                      >
                        {t.priority}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{t.client}</p>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[t.status] ?? STATUS_STYLES.open}`}
                    >
                      {t.status.replace('_', ' ')}
                    </span>

                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-indigo-600 hover:underline">
                        {t.messages.length} message{t.messages.length === 1 ? '' : 's'}
                      </summary>
                      <div className="mt-2 space-y-2">
                        {t.messages.map((m) => (
                          <div
                            key={m.id}
                            className={`rounded-lg p-2 text-xs ${
                              m.authorKind === 'staff'
                                ? 'ml-4 bg-indigo-50 text-indigo-900'
                                : 'mr-4 bg-slate-100 text-slate-800'
                            }`}
                          >
                            <p className="font-medium">
                              {m.authorName}
                              <span className="ml-1 font-normal text-slate-400">
                                {m.authorKind === 'staff' ? 'staff' : 'client'}
                              </span>
                            </p>
                            <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
                            <p className="mt-0.5 text-[10px] text-slate-400">{new Date(m.at).toLocaleString()}</p>
                          </div>
                        ))}
                        {t.messages.length === 0 && (
                          <p className="text-xs text-slate-400">No messages yet.</p>
                        )}
                      </div>
                    </details>

                    <form action={staffReplyTicketAction} className="mt-2 space-y-1">
                      <input type="hidden" name="ticketId" value={t.id} />
                      <textarea
                        name="body"
                        rows={2}
                        required
                        placeholder="Reply to client…"
                        className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                      />
                      <button className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500">
                        Send reply
                      </button>
                    </form>

                    <form action={setTicketStatusAction} className="mt-1.5 flex gap-1">
                      <input type="hidden" name="ticketId" value={t.id} />
                      {[
                        { key: 'in_progress', label: 'In progress' },
                        { key: 'resolved', label: 'Resolved' },
                        { key: 'closed', label: 'Closed' },
                      ]
                        .filter((s) => s.key !== t.status)
                        .map((s) => (
                          <button
                            key={s.key}
                            name="status"
                            value={s.key}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-indigo-100 hover:text-indigo-700"
                          >
                            {s.label}
                          </button>
                        ))}
                    </form>
                  </div>
                ))}
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
