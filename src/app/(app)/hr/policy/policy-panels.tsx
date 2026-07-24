'use client'

import { useActionState } from 'react'
import {
  addHolidayAction,
  deleteLeaveTypeAction,
  saveLeaveTypeAction,
  type HrActionState,
} from '@/modules/hr/actions'

const field =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'

function Feedback({ state }: { state: HrActionState }) {
  if (state.error) return <p className="w-full rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>
  if (state.success) return <p className="w-full rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">{state.success}</p>
  return null
}

// Inline edit + delete for an existing leave type (hr.manage only).
export function LeaveTypeRow({
  typeId,
  name,
  annualQuota,
  carryForward,
  covered,
}: {
  typeId: string
  name: string
  annualQuota: number
  carryForward: boolean
  covered: number
}) {
  const [state, formAction, pending] = useActionState<HrActionState, FormData>(saveLeaveTypeAction, {})
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 py-2 text-sm">
      <span className="w-36 font-medium text-slate-800">{name}</span>
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        {/* name is the upsert key — editing quota/carry-forward for this type */}
        <input type="hidden" name="name" value={name} />
        <input
          name="annualQuota"
          type="number"
          min={0}
          defaultValue={annualQuota}
          className="w-16 rounded-lg border border-slate-300 px-2 py-1"
          title="Annual quota (days)"
        />
        <span className="text-xs text-slate-400">days</span>
        <label className="flex items-center gap-1 text-xs text-slate-600">
          <input type="checkbox" name="carryForward" defaultChecked={carryForward} className="rounded" />
          carry fwd
        </label>
        <span className="text-xs text-slate-400">· {covered} covered</span>
        <button
          disabled={pending}
          className="rounded-lg border border-indigo-300 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
        >
          {pending ? '…' : 'Save'}
        </button>
      </form>
      <form action={deleteLeaveTypeAction} className="inline">
        <input type="hidden" name="typeId" value={typeId} />
        <button className="text-xs font-medium text-red-500 hover:underline">Delete</button>
      </form>
      {state.error && <span className="w-full text-xs text-red-600">{state.error}</span>}
    </div>
  )
}

export function LeaveTypeForm() {
  const [state, formAction, pending] = useActionState<HrActionState, FormData>(saveLeaveTypeAction, {})
  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-center gap-2">
      <input name="name" required placeholder="Type (e.g. Maternity Leave)" className={`${field} w-52`} />
      <input name="annualQuota" type="number" min={0} required placeholder="Days/yr" className={`${field} w-24`} />
      <label className="flex items-center gap-1.5 text-sm text-slate-700">
        <input type="checkbox" name="carryForward" className="rounded" /> Carry forward
      </label>
      <button
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save policy'}
      </button>
      <Feedback state={state} />
    </form>
  )
}

export function HolidayForm() {
  const [state, formAction, pending] = useActionState<HrActionState, FormData>(addHolidayAction, {})
  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
      <input name="date" type="date" required className={field} />
      <input name="name" required placeholder="Holiday name (e.g. Diwali)" className={`${field} w-52`} />
      <button
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? 'Adding…' : 'Add holiday'}
      </button>
      <Feedback state={state} />
    </form>
  )
}
