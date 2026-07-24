'use client'

import { useActionState, useState } from 'react'
import { addRetainerScheduleAction, type RetainerActionState } from '@/modules/retainer/actions'

const field =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'

export function RetainerForm({ clients }: { clients: Array<{ id: string; name: string }> }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<RetainerActionState, FormData>(
    addRetainerScheduleAction,
    {},
  )

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
      >
        New retainer
      </button>
    )
  }
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
      <select name="clientId" required defaultValue="" className={field}>
        <option value="" disabled>
          Select client *
        </option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input name="description" required placeholder="Description *" className={`${field} w-56`} />
      <input name="amount" type="number" step="0.01" min="0.01" required placeholder="Amount ₹ *" className={`${field} w-32`} />
      <input
        name="billingDay"
        type="number"
        min="1"
        max="28"
        defaultValue={1}
        required
        title="Billing day (1–28)"
        className={`${field} w-24`}
      />
      <button
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Create'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:underline">
        Cancel
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-green-700">{state.success}</p>}
    </form>
  )
}
