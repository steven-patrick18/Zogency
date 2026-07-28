'use client'

import { useActionState, useState } from 'react'
import { createProjectAction, type ProjectActionState } from '@/modules/projects/actions'

const field = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'

export function NewProjectForm({ clients }: { clients: Array<{ id: string; name: string }> }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ProjectActionState, FormData>(createProjectAction, {})

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
        New project
      </button>
    )
  }
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
      <input name="name" required placeholder="Project name *" className={`${field} w-56`} />
      <select name="clientId" required defaultValue="" className={field}>
        <option value="" disabled>Client *</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <select name="type" defaultValue="one_off" className={field}>
        <option value="one_off">One-off</option>
        <option value="retainer">Retainer</option>
      </select>
      <input name="startOn" type="date" className={field} title="Start" />
      <input name="endOn" type="date" className={field} title="End" />
      <button disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
        {pending ? 'Creating…' : 'Create'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:underline">Cancel</button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-green-700">{state.success}</p>}
    </form>
  )
}
