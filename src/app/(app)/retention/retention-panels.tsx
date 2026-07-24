'use client'

import { useActionState } from 'react'
import {
  addCheckinAction,
  addRenewalAction,
  addServiceAction,
  addUpsellAction,
  holdCheckinAction,
  moveUpsellAction,
  renewalStatusAction,
  resolveChurnFlagAction,
  type RetentionActionState,
} from '@/modules/retention/actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'
const primaryBtn =
  'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50'

function Feedback({ state }: { state: RetentionActionState }) {
  if (state.error) return <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>
  if (state.success) return <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">{state.success}</p>
  return null
}

export type ClientOption = { id: string; name: string }

function ClientSelect({ clients, name = 'clientId' }: { clients: ClientOption[]; name?: string }) {
  return (
    <select name={name} required defaultValue="" className={field}>
      <option value="" disabled>
        Client…
      </option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  )
}

// ── Renewals (FR-7.2) ───────────────────────────────────────────────────────

export type RenewalItem = {
  id: string
  clientName: string
  renewalOn: string
  daysLeft: number
  value: number
  contractRef: string | null
  status: string
  triggersFired: number[]
}

const RENEWAL_STATUS_STYLES: Record<string, string> = {
  upcoming: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-amber-100 text-amber-700',
  renewed: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
}

