'use client'

import { useActionState } from 'react'
import { createCycleAction, saveReviewAction, type HrActionState } from '@/modules/hr/actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'
const primaryBtn =
  'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50'

function Feedback({ state }: { state: HrActionState }) {
  if (state.error) return <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>
  if (state.success) return <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">{state.success}</p>
  return null
}

export function CycleForm() {
  const [state, formAction, pending] = useActionState<HrActionState, FormData>(createCycleAction, {})
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">New review cycle</h2>
      <p className="mt-0.5 text-xs text-slate-400">Goal setting and reviews run per cycle (FR-4.12).</p>
      <form action={formAction} className="mt-3 space-y-2">
        <input name="name" required placeholder="Cycle name (e.g. H1 2026) *" className={field} />
        <div className="grid grid-cols-2 gap-2">
          <input name="periodStart" type="date" required className={field} title="Period start" />
          <input name="periodEnd" type="date" required className={field} title="Period end" />
        </div>
        <Feedback state={state} />
        <button disabled={pending} className={primaryBtn}>{pending ? 'Creating…' : 'Create cycle'}</button>
      </form>
    </div>
  )
}

export type ReviewView = {
  selfAssessment: string | null
  managerReview: string | null
  finalRating: number | null
} | null

export function ReviewForm({
  cycleId,
  employeeId,
  employeeName,
  review,
}: {
  cycleId: string
  employeeId: string
  employeeName: string
  review: ReviewView
}) {
  const [state, formAction, pending] = useActionState<HrActionState, FormData>(saveReviewAction, {})
  return (
    <form action={formAction} className="space-y-2 rounded-lg bg-slate-50 p-3">
      <p className="text-sm font-medium text-slate-900">{employeeName}</p>
      <input type="hidden" name="cycleId" value={cycleId} />
      <input type="hidden" name="employeeId" value={employeeId} />
      <textarea
        name="selfAssessment"
        rows={2}
        placeholder="Self assessment"
        defaultValue={review?.selfAssessment ?? ''}
        className={field}
      />
      <textarea
        name="managerReview"
        rows={2}
        placeholder="Manager review"
        defaultValue={review?.managerReview ?? ''}
        className={field}
      />
      <select name="finalRating" className={field} defaultValue={review?.finalRating ?? ''}>
        <option value="">Final rating…</option>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <Feedback state={state} />
      <button disabled={pending} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
        {pending ? 'Saving…' : 'Save review'}
      </button>
    </form>
  )
}
