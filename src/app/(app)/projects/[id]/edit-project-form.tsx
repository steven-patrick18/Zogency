'use client'

import { useActionState, useState } from 'react'
import { updateProjectAction, type ProjectActionState } from '@/modules/projects/actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'
const label = 'mb-1 block text-xs font-medium text-slate-500'

export function EditProjectForm({
  project,
}: {
  project: {
    id: string
    name: string
    type: string
    status: string
    startOn: string | null // yyyy-mm-dd
    endOn: string | null
  }
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ProjectActionState, FormData>(updateProjectAction, {})

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Edit project
      </button>
    )
  }

  return (
    <form action={formAction} className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <input type="hidden" name="projectId" value={project.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label} htmlFor="project-name">Project name</label>
          <input id="project-name" name="name" defaultValue={project.name} required className={field} />
        </div>
        <div>
          <label className={label} htmlFor="project-type">Engagement</label>
          <select id="project-type" name="type" defaultValue={project.type} className={field}>
            <option value="one_off">One-off</option>
            <option value="retainer">Retainer</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor="project-status">Status</label>
          <select id="project-status" name="status" defaultValue={project.status} className={field}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor="project-start">Start</label>
          <input id="project-start" type="date" name="startOn" defaultValue={project.startOn ?? ''} className={field} />
        </div>
        <div>
          <label className={label} htmlFor="project-end">End</label>
          <input id="project-end" type="date" name="endOn" defaultValue={project.endOn ?? ''} className={field} />
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Switching a one-off to a retainer keeps the project&apos;s tasks and history. Billing is separate — add a
        monthly schedule under Invoices → Retainers to actually start recurring invoices.
      </p>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
