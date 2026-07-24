'use client'

import { useActionState } from 'react'
import { completeExitAction, startExitAction, type HrActionState } from '@/modules/hr/actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'

function Feedback({ state }: { state: HrActionState }) {
  if (state.error) return <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>
  if (state.success) return <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">{state.success}</p>
  return null
}

export type ExitView = {
  type: string
  noticeStartOn: string
  lastDayOn: string
  notes: string | null
  completed: boolean
}

export function ExitPanel({
  employeeId,
  employeeName,
  exit,
  canManage,
}: {
  employeeId: string
  employeeName: string
  exit: ExitView | null
  canManage: boolean
}) {
  const [startState, startAction, startPending] = useActionState<HrActionState, FormData>(startExitAction, {})
  const [completeState, completeAction, completePending] = useActionState<HrActionState, FormData>(completeExitAction, {})

  if (exit) {
    return (
      <div className="space-y-2 text-xs">
        <p className={exit.completed ? 'font-medium text-slate-500' : 'font-medium text-amber-700'}>
          {exit.type} · notice {exit.noticeStartOn} → last day {exit.lastDayOn}
          {exit.completed ? ' · completed (access revoked)' : ' · in progress'}
        </p>
        {exit.notes && <p className="text-slate-500">{exit.notes}</p>}
        {!exit.completed && canManage && (
          <form action={completeAction} className="space-y-1">
            <input type="hidden" name="employeeId" value={employeeId} />
            <Feedback state={completeState} />
            <button disabled={completePending} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50">
              {completePending ? 'Completing…' : 'Complete exit (revoke access)'}
            </button>
          </form>
        )}
      </div>
    )
  }

  if (!canManage) return <span className="text-xs text-slate-400">—</span>

  return (
    <form action={startAction} className="w-64 space-y-1">
      <p className="text-xs font-medium text-slate-500">Start exit for {employeeName} (FR-4.7)</p>
      <input type="hidden" name="employeeId" value={employeeId} />
      <select name="type" className={field} defaultValue="resignation">
        <option value="resignation">Resignation</option>
        <option value="termination">Termination</option>
      </select>
      <div className="grid grid-cols-2 gap-1">
        <input name="noticeStartOn" type="date" required className={field} title="Notice start" />
        <input name="lastDayOn" type="date" required className={field} title="Last day" />
      </div>
      <input name="notes" placeholder="Exit interview notes" className={field} />
      <Feedback state={startState} />
      <button disabled={startPending} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
        {startPending ? 'Starting…' : 'Start exit'}
      </button>
    </form>
  )
}
