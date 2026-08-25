// Company dashboard (FR-9.1) — leadership view (reports.view holders): full
// cross-team funnel, pipeline, revenue, SLA and per-rep performance.
import { withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'

export async function CompanyDashboard({ tenantName, canSeeMoney }: { tenantName: string; canSeeMoney: boolean }) {
  const { leads, deals, users, calls, invoices } = await withTenant(async () => {
    const [leads, deals, users, calls, invoices] = await Promise.all([
      prisma.lead.findMany({ include: { source: true, status: true } }),
      prisma.deal.findMany(),
      prisma.user.findMany({ where: { status: 'active' }, select: { id: true, name: true } }),
      prisma.call.findMany(),
      prisma.invoice.findMany({ include: { payments: true } }),
    ])
    return { leads, deals, users, calls, invoices }
  })

  const wonDeals = deals.filter((d) => d.stage === 'won')
  const openDeals = deals.filter((d) => d.stage === 'open' || d.stage === 'verbal_commit')
  const revenue = wonDeals.reduce((s, d) => s + Number(d.value ?? 0), 0)
  const pipelineValue = openDeals.reduce((s, d) => s + Number(d.value ?? 0), 0)
  const conversion = leads.length ? Math.round((wonDeals.length / leads.length) * 100) : 0
  const contacted = leads.filter((l) => l.firstContactedAt)
  const withinSla = contacted.filter((l) => l.slaDueAt && l.firstContactedAt! <= l.slaDueAt)
  const slaCompliance = contacted.length ? Math.round((withinSla.length / contacted.length) * 100) : 100
  const outstanding = invoices
    .filter((i) => i.status !== 'paid')
    .reduce((s, i) => s + Number(i.total) - i.payments.reduce((p, x) => p + Number(x.amount), 0), 0)

  const bySource = [...new Set(leads.map((l) => l.source.name))].map((name) => ({
    name,
    total: leads.filter((l) => l.source.name === name).length,
    won: leads.filter((l) => l.source.name === name && l.status.isWon).length,
  }))
  const byRep = users.map((u) => ({
    name: u.name,
    leads: leads.filter((l) => l.ownerId === u.id).length,
    calls: calls.filter((c) => c.userId === u.id).length,
    revenue: wonDeals.filter((d) => d.ownerId === u.id).reduce((s, d) => s + Number(d.value ?? 0), 0),
  }))

  // ₹ figures are visible only to finance/leadership (reports.exec or invoices.view).
  const stats = [
    { label: 'Total leads', value: String(leads.length), money: false },
    { label: 'Lead → Won conversion', value: `${conversion}%`, money: false },
    { label: 'Pipeline value', value: `₹${pipelineValue.toLocaleString('en-IN')}`, money: true },
    { label: 'Revenue won', value: `₹${revenue.toLocaleString('en-IN')}`, money: true },
    { label: 'SLA compliance', value: `${slaCompliance}%`, money: false },
    { label: 'Outstanding invoices', value: `₹${outstanding.toLocaleString('en-IN')}`, money: true },
  ].filter((s) => canSeeMoney || !s.money)

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-slate-900">{tenantName} — Company dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">Cross-team leadership view · live metrics.</p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            <p className="mt-1 text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Leads by source</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr><th className="py-1">Source</th><th>Leads</th><th>Won</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bySource.map((s) => (
                <tr key={s.name}>
                  <td className="py-1.5 text-slate-800">{s.name}</td>
                  <td className="text-slate-600">{s.total}</td>
                  <td className="text-slate-600">{s.won}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Team performance</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr><th className="py-1">Member</th><th>Leads</th><th>Calls</th>{canSeeMoney && <th>Revenue</th>}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {byRep.map((r) => (
                <tr key={r.name}>
                  <td className="py-1.5 text-slate-800">{r.name}</td>
                  <td className="text-slate-600">{r.leads}</td>
                  <td className="text-slate-600">{r.calls}</td>
                  {canSeeMoney && <td className="text-slate-600">₹{r.revenue.toLocaleString('en-IN')}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
