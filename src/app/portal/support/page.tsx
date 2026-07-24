import { redirect } from 'next/navigation'
import { prismaUnscoped } from '@/lib/db/prisma'
import { getPortalSession } from '@/lib/portal-session'
import { NewTicketForm, ReplyForm } from './support-forms'

const STATUS_CHIP: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-sky-100 text-sky-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-slate-100 text-slate-500',
}

export default async function PortalSupportPage() {
  const session = await getPortalSession()
  if (!session) redirect('/portal/login')

  const tickets = await prismaUnscoped.supportTicket.findMany({
    where: { clientId: session.clientId, tenantId: session.tenantId },
    orderBy: { updatedAt: 'desc' },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Support</h2>
        <p className="text-sm text-slate-500">Raise a ticket or continue a conversation with our team.</p>
      </div>

      {/* New ticket */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 font-semibold text-slate-900">New ticket</h3>
        <NewTicketForm />
      </section>

      {/* Tickets */}
      <section className="space-y-4">
        <h3 className="font-semibold text-slate-900">Your tickets</h3>
        {tickets.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            No tickets yet.
          </div>
        )}
        {tickets.map((t) => {
          const closed = t.status === 'closed' || t.status === 'resolved'
          return (
            <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-medium text-slate-900">{t.subject}</h4>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_CHIP[t.status] ?? 'bg-slate-100 text-slate-600'}`}>
                  {t.status.replace('_', ' ')}
                </span>
              </div>

              <ul className="mt-4 space-y-3">
                {t.messages.map((m) => {
                  const isClient = m.authorKind === 'client'
                  return (
                    <li key={m.id} className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${isClient ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                        <p className={`text-[11px] font-medium ${isClient ? 'text-indigo-200' : 'text-slate-500'}`}>{m.authorName}</p>
                        <p className="whitespace-pre-wrap">{m.body}</p>
                        <p className={`mt-1 text-[10px] ${isClient ? 'text-indigo-200' : 'text-slate-400'}`}>{m.createdAt.toLocaleString('en-IN')}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>

              {!closed && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <ReplyForm ticketId={t.id} />
                </div>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}
