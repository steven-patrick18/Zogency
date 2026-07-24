'use client'

import { useActionState } from 'react'
import { createCampaignAction, type CampaignActionState } from '@/modules/campaigns/actions'

const field =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'

export function NewCampaignForm({ clients }: { clients: Array<{ id: string; name: string }> }) {
  // createCampaignAction redirects to /campaigns/[id] on success.
  const [state, formAction, pending] = useActionState<CampaignActionState, FormData>(createCampaignAction, {})

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
      <input name="name" required placeholder="Campaign name *" className={`${field} w-64`} />
      <select name="clientId" defaultValue="" className={field}>
        <option value="">Internal project</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <button
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'Create campaign'}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  )
}
