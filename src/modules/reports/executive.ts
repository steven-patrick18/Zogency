// Executive (CEO) briefing — deep, period-filtered cross-functional analytics
// computed live: revenue & pipeline, sales funnel/conversion, cash & finance,
// client portfolio, and people/productivity. BRB scale → in-memory aggregation.
import { prisma } from '@/lib/db/prisma'

export type Period = 'month' | 'quarter' | 'year' | 'all'
const PERIODS: Period[] = ['month', 'quarter', 'year', 'all']
export function parsePeriod(v: string | undefined): Period {
  return (PERIODS as string[]).includes(v ?? '') ? (v as Period) : 'month'
}
const PERIOD_LABEL: Record<Period, string> = {
  month: 'This month',
  quarter: 'This quarter',
  year: 'This year',
  all: 'All time',
}

const num = (v: unknown) => Number(v ?? 0)
const monthStart = (y: number, m: number) => new Date(y, m, 1)

function periodRange(period: Period, now: Date) {
  const y = now.getFullYear()
  const m = now.getMonth()
  let start: Date
  let prevStart: Date
  let prevEnd: Date
  if (period === 'month') {
    start = monthStart(y, m)
    prevStart = monthStart(y, m - 1)
    prevEnd = start
  } else if (period === 'quarter') {
    const q = Math.floor(m / 3) * 3
    start = monthStart(y, q)
    prevStart = monthStart(y, q - 3)
    prevEnd = start
  } else if (period === 'year') {
    start = monthStart(y, 0)
    prevStart = monthStart(y - 1, 0)
    prevEnd = start
  } else {
    start = new Date(0)
    prevStart = new Date(0)
    prevEnd = new Date(0)
  }
  return { start, prevStart, prevEnd }
}

const pctDelta = (curr: number, prev: number): number | null =>
  prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null

export type ExecutiveReport = Awaited<ReturnType<typeof getExecutiveReport>>

