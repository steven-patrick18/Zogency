'use client'

import { useActionState, useState } from 'react'
import {
  addHolidayAction,
  deleteLeaveTypeAction,
  saveLeavePolicyAction,
  saveLeaveTypeAction,
  type HrActionState,
} from '@/modules/hr/actions'

const field =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'
const mini = 'w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm'

function Feedback({ state }: { state: HrActionState }) {
  if (state.error) return <p className="w-full rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>
  if (state.success) return <p className="w-full rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">{state.success}</p>
  return null
}

const WOFF_LABEL: Record<string, string> = {
  allowed: 'Allowed next to weekly-off',
  limited1: 'Max 1 day next to weekly-off',
  forbidden: 'Never next to weekly-off',
}

export type LeaveTypeData = {
  id: string
  name: string
  code: string | null
  annualQuota: number
  carryForwardMax: number
  accrualPerMonth: number
  maxConsecutive: number
  woffAdjacency: string
  standaloneOnly: boolean
  clubbableWithLeave: boolean
  encashable: boolean
  requiresConfirmation: boolean
  requiresRestrictedHoliday: boolean
  covered: number
}

// Compact summary of a leave type's rules, expandable into the full editor.
export function LeaveTypeRow({ t }: { t: LeaveTypeData }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<HrActionState, FormData>(saveLeaveTypeAction, {})

  const chips: string[] = [`${t.annualQuota}/yr`]
  if (t.accrualPerMonth) chips.push(`+${t.accrualPerMonth}/mo`)
  if (t.carryForwardMax) chips.push(`carry ≤${t.carryForwardMax}`)
  else chips.push('no carry')
  if (t.maxConsecutive) chips.push(`≤${t.maxConsecutive} at a time`)
  if (t.standaloneOnly) chips.push('standalone')
  if (!t.clubbableWithLeave) chips.push('no clubbing')
  if (t.requiresRestrictedHoliday) chips.push('restricted-holiday only')
  if (t.woffAdjacency !== 'allowed') chips.push(WOFF_LABEL[t.woffAdjacency])

  return (
    <div className="border-t border-slate-100 py-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="w-40 font-medium text-slate-800">
          {t.name} {t.code && <span className="text-xs text-slate-400">({t.code})</span>}
        </span>
        <span className="flex flex-wrap gap-1">
          {chips.map((c) => (
            <span key={c} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{c}</span>
          ))}
        </span>
        <span className="ml-auto text-xs text-slate-400">{t.covered} covered</span>
        <button onClick={() => setOpen((o) => !o)} className="text-xs font-semibold text-indigo-700 hover:underline">
          {open ? 'Close' : 'Edit rules'}
        </button>
        <form action={deleteLeaveTypeAction} className="inline">
          <input type="hidden" name="typeId" value={t.id} />
          <button className="text-xs font-medium text-red-500 hover:underline">Delete</button>
        </form>
      </div>

      {open && (
        <form action={formAction} className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-slate-50 p-3 text-xs">
          <input type="hidden" name="name" value={t.name} />
          <label className="flex items-center justify-between gap-2">Code
            <input name="code" defaultValue={t.code ?? ''} className={`${mini} w-20`} />
          </label>
          <label className="flex items-center justify-between gap-2">Annual quota (days)
            <input name="annualQuota" type="number" min={0} defaultValue={t.annualQuota} className={mini} />
          </label>
          <label className="flex items-center justify-between gap-2">Accrual / month
            <input name="accrualPerMonth" type="number" min={0} defaultValue={t.accrualPerMonth} className={mini} />
          </label>
          <label className="flex items-center justify-between gap-2">Carry-forward max
            <input name="carryForwardMax" type="number" min={0} defaultValue={t.carryForwardMax} className={mini} />
          </label>
          <label className="flex items-center justify-between gap-2">Max consecutive (0 = ∞)
            <input name="maxConsecutive" type="number" min={0} defaultValue={t.maxConsecutive} className={mini} />
          </label>
          <label className="flex items-center justify-between gap-2">Weekly-off adjacency
            <select name="woffAdjacency" defaultValue={t.woffAdjacency} className={`${field} py-1`}>
              <option value="allowed">Allowed</option>
              <option value="limited1">Max 1 day</option>
              <option value="forbidden">Forbidden</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="standaloneOnly" defaultChecked={t.standaloneOnly} /> Standalone only (no clubbing)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="clubbableWithLeave" defaultChecked={t.clubbableWithLeave} /> May be clubbed with other leave
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="requiresConfirmation" defaultChecked={t.requiresConfirmation} /> Accrues after confirmation
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="encashable" defaultChecked={t.encashable} /> Encashable (with approval)
          </label>
          <label className="col-span-2 flex items-center gap-2">
            <input type="checkbox" name="requiresRestrictedHoliday" defaultChecked={t.requiresRestrictedHoliday} /> Must fall on a published restricted-holiday date
          </label>
          <div className="col-span-2 flex items-center gap-2">
            <button disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
              {pending ? 'Saving…' : 'Save rules'}
            </button>
            {state.error && <span className="text-xs text-red-600">{state.error}</span>}
            {state.success && <span className="text-xs text-green-700">Saved.</span>}
          </div>
        </form>
      )}
    </div>
  )
}

