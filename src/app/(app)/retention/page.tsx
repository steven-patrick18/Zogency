// Retention & renewal workspace (FR-7.1–7.6, doc 07 §5): health overview,
// renewals with outreach triggers, check-ins, churn flags, upsells, catalogue.
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { maybeRunRenewalSweep } from '@/modules/retention/service'
import {
  CheckinsPanel,
  ChurnFlagsPanel,
  RenewalsPanel,
  ServiceCataloguePanel,
  UpsellsPanel,
} from './retention-panels'

const BAND_STYLES: Record<string, string> = {
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
}

type HealthComponents = { payments?: number; approvals?: number; survey?: number }

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000)
}

export default async function RetentionPage() {
  const session = await requirePermission('clients.view')
  const canManageCatalogue = session.user.permissions.includes('settings.manage')

  const data = await withTenant(async () => {
    // Opportunistic dev-mode sweep: fires 60/30/15-day triggers + recomputes
    // health scores (worker cron in production).
    await maybeRunRenewalSweep()

    const [clients, renewals, healthScores, churnFlags, checkins, upsells, services] = await Promise.all([
      prisma.client.findMany({ where: { archivedAt: null }, orderBy: { name: 'asc' } }),
      prisma.renewal.findMany({ orderBy: { renewalOn: 'asc' } }),
      prisma.clientHealthScore.findMany({ orderBy: { computedAt: 'desc' } }),
      prisma.churnFlag.findMany({ where: { resolvedAt: null }, orderBy: { createdAt: 'desc' } }),
      prisma.clientCheckin.findMany({ orderBy: { scheduledAt: 'asc' } }),
      prisma.upsellOpportunity.findMany({ include: { service: true }, orderBy: { createdAt: 'desc' } }),
      prisma.serviceCatalogItem.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    ])
    return { clients, renewals, healthScores, churnFlags, checkins, upsells, services }
  })

  const clientName = new Map(data.clients.map((c) => [c.id, c.name]))
  const activeClients = data.clients.filter((c) => c.status === 'active')
  const clientOptions = activeClients.map((c) => ({ id: c.id, name: c.name }))

  // Latest health score per client (append-only table, ordered desc above).
  const latestHealth = new Map<string, (typeof data.healthScores)[number]>()
  for (const hs of data.healthScores) {
    if (!latestHealth.has(hs.clientId)) latestHealth.set(hs.clientId, hs)
  }

  const renewals = data.renewals.map((r) => ({
    id: r.id,
    clientName: clientName.get(r.clientId) ?? '—',
    renewalOn: r.renewalOn.toLocaleDateString(),
    daysLeft: daysUntil(r.renewalOn),
    value: Number(r.value),
    contractRef: r.contractRef,
    status: r.status,
    triggersFired: (r.triggersFired as number[] | null) ?? [],
  }))

  const checkins = data.checkins.map((c) => ({
    id: c.id,
    clientName: clientName.get(c.clientId) ?? '—',
    scheduledAt: c.scheduledAt.toLocaleString(),
    held: !!c.heldAt,
    notes: c.notes,
  }))

  const churnFlags = data.churnFlags.map((f) => ({
    id: f.id,
    clientName: clientName.get(f.clientId) ?? '—',
    reason: f.reason,
    severity: f.severity,
    at: f.createdAt.toLocaleString(),
  }))

  const upsells = data.upsells.map((u) => ({
    id: u.id,
    clientName: clientName.get(u.clientId) ?? '—',
    serviceName: u.service.name,
    stage: u.stage,
    value: u.value !== null ? Number(u.value) : null,
  }))

  const services = data.services.map((s) => ({ id: s.id, name: s.name, priceBand: s.priceBand }))

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-slate-900">Retention & renewals</h1>
      <p className="mt-1 text-sm text-slate-500">
        Health scores, renewal triggers, check-ins and upsells (FR-7.1–7.6).
      </p>

      {/* Health overview (FR-7.3) — server-rendered, no interactivity. */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Client health overview</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          payments 40% + approvals 30% + satisfaction 30% · green ≥70, amber 40–69, red &lt;40 (FR-7.3)
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {activeClients.map((c) => {
            const hs = latestHealth.get(c.id)
            const comps = (hs?.components as HealthComponents | null) ?? {}
            return (
              <div key={c.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-medium text-slate-900">{c.name}</p>
                  {hs ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BAND_STYLES[hs.band] ?? 'bg-slate-100 text-slate-600'}`}>
                      {hs.band}
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">n/a</span>
                  )}
                </div>
                {hs ? (
                  <>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{hs.score}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      payments {comps.payments ?? '—'} · approvals {comps.approvals ?? '—'} · survey {comps.survey ?? '—'}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">Not computed yet.</p>
                )}
              </div>
            )
          })}
          {activeClients.length === 0 && <p className="text-sm text-slate-400">No active clients.</p>}
        </div>
      </div>

      <div className="mt-6">
        <RenewalsPanel clients={clientOptions} renewals={renewals} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6">
        <div className="space-y-6">
          <CheckinsPanel clients={clientOptions} checkins={checkins} />
          <ChurnFlagsPanel flags={churnFlags} />
        </div>
        <div className="space-y-6">
          <UpsellsPanel clients={clientOptions} services={services} upsells={upsells} />
          <ServiceCataloguePanel services={services} canManage={canManageCatalogue} />
        </div>
      </div>
    </div>
  )
}
