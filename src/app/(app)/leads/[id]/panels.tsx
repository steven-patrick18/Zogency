'use client'

import { useActionState } from 'react'
import { reassignLeadAction, saveBantAction, type ActionState } from '@/modules/pipeline/actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'

type Bant = {
  budgetRange: string
  authority: string
  need: string
  timeline: string
} | null

export function BantForm({ leadId, bant }: { leadId: string; bant: Bant }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveBantAction, {})

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">BANT qualification</h2>
        {bant ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Complete</span>
        ) : (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Required past Connected</span>
        )}
      </div>
      <input type="hidden" name="leadId" value={leadId} />
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Budget</span>
        <input name="budgetRange" defaultValue={bant?.budgetRange ?? ''} placeholder="e.g. ₹50k–1L/month" className={field} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Authority</span>
        <input name="authority" defaultValue={bant?.authority ?? ''} placeholder="Decision-maker name / role" className={field} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Need</span>
        <input name="need" defaultValue={bant?.need ?? ''} placeholder="What problem are they solving?" className={field} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Timeline</span>
        <input name="timeline" defaultValue={bant?.timeline ?? ''} placeholder="e.g. this quarter" className={field} />
      </label>
      {state.error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">{state.success}</p>}
      <button
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save BANT'}
      </button>
    </form>
  )
}

export function ReassignForm({
  leadId,
  currentOwnerId,
  users,
}: {
  leadId: string
  currentOwnerId: string | null
  users: Array<{ id: string; name: string }>
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(reassignLeadAction, {})

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Owner</h2>
      <input type="hidden" name="leadId" value={leadId} />
      <select name="assigneeId" defaultValue={currentOwnerId ?? ''} required className={field}>
        <option value="" disabled>
          Select team member…
        </option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </select>
      {state.error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">{state.success}</p>}
      <button
        disabled={pending}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? 'Reassigning…' : 'Reassign'}
      </button>
    </form>
  )
}
