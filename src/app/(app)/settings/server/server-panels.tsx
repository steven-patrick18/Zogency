'use client'

import { useActionState } from 'react'
import { purgeCapturesAction, saveCaptureRetentionAction, type SystemActionState } from '@/modules/system/actions'

const field = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'

// Retention is stored in hours; show days when it divides evenly for a cleaner default.
export function RetentionForm({ retentionHours }: { retentionHours: number }) {
  const [state, formAction, pending] = useActionState<SystemActionState, FormData>(saveCaptureRetentionAction, {})
  const asDays = retentionHours % 24 === 0
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="text-xs font-medium text-slate-500">
        Keep screen captures for
        <input
          name="value"
          type="number"
          min={1}
          defaultValue={asDays ? retentionHours / 24 : retentionHours}
          className={`${field} mt-1 block w-24`}
        />
      </label>
      <label className="text-xs font-medium text-slate-500">
        Unit
        <select name="unit" defaultValue={asDays ? 'days' : 'hours'} className={`${field} mt-1 block w-28`}>
          <option value="hours">Hours</option>
          <option value="days">Days</option>
        </select>
      </label>
      <button
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save retention'}
      </button>
      {state.success && <span className="text-xs text-green-700">{state.success}</span>}
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  )
}

export function PurgeButtons({ hasCaptures }: { hasCaptures: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={purgeCapturesAction}>
        <input type="hidden" name="mode" value="stale" />
        <button
          disabled={!hasCaptures}
          className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-40"
        >
          Delete past-retention captures
        </button>
      </form>
      <form action={purgeCapturesAction} onSubmit={(e) => { if (!confirm('Delete ALL screen captures for this workspace? This cannot be undone.')) e.preventDefault() }}>
        <input type="hidden" name="mode" value="all" />
        <button
          disabled={!hasCaptures}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
        >
          Delete all captures
        </button>
      </form>
    </div>
  )
}
