import { redirect } from 'next/navigation'
import { prismaUnscoped } from '@/lib/db/prisma'
import { getPortalSession } from '@/lib/portal-session'
import { ApproveButton, RequestChangesForm } from './approval-forms'

export default async function PortalApprovalsPage() {
  const session = await getPortalSession()
  if (!session) redirect('/portal/login')

  const scope = { clientId: session.clientId, tenantId: session.tenantId }

  const campaigns = await prismaUnscoped.campaign.findMany({
    where: { ...scope, status: 'approval' },
    orderBy: { updatedAt: 'desc' },
    include: {
      assets: { orderBy: { updatedAt: 'desc' } },
      revisionRounds: { orderBy: { createdAt: 'desc' } },
      signoffs: { orderBy: { createdAt: 'desc' } },
    },
  })

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Approvals</h2>
        <p className="text-sm text-slate-500">Review the latest creative and approve or request changes.</p>
      </div>

      {campaigns.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          Nothing is awaiting your approval right now.
        </div>
      )}

      {campaigns.map((c) => {
        const clientRounds = c.revisionRounds.filter((r) => r.source === 'client')
        return (
          <section key={c.id} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-900">{c.name}</h3>
              <span className="text-xs text-slate-500">
                Revisions used: <span className="font-medium text-slate-700">{clientRounds.length}</span> / {c.revisionLimit}
              </span>
            </div>

            {/* Creative / assets summary */}
            <div>
              <h4 className="text-sm font-medium text-slate-700">Creative for review</h4>
              <ul className="mt-2 space-y-1.5 text-sm">
                {c.assets.map((a) => (
                  <li key={a.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-slate-800">{a.title}</span>
                    <span className="text-xs uppercase tracking-wide text-slate-400">{a.type} · {a.status.replace('_', ' ')}</span>
                  </li>
                ))}
                {c.assets.length === 0 && <li className="text-slate-400">No assets attached yet.</li>}
              </ul>
            </div>

            {/* Actions */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm font-medium text-slate-700">Happy with it?</p>
                <p className="mb-3 text-xs text-slate-500">Records your final sign-off for the team.</p>
                <ApproveButton campaignId={c.id} />
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm font-medium text-slate-700">Need changes?</p>
                <p className="mb-3 text-xs text-slate-500">Logs a revision round for the team.</p>
                <RequestChangesForm campaignId={c.id} />
              </div>
            </div>

            {/* History */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="text-sm font-medium text-slate-700">Revision rounds</h4>
                <ul className="mt-2 space-y-2 text-sm">
                  {c.revisionRounds.map((r) => (
                    <li key={r.id} className="rounded-lg bg-slate-50 p-3">
                      <p className="text-slate-800">Round {r.roundNo} <span className="text-xs text-slate-400">· {r.source}</span></p>
                      <p className="text-slate-600">{r.feedback}</p>
                      <p className="mt-1 text-xs text-slate-400">{r.createdAt.toDateString()}</p>
                    </li>
                  ))}
                  {c.revisionRounds.length === 0 && <li className="text-slate-400">No revisions yet.</li>}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-700">Past sign-offs</h4>
                <ul className="mt-2 space-y-2 text-sm">
                  {c.signoffs.map((s) => (
                    <li key={s.id} className="rounded-lg bg-emerald-50 p-3">
                      <p className="text-emerald-800">{s.scope} sign-off by {s.signedBy}</p>
                      <p className="text-xs text-emerald-600">{s.createdAt.toDateString()}</p>
                    </li>
                  ))}
                  {c.signoffs.length === 0 && <li className="text-slate-400">No sign-offs yet.</li>}
                </ul>
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}
