'use client'

import { useActionState, useState } from 'react'
import { createTaskAction, type TaskActionState } from '@/modules/tasks/actions'

const field =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'

// Multi-assignee picker — emits a repeated `assigneeIds` hidden field per pick.
function AssigneePicker({ users }: { users: Array<{ id: string; name: string }> }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const label =
    selected.length === 0
      ? 'Assign to me'
      : selected.length === 1
        ? (users.find((u) => u.id === selected[0])?.name ?? '1 person')
        : `${selected.length} people`

  return (
    <div className="relative">
      {selected.map((id) => (
        <input key={id} type="hidden" name="assigneeIds" value={id} />
      ))}
      <button type="button" onClick={() => setOpen((o) => !o)} className={`${field} min-w-[10rem] text-left`}>
        {label} <span className="text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-10 mt-1 max-h-56 w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {users.map((u) => (
            <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
              <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} />
              {u.name}
            </label>
          ))}
          <button type="button" onClick={() => setOpen(false)} className="mt-1 w-full rounded-md bg-slate-100 py-1 text-xs font-medium text-slate-600">
            Done
          </button>
        </div>
      )}
    </div>
  )
}

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
      <AssigneePicker users={users} />
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
