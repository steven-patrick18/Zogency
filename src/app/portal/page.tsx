import { redirect } from 'next/navigation'
import { prismaUnscoped } from '@/lib/db/prisma'
import { getPortalSession } from '@/lib/portal-session'

const CAMPAIGN_CHIP: Record<string, string> = {
  brief: 'bg-slate-100 text-slate-600',
  planning: 'bg-sky-100 text-sky-700',
  creative: 'bg-violet-100 text-violet-700',
  approval: 'bg-amber-100 text-amber-700',
  launched: 'bg-emerald-100 text-emerald-700',
  monitoring: 'bg-emerald-100 text-emerald-700',
  reporting: 'bg-indigo-100 text-indigo-700',
  closed: 'bg-slate-100 text-slate-500',
}

const BAND_CHIP: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
}

export default async function PortalOverviewPage() {
  const session = await getPortalSession()
  if (!session) redirect('/portal/login')

  const scope = { clientId: session.clientId, tenantId: session.tenantId }

  const [campaigns, projects, health] = await Promise.all([
    prismaUnscoped.campaign.findMany({
      where: { ...scope, status: { not: 'closed' } },
      orderBy: { updatedAt: 'desc' },
      include: {
        kpis: { include: { snapshots: { orderBy: { capturedAt: 'desc' }, take: 1 } } },
      },
    }),
    prismaUnscoped.project.findMany({
      where: scope,
      orderBy: { createdAt: 'desc' },
      include: {
        tasks: {
          select: { id: true, title: true, status: true, deadline: true },
          orderBy: [{ status: 'asc' }, { deadline: 'asc' }],
        },
      },
    }),
    prismaUnscoped.clientHealthScore.findFirst({
      where: scope,
      orderBy: { computedAt: 'desc' },
    }),
  ])

  const kpis = campaigns.flatMap((c) =>
    c.kpis.map((k) => ({
      id: k.id,
      campaign: c.name,
      name: k.name,
      target: Number(k.target),
      latest: k.snapshots[0] ? Number(k.snapshots[0].value) : null,
    })),
  )

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Overview</h2>
        <p className="text-sm text-slate-500">A snapshot of your active work with us.</p>
      </div>

      {/* Active campaigns */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900">Active campaigns</h3>
        <ul className="mt-3 space-y-2">
          {campaigns.map((c) => (
            <li key={c.id} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
              <span className="text-sm text-slate-800">{c.name}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${CAMPAIGN_CHIP[c.status] ?? 'bg-slate-100 text-slate-600'}`}>
                {c.status}
              </span>
            </li>
          ))}
          {campaigns.length === 0 && <li className="text-sm text-slate-400">No active campaigns.</li>}
        </ul>
      </section>

      {/* Projects with their task lists */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900">Projects &amp; tasks</h3>
        {projects.length === 0 && <p className="mt-3 text-sm text-slate-400">No projects yet.</p>}
        <div className="mt-3 space-y-5">
          {projects.map((p) => {
            const done = p.tasks.filter((t) => t.status === 'done').length
            const pct = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0
            return (
              <div key={p.id}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">{p.name}</span>
                  <span className="text-xs text-slate-500">{done}/{p.tasks.length} done</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                  <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
                <ul className="mt-2 space-y-1.5">
                  {p.tasks.map((t) => (
                    <li key={t.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${t.status === 'done' ? 'bg-emerald-500' : t.status === 'in_progress' ? 'bg-amber-400' : 'bg-slate-300'}`} />
                        <span className={t.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-700'}>{t.title}</span>
                      </span>
                      <span className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="capitalize">{t.status.replace('_', ' ')}</span>
                        {t.deadline && <span>· due {t.deadline.toLocaleDateString('en-IN')}</span>}
                      </span>
                    </li>
                  ))}
                  {p.tasks.length === 0 && <li className="px-1 text-xs text-slate-400">No tasks yet.</li>}
                </ul>
              </div>
            )
          })}
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-1">
        {/* Health & KPIs */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900">Account health</h3>
          {health ? (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-2xl font-bold text-slate-900">{health.score}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${BAND_CHIP[health.band] ?? 'bg-slate-100 text-slate-600'}`}>
                {health.band}
              </span>
              <span className="text-xs text-slate-400">as of {health.computedAt.toDateString()}</span>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">No health score computed yet.</p>
          )}

          <h4 className="mt-5 text-sm font-medium text-slate-700">Latest KPIs</h4>
          <ul className="mt-2 space-y-1.5 text-sm">
            {kpis.map((k) => (
              <li key={k.id} className="flex items-center justify-between">
                <span className="text-slate-600">
                  <span className="text-slate-400">{k.campaign} · </span>
                  {k.name}
                </span>
                <span className="text-slate-800">
                  {k.latest !== null ? k.latest.toLocaleString('en-IN') : '—'}
                  <span className="text-slate-400"> / {k.target.toLocaleString('en-IN')}</span>
                </span>
              </li>
            ))}
            {kpis.length === 0 && <li className="text-slate-400">No KPIs tracked yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  )
}
