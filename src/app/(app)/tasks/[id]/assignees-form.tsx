'use client'

import { useActionState, useState } from 'react'
import { Avatar } from '@/components/avatar'
import { setTaskAssigneesAction, type TaskActionState } from '@/modules/tasks/actions'

/**
 * Edit who a task belongs to. The action existed since the multi-assignee
 * release but nothing ever called it — assignees were fixed at creation, so a
 * task raised against the wrong person could never be handed over. With task
 * visibility now scoped, that also meant the right person could not even see it.
 */
export function AssigneesForm({
  taskId,
  current,
  users,
}: {
  taskId: string
  current: string[]
  users: Array<{ id: string; name: string; avatar: string | null }>
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>(current)
  const [state, formAction, pending] = useActionState<TaskActionState, FormData>(
    setTaskAssigneesAction,
    {},
  )

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Change assignees
      </button>
    )
  }

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <input type="hidden" name="taskId" value={taskId} />
      {selected.map((id) => (
        <input key={id} type="hidden" name="assigneeIds" value={id} />
      ))}

      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">
          Assigned to ({selected.length} {selected.length === 1 ? 'person' : 'people'})
        </p>
        <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 p-1">
          {users.map((u) => (
            <label
              key={u.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
            >
              <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} />
              <Avatar avatar={u.avatar} name={u.name} size="xs" />
              <span className="text-slate-800">{u.name}</span>
            </label>
          ))}
        </div>
      </div>

      {selected.length === 0 && (
        <p className="text-xs text-amber-600">
          Pick at least one person — a task with nobody on it is only visible to managers.
        </p>
      )}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || selected.length === 0}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save assignees'}
        </button>
        <button
          type="button"
          onClick={() => {
            setSelected(current)
            setOpen(false)
          }}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
