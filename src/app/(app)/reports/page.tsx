// Reporting suite (FR-9.2–9.6): marketing, delivery, HR, retention and the
// executive summary. Live queries at BRB scale — report_snapshots precompute
// takes over in a later sprint (doc 08 §6).
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'

const CARD = 'rounded-xl border border-slate-200 bg-white p-5'
const THEAD = 'text-left text-xs uppercase tracking-wide text-slate-400'

export default async function ReportsPage() {
  await requirePermission('reports.view')

  const data = await withTenant(async () => {
    const [
      campaigns,
      departments,
      tasks,
      employees,
      requisitions,
      exits,
      leaveBalances,
      renewals,
      churnFlagsOpen,
      healthScores,
      clients,
      deals,
    ] = await Promise.all([
      prisma.campaign.findMany({
        include: {
          kpis: { include: { snapshots: { orderBy: { capturedAt: 'desc' }, take: 1 } } },
          optimizations: { select: { id: true } },
          report: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.department.findMany({ orderBy: { sort: 'asc' } }),
      prisma.task.findMany({
        include: { statusHistory: { where: { to: 'done' }, orderBy: { at: 'desc' }, take: 1 } },
      }),
      prisma.employee.findMany(),
      prisma.jobRequisition.count({ where: { status: 'open' } }),
      prisma.employeeExit.count(),
      prisma.leaveBalance.findMany(),
      prisma.renewal.findMany(),
      prisma.churnFlag.count({ where: { resolvedAt: null } }),
      prisma.clientHealthScore.findMany({ orderBy: { computedAt: 'desc' } }),
      prisma.client.findMany({ where: { archivedAt: null } }),
      prisma.deal.findMany(),
    ])
    return {
      campaigns, departments, tasks, employees, requisitions, exits,
      leaveBalances, renewals, churnFlagsOpen, healthScores, clients, deals,
    }
  })

  // ── Marketing (FR-9.2) ────────────────────────────────────────────────────
  const marketing = data.campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    kpis: c.kpis.map((k) => {
      const latest = k.snapshots[0] ? Number(k.snapshots[0].value) : null
      const target = Number(k.target)
      return {
        id: k.id,
        name: k.name,
        target,
        latest,
        pct: latest !== null && target > 0 ? Math.round((latest / target) * 100) : null,
      }
    }),
    optimizations: c.optimizations.length,
    reportCompiled: !!c.report,
  }))

  // ── Delivery (FR-9.3) — deadline vs latest done-history timestamp ─────────
  const DAY = 86_400_000
  type TaskRow = (typeof data.tasks)[number]
  const doneStats = (tasks: TaskRow[]) => {
    let onTime = 0
    let late = 0
    for (const t of tasks) {
      const doneAt = t.statusHistory[0]?.at
      if (t.status !== 'done' || !doneAt || !t.deadline) continue
      // Deadline is a date — done any time on the deadline day counts on time.
      if (doneAt.getTime() < t.deadline.getTime() + DAY) onTime++
      else late++
    }
    return { onTime, late }
  }
  const delivery = data.departments.map((d) => {
    const tasks = data.tasks.filter((t) => t.departmentId === d.id)
    return {
      id: d.id,
      name: d.name,
      ...doneStats(tasks),
      open: tasks.filter((t) => t.status !== 'done').length,
    }
  })
  const unassigned = data.tasks.filter((t) => !t.departmentId)
  if (unassigned.length > 0) {
    delivery.push({
      id: 'none',
      name: 'No department',
      ...doneStats(unassigned),
      open: unassigned.filter((t) => t.status !== 'done').length,
    })
  }
  const overall = doneStats(data.tasks)
  const measured = overall.onTime + overall.late
  const onTimePct = measured > 0 ? Math.round((overall.onTime / measured) * 100) : 100

  // ── HR (FR-9.4) ───────────────────────────────────────────────────────────
  const activeEmployees = data.employees.filter((e) => e.status !== 'exited')
  const headcountByDept = data.departments.map((d) => ({
    id: d.id,
    name: d.name,
    headcount: activeEmployees.filter((e) => e.departmentId === d.id).length,
  }))
  const unassignedHeadcount = activeEmployees.filter((e) => !e.departmentId).length
  const usedLeave = data.leaveBalances.reduce((s, b) => s + b.used, 0)
  const availableLeave = data.leaveBalances.reduce((s, b) => s + b.available, 0)
  const leaveUtilization = availableLeave > 0 ? Math.round((usedLeave / availableLeave) * 100) : 0

  // ── Retention (FR-9.5) ────────────────────────────────────────────────────
  const renewed = data.renewals.filter((r) => r.status === 'renewed').length
  const lost = data.renewals.filter((r) => r.status === 'lost').length
  const renewalRate = renewed + lost > 0 ? Math.round((renewed / (renewed + lost)) * 100) : null
  const latestHealth = new Map<string, number>()
  for (const hs of data.healthScores) {
    if (!latestHealth.has(hs.clientId)) latestHealth.set(hs.clientId, hs.score)
  }
  const healthValues = [...latestHealth.values()]
  const avgHealth = healthValues.length > 0
    ? Math.round(healthValues.reduce((s, v) => s + v, 0) / healthValues.length)
    : null

  // ── Executive summary (FR-9.6) ────────────────────────────────────────────
  const openDeals = data.deals.filter((d) => d.stage === 'open' || d.stage === 'verbal_commit')
  const pipelineValue = openDeals.reduce((s, d) => s + Number(d.value ?? 0), 0)
  const revenue = data.deals.filter((d) => d.stage === 'won').reduce((s, d) => s + Number(d.value ?? 0), 0)
  const activeClients = data.clients.filter((c) => c.status === 'active').length
  const closedCampaigns = data.campaigns.filter((c) => c.status === 'closed').length
  const liveCampaigns = data.campaigns.length - closedCampaigns

  const stats = [
    { label: 'Pipeline value (open deals)', value: `₹${pipelineValue.toLocaleString('en-IN')}` },
    { label: 'Revenue won', value: `₹${revenue.toLocaleString('en-IN')}` },
    { label: 'Active clients', value: String(activeClients) },
    { label: 'Campaigns live / closed', value: `${liveCampaigns} / ${closedCampaigns}` },
    { label: 'On-time delivery', value: `${onTimePct}%` },
    { label: 'Headcount', value: String(activeEmployees.length) },
  ]

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
      <p className="mt-1 text-sm text-slate-500">
        FR-9.2–9.6 · computed live — snapshot precompute pending
      </p>

      {/* Executive summary (FR-9.6) */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            <p className="mt-1 text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Marketing (FR-9.2) */}
      <div className={`mt-6 ${CARD}`}>
        <h2 className="font-semibold text-slate-900">Marketing — campaign performance</h2>
        <p className="mt-0.5 text-xs text-slate-400">KPI targets vs latest snapshots, optimizations, report status (FR-9.2).</p>
        <table className="mt-3 w-full text-sm">
          <thead className={THEAD}>
            <tr>
              <th className="py-1">Campaign</th>
              <th>Status</th>
              <th>KPIs (latest / target)</th>
              <th>Optimizations</th>
              <th>Report</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {marketing.map((c) => (
              <tr key={c.id} className="align-top">
                <td className="py-2 font-medium text-slate-900">{c.name}</td>
                <td className="py-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{c.status}</span>
                </td>
                <td className="py-2 text-slate-600">
                  {c.kpis.length === 0 && '—'}
                  {c.kpis.map((k) => (
                    <p key={k.id}>
                      {k.name}: {k.latest !== null ? k.latest.toLocaleString('en-IN') : '—'} /{' '}
                      {k.target.toLocaleString('en-IN')}{' '}
                      {k.pct !== null && (
                        <span className={k.pct >= 100 ? 'font-semibold text-green-600' : 'text-slate-500'}>({k.pct}%)</span>
                      )}
                    </p>
                  ))}
                </td>
                <td className="py-2 text-slate-600">{c.optimizations}</td>
                <td className="py-2">
                  {c.reportCompiled ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">compiled</span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">pending</span>
                  )}
                </td>
              </tr>
            ))}
            {marketing.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-slate-400">No campaigns yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6">
        {/* Delivery (FR-9.3) */}
        <div className={CARD}>
          <h2 className="font-semibold text-slate-900">Delivery — task turnaround</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Deadline vs done-at from status history (FR-9.3) · overall on-time {onTimePct}%.
          </p>
          <table className="mt-3 w-full text-sm">
            <thead className={THEAD}>
              <tr>
                <th className="py-1">Department</th>
                <th>On time</th>
                <th>Late</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {delivery.map((d) => (
                <tr key={d.id}>
                  <td className="py-1.5 text-slate-800">{d.name}</td>
                  <td className="text-green-700">{d.onTime}</td>
                  <td className={d.late > 0 ? 'font-semibold text-red-600' : 'text-slate-600'}>{d.late}</td>
                  <td className="text-slate-600">{d.open}</td>
                </tr>
              ))}
              {delivery.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-slate-400">No departments configured.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* HR (FR-9.4) */}
        <div className={CARD}>
          <h2 className="font-semibold text-slate-900">HR — headcount & leave</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Open requisitions {data.requisitions} · exits {data.exits} · leave utilization {leaveUtilization}% ({usedLeave}/{availableLeave} days) (FR-9.4).
          </p>
          <table className="mt-3 w-full text-sm">
            <thead className={THEAD}>
              <tr>
                <th className="py-1">Department</th>
                <th>Active headcount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {headcountByDept.map((d) => (
                <tr key={d.id}>
                  <td className="py-1.5 text-slate-800">{d.name}</td>
                  <td className="text-slate-600">{d.headcount}</td>
                </tr>
              ))}
              {unassignedHeadcount > 0 && (
                <tr>
                  <td className="py-1.5 text-slate-800">No department</td>
                  <td className="text-slate-600">{unassignedHeadcount}</td>
                </tr>
              )}
              {headcountByDept.length === 0 && unassignedHeadcount === 0 && (
                <tr><td colSpan={2} className="py-4 text-center text-slate-400">No employees yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Retention (FR-9.5) */}
      <div className={`mt-6 ${CARD}`}>
        <h2 className="font-semibold text-slate-900">Retention</h2>
        <p className="mt-0.5 text-xs text-slate-400">Renewal outcomes, churn flags and health (FR-9.5).</p>
        <div className="mt-3 grid grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-bold text-slate-900">{renewalRate !== null ? `${renewalRate}%` : '—'}</p>
            <p className="mt-1 text-sm text-slate-500">Renewal rate ({renewed} renewed / {lost} lost)</p>
          </div>
          <div>
            <p className={`text-2xl font-bold ${data.churnFlagsOpen > 0 ? 'text-red-600' : 'text-slate-900'}`}>{data.churnFlagsOpen}</p>
            <p className="mt-1 text-sm text-slate-500">Open churn flags</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{avgHealth ?? '—'}</p>
            <p className="mt-1 text-sm text-slate-500">Avg latest health score</p>
          </div>
        </div>
      </div>
    </div>
  )
}