export async function getExecutiveReport(period: Period) {
  const now = new Date()
  const { start, prevStart, prevEnd } = periodRange(period, now)

  // Trailing 6 calendar months for the trend chart (independent of the filter).
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = monthStart(now.getFullYear(), now.getMonth() - (5 - i))
    const e = monthStart(now.getFullYear(), now.getMonth() - (5 - i) + 1)
    return { start: d, end: e, label: d.toLocaleString('en-IN', { month: 'short' }) }
  })

  const [deals, leadsInPeriod, invoices, payments, clients, health, renewals, attendance, headcount] =
    await Promise.all([
      prisma.deal.findMany({ select: { stage: true, value: true, wonAt: true, createdAt: true } }),
      prisma.lead.count({ where: { createdAt: { gte: start }, archivedAt: null } }),
      prisma.invoice.findMany({ select: { id: true, total: true, status: true, issueOn: true, dueOn: true, clientId: true } }),
      prisma.payment.findMany({ select: { amount: true, receivedOn: true, invoiceId: true, invoice: { select: { clientId: true } } } }),
      prisma.client.findMany({ where: { archivedAt: null }, select: { id: true, name: true, status: true } }),
      prisma.clientHealthScore.findMany({ orderBy: { computedAt: 'desc' }, select: { clientId: true, score: true } }),
      prisma.renewal.findMany({ select: { renewalOn: true, value: true, status: true } }),
      prisma.attendanceRecord.findMany({ where: { date: { gte: start } }, select: { productiveMinutes: true, creditMinutes: true, status: true } }),
      prisma.employee.count({ where: { status: { not: 'exited' } } }),
    ])

  // ── Revenue & pipeline ────────────────────────────────────────────────────
  const inPeriod = (d: Date | null) => !!d && d >= start
  const revenueWon = deals.filter((d) => d.stage === 'won' && inPeriod(d.wonAt)).reduce((s, d) => s + num(d.value), 0)
  const revenuePrev =
    period === 'all'
      ? 0
      : deals.filter((d) => d.stage === 'won' && d.wonAt && d.wonAt >= prevStart && d.wonAt < prevEnd).reduce((s, d) => s + num(d.value), 0)
  // Weighted forecast: probability by stage.
  const PROB: Record<string, number> = { open: 0.3, verbal_commit: 0.7 }
  const openDeals = deals.filter((d) => d.stage === 'open' || d.stage === 'verbal_commit')
  const forecast = Math.round(openDeals.reduce((s, d) => s + num(d.value) * (PROB[d.stage] ?? 0), 0))
  const pipelineValue = openDeals.reduce((s, d) => s + num(d.value), 0)

  const revenueTrend = months.map((mo) => ({
    label: mo.label,
    value: deals.filter((d) => d.stage === 'won' && d.wonAt && d.wonAt >= mo.start && d.wonAt < mo.end).reduce((s, d) => s + num(d.value), 0),
  }))

  // ── Sales funnel & conversion ─────────────────────────────────────────────
  const dealsCreated = deals.filter((d) => inPeriod(d.createdAt)).length
  const dealsWon = deals.filter((d) => d.stage === 'won' && inPeriod(d.wonAt)).length
  const funnel = {
    leads: leadsInPeriod,
    deals: dealsCreated,
    won: dealsWon,
    leadToDeal: leadsInPeriod > 0 ? Math.round((dealsCreated / leadsInPeriod) * 100) : null,
    dealToWon: dealsCreated > 0 ? Math.round((dealsWon / dealsCreated) * 100) : null,
    leadToWon: leadsInPeriod > 0 ? Math.round((dealsWon / leadsInPeriod) * 100) : null,
  }

  // ── Cash & finance ────────────────────────────────────────────────────────
  const collected = payments.filter((p) => p.receivedOn >= start).reduce((s, p) => s + num(p.amount), 0)
  const collectedPrev =
    period === 'all' ? 0 : payments.filter((p) => p.receivedOn >= prevStart && p.receivedOn < prevEnd).reduce((s, p) => s + num(p.amount), 0)
  const billed = invoices.filter((i) => i.issueOn >= start).reduce((s, i) => s + num(i.total), 0)
  const paidByInvoice = new Map<string, number>()
  for (const p of payments) paidByInvoice.set(p.invoiceId, (paidByInvoice.get(p.invoiceId) ?? 0) + num(p.amount))
  const DAY = 86_400_000
  const aging = { current: 0, d0_30: 0, d31_60: 0, d60plus: 0 }
  let outstanding = 0
  for (const inv of invoices) {
    if (inv.status === 'paid') continue
    const remaining = num(inv.total) - (paidByInvoice.get(inv.id) ?? 0)
    if (remaining <= 0) continue
    outstanding += remaining
    const overdueDays = Math.floor((now.getTime() - inv.dueOn.getTime()) / DAY)
    if (overdueDays <= 0) aging.current += remaining
    else if (overdueDays <= 30) aging.d0_30 += remaining
    else if (overdueDays <= 60) aging.d31_60 += remaining
    else aging.d60plus += remaining
  }

  // ── Client portfolio ──────────────────────────────────────────────────────
  const activeClients = clients.filter((c) => c.status === 'active').length
  const latestHealth = new Map<string, number>()
  for (const h of health) if (!latestHealth.has(h.clientId)) latestHealth.set(h.clientId, h.score)
  const healthMix = { green: 0, amber: 0, red: 0 }
  for (const score of latestHealth.values()) {
    if (score >= 70) healthMix.green++
    else if (score >= 40) healthMix.amber++
    else healthMix.red++
  }
  const in90 = new Date(now.getTime() + 90 * DAY)
  const in30 = new Date(now.getTime() + 30 * DAY)
  const dueRenewals = renewals.filter((r) => (r.status === 'upcoming' || r.status === 'in_progress') && r.renewalOn >= now && r.renewalOn <= in90)
  const renewalsDue = {
    count90: dueRenewals.length,
    value90: dueRenewals.reduce((s, r) => s + num(r.value), 0),
    count30: dueRenewals.filter((r) => r.renewalOn <= in30).length,
  }
  const clientName = new Map(clients.map((c) => [c.id, c.name]))
  const revByClient = new Map<string, number>()
  for (const p of payments) {
    const cid = p.invoice?.clientId
    if (cid) revByClient.set(cid, (revByClient.get(cid) ?? 0) + num(p.amount))
  }
  const topClients = [...revByClient.entries()]
    .map(([id, value]) => ({ name: clientName.get(id) ?? '—', value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  // ── People & productivity ─────────────────────────────────────────────────
  const marked = attendance.filter((a) => a.status)
  const present = marked.filter((a) => a.status === 'present').length
  const half = marked.filter((a) => a.status === 'half_day').length
  const attendanceRate = marked.length > 0 ? Math.round(((present + half * 0.5) / marked.length) * 100) : null
  const productiveMins = attendance.reduce((s, a) => s + a.productiveMinutes + a.creditMinutes, 0)
  const daysWithActivity = attendance.filter((a) => a.productiveMinutes > 0).length
  const avgProductiveHrs = daysWithActivity > 0 ? productiveMins / daysWithActivity / 60 : null

  return {
    period,
    periodLabel: PERIOD_LABEL[period],
    revenue: { won: revenueWon, deltaPct: pctDelta(revenueWon, revenuePrev), forecast, pipelineValue, trend: revenueTrend },
    funnel,
    finance: { billed, collected, collectedDeltaPct: pctDelta(collected, collectedPrev), outstanding, aging },
    clients: { active: activeClients, healthMix, renewalsDue, topClients },
    people: { headcount, attendanceRate, avgProductiveHrs },
  }
}
