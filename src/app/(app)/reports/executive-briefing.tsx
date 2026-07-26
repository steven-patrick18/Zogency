// CEO briefing — headline KPIs, revenue trend, sales funnel, cash & finance,
// client portfolio and people, all period-filtered. Pure server render.
import Link from 'next/link'
import type { ExecutiveReport, Period } from '@/modules/reports/executive'

const CARD = 'rounded-xl border border-slate-200 bg-white p-5'

function inr(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return null
  const up = pct >= 0
  return (
    <span className={`ml-1 text-xs font-semibold ${up ? 'text-green-600' : 'text-red-600'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  )
}

function Kpi({ label, value, delta, sub }: { label: string; value: string; delta?: number | null; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="flex items-baseline text-2xl font-bold text-slate-900">
        {value}
        {delta !== undefined && <Delta pct={delta} />}
      </p>
      <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All time' },
]

export function ExecutiveBriefing({ report }: { report: ExecutiveReport }) {
  const { revenue, funnel, finance, clients, people } = report
  const trendMax = Math.max(1, ...revenue.trend.map((t) => t.value))
  const funnelMax = Math.max(1, funnel.leads, funnel.deals, funnel.won)
  const agingMax = Math.max(1, finance.aging.current, finance.aging.d0_30, finance.aging.d31_60, finance.aging.d60plus)

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Executive briefing</h2>
          <p className="text-xs text-slate-400">Company-wide performance · {report.periodLabel.toLowerCase()}</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/reports?period=${p.key}`}
              className={`rounded-md px-3 py-1.5 font-medium ${
                report.period === p.key ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Revenue won" value={inr(revenue.won)} delta={revenue.deltaPct} sub="vs prior period" />
        <Kpi label="Weighted forecast" value={inr(revenue.forecast)} sub={`${inr(revenue.pipelineValue)} open`} />
        <Kpi label="New leads" value={String(funnel.leads)} sub={funnel.leadToWon !== null ? `${funnel.leadToWon}% → won` : 'no leads'} />
        <Kpi label="Win rate" value={funnel.dealToWon !== null ? `${funnel.dealToWon}%` : '—'} sub={`${funnel.won}/${funnel.deals} deals`} />
        <Kpi label="Cash collected" value={inr(finance.collected)} delta={finance.collectedDeltaPct} sub="vs prior period" />
        <Kpi label="Outstanding" value={inr(finance.outstanding)} sub={`${inr(finance.aging.d60plus)} 60d+`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue trend */}
        <div className={CARD}>
          <h3 className="font-semibold text-slate-900">Revenue won — last 6 months</h3>
          <div className="mt-4 flex h-40 items-end gap-3">
            {revenue.trend.map((t) => (
              <div key={t.label} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-indigo-500"
                    style={{ height: `${Math.max(2, (t.value / trendMax) * 100)}%` }}
                    title={inr(t.value)}
                  />
                </div>
                <span className="text-[10px] text-slate-400">{t.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">Peak month {inr(trendMax)}.</p>
        </div>

        {/* Sales funnel */}
        <div className={CARD}>
          <h3 className="font-semibold text-slate-900">Sales funnel &amp; conversion</h3>
          <div className="mt-4 space-y-3">
            {[
              { label: 'Leads', v: funnel.leads, color: 'bg-sky-500' },
              { label: 'Deals created', v: funnel.deals, color: 'bg-indigo-500' },
              { label: 'Won', v: funnel.won, color: 'bg-green-500' },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>{row.label}</span>
                  <span className="font-semibold text-slate-800">{row.v}</span>
                </div>
                <div className="mt-1 h-2.5 w-full rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${row.color}`} style={{ width: `${(row.v / funnelMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-slate-50 py-2">
              <p className="text-base font-bold text-slate-900">{funnel.leadToDeal ?? '—'}{funnel.leadToDeal !== null && '%'}</p>
              <p className="text-slate-400">Lead → deal</p>
            </div>
            <div className="rounded-lg bg-slate-50 py-2">
              <p className="text-base font-bold text-slate-900">{funnel.dealToWon ?? '—'}{funnel.dealToWon !== null && '%'}</p>
              <p className="text-slate-400">Deal → won</p>
            </div>
            <div className="rounded-lg bg-slate-50 py-2">
              <p className="text-base font-bold text-slate-900">{funnel.leadToWon ?? '—'}{funnel.leadToWon !== null && '%'}</p>
              <p className="text-slate-400">Lead → won</p>
            </div>
          </div>
        </div>

        {/* Cash & finance */}
        <div className={CARD}>
          <h3 className="font-semibold text-slate-900">Cash &amp; finance</h3>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div><p className="text-lg font-bold text-slate-900">{inr(finance.billed)}</p><p className="text-xs text-slate-400">Billed</p></div>
            <div><p className="text-lg font-bold text-green-700">{inr(finance.collected)}</p><p className="text-xs text-slate-400">Collected</p></div>
            <div><p className="text-lg font-bold text-amber-600">{inr(finance.outstanding)}</p><p className="text-xs text-slate-400">Outstanding</p></div>
          </div>
          <p className="mt-4 mb-2 text-xs font-medium text-slate-500">Receivables aging</p>
          <div className="space-y-2">
            {[
              { label: 'Current (not due)', v: finance.aging.current, color: 'bg-slate-400' },
              { label: '0–30 days overdue', v: finance.aging.d0_30, color: 'bg-amber-400' },
              { label: '31–60 days overdue', v: finance.aging.d31_60, color: 'bg-orange-500' },
              { label: '60+ days overdue', v: finance.aging.d60plus, color: 'bg-red-500' },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-2 text-xs">
                <span className="w-32 shrink-0 text-slate-500">{row.label}</span>
                <div className="h-2.5 flex-1 rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${row.color}`} style={{ width: `${(row.v / agingMax) * 100}%` }} />
                </div>
                <span className="w-16 shrink-0 text-right text-slate-700">{inr(row.v)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Client portfolio */}
        <div className={CARD}>
          <h3 className="font-semibold text-slate-900">Client portfolio</h3>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div><p className="text-lg font-bold text-slate-900">{clients.active}</p><p className="text-xs text-slate-400">Active clients</p></div>
            <div>
              <p className="text-lg font-bold text-slate-900">{clients.renewalsDue.count90}</p>
              <p className="text-xs text-slate-400">Renewals ≤90d · {inr(clients.renewalsDue.value90)}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 text-sm font-semibold text-green-600">●{clients.healthMix.green}</span>
              <span className="flex items-center gap-1 text-sm font-semibold text-amber-500">●{clients.healthMix.amber}</span>
              <span className="flex items-center gap-1 text-sm font-semibold text-red-500">●{clients.healthMix.red}</span>
            </div>
          </div>
          <p className="mt-4 mb-1 text-xs font-medium text-slate-500">Top clients by collections</p>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {clients.topClients.map((c) => (
                <tr key={c.name}>
                  <td className="py-1.5 text-slate-800">{c.name}</td>
                  <td className="py-1.5 text-right font-medium text-slate-700">{inr(c.value)}</td>
                </tr>
              ))}
              {clients.topClients.length === 0 && (
                <tr><td className="py-3 text-center text-slate-400">No collections yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* People & productivity */}
      <div className={CARD}>
        <h3 className="font-semibold text-slate-900">People &amp; productivity</h3>
        <div className="mt-3 grid grid-cols-3 gap-4">
          <div><p className="text-2xl font-bold text-slate-900">{people.headcount}</p><p className="text-xs text-slate-400">Active headcount</p></div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{people.attendanceRate !== null ? `${people.attendanceRate}%` : '—'}</p>
            <p className="text-xs text-slate-400">Attendance (present rate)</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{people.avgProductiveHrs !== null ? `${people.avgProductiveHrs.toFixed(1)}h` : '—'}</p>
            <p className="text-xs text-slate-400">Avg productive hrs / active day</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">Productivity from the desktop-agent activity feed.</p>
      </div>
    </section>
  )
}
