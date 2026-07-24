'use client'

import { useActionState } from 'react'
import {
  decideLeaveAction,
  punchAction,
  requestLeaveAction,
  type HrActionState,
} from '@/modules/hr/actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'
const primaryBtn =
  'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50'

function Feedback({ state }: { state: HrActionState }) {
  if (state.error) return <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>
  if (state.success) return <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">{state.success}</p>
  return null
}

export function PunchPanel() {
  const [state, formAction, pending] = useActionState<HrActionState, FormData>(punchAction, {})
  return (
    <form action={formAction} className="space-y-2">
      <div className="flex gap-2">
        <button name="mode" value="office" disabled={pending} className={primaryBtn}>
          {pending ? 'Punching…' : 'Punch (office)'}
        </button>
        <button name="mode" value="wfh" disabled={pending} className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">
          Punch (WFH)
        </button>
      </div>
      <p className="text-xs text-slate-400">First punch of the day is in, the second is out (FR-4.8).</p>
      <Feedback state={state} />
    </form>
  )
}

export function LeaveRequestForm({ types }: { types: Array<{ id: string; name: string }> }) {
  const [state, formAction, pending] = useActionState<HrActionState, FormData>(requestLeaveAction, {})
  return (
    <form action={formAction} className="space-y-2">
      <select name="typeId" required className={field} defaultValue="">
        <option value="" disabled>Leave type *</option>
        {types.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input name="fromOn" type="date" required className={field} title="From" />
        <input name="toOn" type="date" required className={field} title="To" />
      </div>
      <input name="reason" required placeholder="Reason *" className={field} />
      <Feedback state={state} />
      <button disabled={pending} className={primaryBtn}>{pending ? 'Requesting…' : 'Request leave'}</button>
    </form>
  )
}

export type PendingLeave = {
  id: string
  employee: string
  type: string
  fromOn: string
  toOn: string
  days: number
  reason: string
}

export function LeaveDecisionsPanel({ pending }: { pending: PendingLeave[] }) {
  const [state, formAction, isPending] = useActionState<HrActionState, FormData>(decideLeaveAction, {})
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Pending leave approvals</h2>
      <p className="mt-0.5 text-xs text-slate-400">Approval deducts the balance (FR-4.9, FR-4.10).</p>
      <Feedback state={state} />
      <ul className="mt-3 space-y-3">
        {pending.map((r) => (
          <li key={r.id} className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-900">
              {r.employee} — {r.type} · {r.days} day(s)
            </p>
            <p className="text-slate-600">{r.fromOn} → {r.toOn} · {r.reason}</p>
            <form action={formAction} className="mt-2 flex gap-2">
              <input type="hidden" name="requestId" value={r.id} />
              <button name="decision" value="approved" disabled={isPending} className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-50">
                Approve
              </button>
              <button name="decision" value="rejected" disabled={isPending} className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50">
                Reject
              </button>
            </form>
          </li>
        ))}
        {pending.length === 0 && <p className="text-sm text-slate-400">No pending requests.</p>}
      </ul>
    </div>
  )
}