export function RenewalsPanel({ clients, renewals }: { clients: ClientOption[]; renewals: RenewalItem[] }) {
  const [addState, addAction, addPending] = useActionState<RetentionActionState, FormData>(addRenewalAction, {})
  const [statusState, statusAction, statusPending] = useActionState<RetentionActionState, FormData>(renewalStatusAction, {})

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Renewals</h2>
      <p className="mt-0.5 text-xs text-slate-400">
        Contract renewals with 60/30/15-day outreach triggers (FR-7.2).
      </p>

      <form action={addAction} className="mt-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <ClientSelect clients={clients} />
          <input name="renewalOn" type="date" required className={field} title="Renewal date" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input name="value" type="number" step="0.01" min="0" required placeholder="Contract value ₹ *" className={field} />
          <input name="contractRef" placeholder="Contract ref" className={field} />
        </div>
        <Feedback state={addState} />
        <button disabled={addPending} className={primaryBtn}>{addPending ? 'Tracking…' : 'Track renewal'}</button>
      </form>

      <Feedback state={statusState} />
      <table className="mt-4 w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="py-1">Client</th>
            <th>Renewal on</th>
            <th>Days left</th>
            <th>Value</th>
            <th>Triggers</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {renewals.map((r) => (
            <tr key={r.id}>
              <td className="py-2 font-medium text-slate-900">
                {r.clientName}
                {r.contractRef && <span className="font-normal text-slate-400"> · {r.contractRef}</span>}
              </td>
              <td className="text-slate-600">{r.renewalOn}</td>
              <td className={r.status === 'renewed' || r.status === 'lost' ? 'text-slate-400' : r.daysLeft <= 15 ? 'font-semibold text-red-600' : r.daysLeft <= 30 ? 'font-semibold text-amber-600' : 'text-slate-600'}>
                {r.daysLeft}d
              </td>
              <td className="text-slate-600">₹{r.value.toLocaleString('en-IN')}</td>
              <td>
                {r.triggersFired.length === 0 && <span className="text-xs text-slate-400">—</span>}
                {r.triggersFired.map((t) => (
                  <span key={t} className="mr-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    {t}d
                  </span>
                ))}
              </td>
              <td>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RENEWAL_STATUS_STYLES[r.status] ?? 'bg-slate-100 text-slate-600'}`}>
                  {r.status.replace('_', ' ')}
                </span>
              </td>
              <td className="text-right">
                {(r.status === 'upcoming' || r.status === 'in_progress') && (
                  <form action={statusAction} className="inline-flex gap-1">
                    <input type="hidden" name="renewalId" value={r.id} />
                    <button name="status" value="renewed" disabled={statusPending} className="rounded bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-50">
                      Renewed
                    </button>
                    <button name="status" value="lost" disabled={statusPending} className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50">
                      Lost
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
          {renewals.length === 0 && (
            <tr>
              <td colSpan={7} className="py-4 text-center text-slate-400">No renewals tracked yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Check-ins (FR-7.1) ──────────────────────────────────────────────────────

export type CheckinItem = {
  id: string
  clientName: string
  scheduledAt: string
  held: boolean
  notes: string | null
}

function HoldCheckinForm({ checkinId }: { checkinId: string }) {
  const [state, formAction, pending] = useActionState<RetentionActionState, FormData>(holdCheckinAction, {})
  return (
    <form action={formAction} className="mt-2 space-y-2">
      <input type="hidden" name="checkinId" value={checkinId} />
      <div className="flex items-center gap-2">
        <input name="notes" required placeholder="What was discussed *" className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs" />
        <button disabled={pending} className="rounded border border-indigo-300 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">
          {pending ? 'Logging…' : 'Mark held'}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  )
}

export function CheckinsPanel({ clients, checkins }: { clients: ClientOption[]; checkins: CheckinItem[] }) {
  const [state, formAction, pending] = useActionState<RetentionActionState, FormData>(addCheckinAction, {})

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Relationship check-ins</h2>
      <p className="mt-0.5 text-xs text-slate-400">Scheduled touchpoints with held notes (FR-7.1).</p>

      <form action={formAction} className="mt-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <ClientSelect clients={clients} />
          <input name="scheduledAt" type="datetime-local" required className={field} title="Scheduled at" />
        </div>
        <Feedback state={state} />
        <button disabled={pending} className={primaryBtn}>{pending ? 'Scheduling…' : 'Schedule check-in'}</button>
      </form>

      <ul className="mt-3 space-y-2">
        {checkins.map((c) => (
          <li key={c.id} className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-900">{c.clientName}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.held ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {c.held ? 'held' : 'scheduled'}
              </span>
            </div>
            <p className="text-xs text-slate-400">{c.scheduledAt}</p>
            {c.held && c.notes && <p className="mt-1 text-slate-600">{c.notes}</p>}
            {!c.held && <HoldCheckinForm checkinId={c.id} />}
          </li>
        ))}
        {checkins.length === 0 && <p className="text-sm text-slate-400">No check-ins yet.</p>}
      </ul>
    </div>
  )
}

// ── Churn flags (FR-7.4) ────────────────────────────────────────────────────

export type ChurnFlagItem = {
  id: string
  clientName: string
  reason: string
  severity: string
  at: string
}

export function ChurnFlagsPanel({ flags }: { flags: ChurnFlagItem[] }) {
  const [state, formAction, pending] = useActionState<RetentionActionState, FormData>(resolveChurnFlagAction, {})

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Churn flags</h2>
      <p className="mt-0.5 text-xs text-slate-400">Raised on red health or two consecutive ambers (FR-7.4).</p>
      <Feedback state={state} />
      <ul className="mt-3 space-y-2">
        {flags.map((f) => (
          <li key={f.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm">
            <div>
              <p className="font-medium text-slate-900">
                {f.clientName}{' '}
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${f.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {f.severity}
                </span>
              </p>
              <p className="text-slate-600">{f.reason}</p>
              <p className="mt-1 text-xs text-slate-400">{f.at}</p>
            </div>
            <form action={formAction}>
              <input type="hidden" name="flagId" value={f.id} />
              <button disabled={pending} className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-50">
                Resolve
              </button>
            </form>
          </li>
        ))}
        {flags.length === 0 && <p className="text-sm text-slate-400">No open churn flags.</p>}
      </ul>
    </div>
  )
}

// ── Upsells (FR-7.5) ────────────────────────────────────────────────────────

export type ServiceOption = { id: string; name: string; priceBand: string | null }
export type UpsellItem = {
  id: string
  clientName: string
  serviceName: string
  stage: string
  value: number | null
}

const UPSELL_STAGE_STYLES: Record<string, string> = {
  idea: 'bg-slate-100 text-slate-600',
  proposed: 'bg-blue-100 text-blue-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
}

const UPSELL_NEXT_STAGES: Record<string, string[]> = {
  idea: ['proposed'],
  proposed: ['won', 'lost'],
}

export function UpsellsPanel({
  clients,
  services,
  upsells,
}: {
  clients: ClientOption[]
  services: ServiceOption[]
  upsells: UpsellItem[]
}) {
  const [addState, addAction, addPending] = useActionState<RetentionActionState, FormData>(addUpsellAction, {})
  const [moveState, moveAction, movePending] = useActionState<RetentionActionState, FormData>(moveUpsellAction, {})

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Upsell opportunities</h2>
      <p className="mt-0.5 text-xs text-slate-400">Cross-sell / upsell pipeline from the service catalogue (FR-7.5).</p>

      <form action={addAction} className="mt-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <ClientSelect clients={clients} />
          <select name="serviceId" required defaultValue="" className={field}>
            <option value="" disabled>
              Service…
            </option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.priceBand ? ` (${s.priceBand})` : ''}
              </option>
            ))}
          </select>
        </div>
        <input name="value" type="number" step="0.01" min="0" placeholder="Estimated value ₹" className={field} />
        <Feedback state={addState} />
        <button disabled={addPending} className={primaryBtn}>{addPending ? 'Tracking…' : 'Track upsell'}</button>
      </form>

      <Feedback state={moveState} />
      <ul className="mt-3 space-y-2">
        {upsells.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm">
            <div>
              <p className="font-medium text-slate-900">
                {u.clientName} <span className="font-normal text-slate-500">· {u.serviceName}</span>
              </p>
              <p className="text-xs text-slate-500">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${UPSELL_STAGE_STYLES[u.stage] ?? 'bg-slate-100 text-slate-600'}`}>
                  {u.stage}
                </span>
                {u.value !== null && <span className="ml-2">₹{u.value.toLocaleString('en-IN')}</span>}
              </p>
            </div>
            {(UPSELL_NEXT_STAGES[u.stage] ?? []).length > 0 && (
              <form action={moveAction} className="flex gap-1">
                <input type="hidden" name="upsellId" value={u.id} />
                {(UPSELL_NEXT_STAGES[u.stage] ?? []).map((next) => (
                  <button
                    key={next}
                    name="stage"
                    value={next}
                    disabled={movePending}
                    className={`rounded px-2 py-1 text-xs font-semibold text-white disabled:opacity-50 ${
                      next === 'lost' ? 'bg-red-600 hover:bg-red-500' : next === 'won' ? 'bg-green-600 hover:bg-green-500' : 'bg-indigo-600 hover:bg-indigo-500'
                    }`}
                  >
                    Mark {next}
                  </button>
                ))}
              </form>
            )}
          </li>
        ))}
        {upsells.length === 0 && <p className="text-sm text-slate-400">No upsell opportunities tracked.</p>}
      </ul>
    </div>
  )
}

// ── Service catalogue (FR-7.5) ──────────────────────────────────────────────

export function ServiceCataloguePanel({ services, canManage }: { services: ServiceOption[]; canManage: boolean }) {
  const [state, formAction, pending] = useActionState<RetentionActionState, FormData>(addServiceAction, {})

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Service catalogue</h2>
      <p className="mt-0.5 text-xs text-slate-400">Feeds upsell opportunities and SoW service lines (FR-7.5).</p>
      <ul className="mt-3 space-y-1">
        {services.map((s) => (
          <li key={s.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="font-medium text-slate-900">{s.name}</span>
            <span className="text-slate-500">{s.priceBand ?? '—'}</span>
          </li>
        ))}
        {services.length === 0 && <p className="text-sm text-slate-400">No services in the catalogue yet.</p>}
      </ul>
      {canManage && (
        <form action={formAction} className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input name="name" required placeholder="Service name *" className={field} />
            <input name="priceBand" placeholder="Price band (e.g. ₹50k–1L/mo)" className={field} />
          </div>
          <Feedback state={state} />
          <button disabled={pending} className={primaryBtn}>{pending ? 'Adding…' : 'Add service'}</button>
        </form>
      )}
    </div>
  )
}