export function LeaveTypeForm() {
  const [state, formAction, pending] = useActionState<HrActionState, FormData>(saveLeaveTypeAction, {})
  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-center gap-2">
      <input name="name" required placeholder="Type (e.g. Maternity Leave)" className={`${field} w-52`} />
      <input name="code" placeholder="Code" className={`${field} w-20`} />
      <input name="annualQuota" type="number" min={0} required placeholder="Days/yr" className={`${field} w-24`} />
      <input name="maxConsecutive" type="number" min={0} placeholder="Max consec." className={`${field} w-28`} title="Max consecutive days (0 = unlimited)" />
      <select name="woffAdjacency" defaultValue="allowed" className={field} title="Weekly-off adjacency">
        <option value="allowed">WOFF: allowed</option>
        <option value="limited1">WOFF: max 1</option>
        <option value="forbidden">WOFF: forbidden</option>
      </select>
      <label className="flex items-center gap-1.5 text-sm text-slate-700">
        <input type="checkbox" name="clubbableWithLeave" defaultChecked /> Clubbable
      </label>
      <button disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
        {pending ? 'Saving…' : 'Add leave type'}
      </button>
      <Feedback state={state} />
    </form>
  )
}

export function LeaveCapsForm({
  maxContinuousAbsenceDays,
  plannedLeaveNoticeDays,
}: {
  maxContinuousAbsenceDays: number
  plannedLeaveNoticeDays: number
}) {
  const [state, formAction, pending] = useActionState<HrActionState, FormData>(saveLeavePolicyAction, {})
  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
      <label className="text-xs font-medium text-slate-500">
        Max continuous absence (days)
        <input name="maxContinuousAbsenceDays" type="number" min={1} defaultValue={maxContinuousAbsenceDays} className={`${field} mt-1 block w-24`} />
      </label>
      <label className="text-xs font-medium text-slate-500">
        Planned-leave notice (working days)
        <input name="plannedLeaveNoticeDays" type="number" min={0} defaultValue={plannedLeaveNoticeDays} className={`${field} mt-1 block w-24`} />
      </label>
      <button disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
        {pending ? 'Saving…' : 'Save caps'}
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
      <input name="name" required placeholder="Holiday name (e.g. Diwali)" className={`${field} w-44`} />
      <select name="kind" defaultValue="public" className={field} title="Holiday type">
        <option value="public">Public (mandatory)</option>
        <option value="restricted">Restricted (optional)</option>
      </select>
      <button disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
        {pending ? 'Adding…' : 'Add holiday'}
      </button>
      <Feedback state={state} />
    </form>
  )
}
