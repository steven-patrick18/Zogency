'use client'

import { useActionState, useState } from 'react'
import { createTaskAction, type TaskActionState } from '@/modules/tasks/actions'

const field =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'

export function NewTaskForm({
  departments,
  users,
  projects,
}: {
  departments: Array<{ id: string; name: string }>
  users: Array<{ id: string; name: string }>
  projects: Array<{ id: string; name: string }>
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<TaskActionState, FormData>(createTaskAction, {})

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
      >
        New task
      </button>
    )
  }
  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
      <input name="title" required placeholder="Task title *" className={`${field} w-64`} />
      <select name="projectId" defaultValue="" className={field}>
        <option value="">No project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <select name="departmentId" defaultValue="" className={field}>
        <option value="">No department</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>
      <select name="assigneeId" defaultValue="" className={field}>
        <option value="">Assign to me</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </select>
      <input name="deadline" type="date" className={field} />
      <select name="priority" defaultValue="medium" className={field}>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="urgent">Urgent</option>
      </select>
      <button disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
        {pending ? 'Creating…' : 'Create'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:underline">
        Cancel
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-green-700">{state.success}</p>}
    </form>
  )
}
