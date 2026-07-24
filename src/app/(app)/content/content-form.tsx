'use client'

import { useActionState, useState } from 'react'
import { createContentAction, type ContentActionState } from '@/modules/content/actions'

const field =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'

const CHANNELS = ['instagram', 'facebook', 'blog', 'email', 'youtube', 'other'] as const

export function ContentForm({ clients }: { clients: Array<{ id: string; name: string }> }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ContentActionState, FormData>(createContentAction, {})

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
      >
        New content
      </button>
    )
  }
  return (
    <form
      action={formAction}
      className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4"
    >
      <input name="title" required placeholder="Title *" className={`${field} w-64`} />
      <select name="channel" defaultValue="instagram" className={field}>
        {CHANNELS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input name="scheduledOn" type="date" required className={field} title="Scheduled date" />
      <select name="clientId" defaultValue="" className={field}>
        <option value="">No client</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input name="notes" placeholder="Notes" className={`${field} w-48`} />
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
