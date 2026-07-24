'use client'

import { useActionState } from 'react'
import { createLeadAction, type LeadFormState } from '@/modules/leads/actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'

export function LeadForm({ sources }: { sources: Array<{ id: string; name: string }> }) {
  const [state, formAction, pending] = useActionState<LeadFormState, FormData>(createLeadAction, {})

  return (
    <form action={formAction} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div className="grid grid-cols-2 gap-4">
        <label className="col-span-2 block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Name *</span>
          <input name="name" required className={field} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Phone</span>
          <input name="phone" placeholder="98765 43210" className={field} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Email</span>
          <input name="email" type="email" className={field} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Company</span>
          <input name="company" className={field} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">City</span>
          <input name="city" className={field} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Industry</span>
          <input name="industry" className={field} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Source *</span>
          <select name="sourceName" required className={field} defaultValue="Referral">
            {sources.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </label>
      </div>
      {state.error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">{state.success}</p>
      )}
      <button
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'Create lead'}
      </button>
    </form>
  )
}
