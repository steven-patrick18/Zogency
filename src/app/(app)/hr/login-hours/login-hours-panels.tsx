'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import {
  requestAttendanceCreditAction,
  saveAttendancePolicyAction,
  type HrActionState,
} from '@/modules/hr/actions'

const field = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'

export function AttendancePolicyForm({
  minHours,
  halfHours,
  idleMin,
}: {
  minHours: number
  halfHours: number
  idleMin: number
}) {
  const [state, formAction, pending] = useActionState<HrActionState, FormData>(saveAttendancePolicyAction, {})
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4">
      <label className="text-xs font-medium text-slate-500">
        Full-attendance productive hours
        <input name="minProductiveHours" type="number" step="0.5" min={0} defaultValue={minHours} className={`${field} mt-1 block w-28`} />
      </label>
      <label className="text-xs font-medium text-slate-500">
        Half-day productive hours
        <input name="halfDayHours" type="number" step="0.5" min={0} defaultValue={halfHours} className={`${field} mt-1 block w-28`} />
      </label>
      <label className="text-xs font-medium text-slate-500">
        Agent auto-logout after (idle min)
        <input name="agentIdleLogoutMin" type="number" min={1} defaultValue={idleMin} className={`${field} mt-1 block w-32`} />
      </label>
      <button disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
        {pending ? 'Saving…' : 'Save policy'}
      </button>
      {state.success && <span className="text-xs text-green-700">{state.success}</span>}
    </form>
  )
}

// Inline "grant credit" form for a short employee (creates a pending request).
export function CreditRequestForm({ employeeId, date, shortHours }: { employeeId: string; date: string; shortHours: number }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<HrActionState, FormData>(requestAttendanceCreditAction, {})
  if (state.success) return <span className="text-xs text-green-700">Requested</span>
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs font-medium text-indigo-600 hover:underline">
        Grant credit
      </button>
    )
  }
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-1">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="date" value={date} />
      <input name="hours" type="number" step="0.5" min={0.5} defaultValue={Math.max(0.5, Math.round(shortHours * 2) / 2)} className="w-16 rounded border border-slate-300 px-1.5 py-1 text-xs" title="Hours" />
      <input name="reason" placeholder="reason" className="w-28 rounded border border-slate-300 px-1.5 py-1 text-xs" />
      <button disabled={pending} className="rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">
        {pending ? '…' : 'Request'}
      </button>
    </form>
  )
}
