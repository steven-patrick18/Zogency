'use client'

import { useActionState, useState } from 'react'
import { updateTaskAction, type TaskActionState } from '@/modules/tasks/actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'
const label = 'mb-1 block text-xs font-medium text-slate-500'

export type EditableTask = {
  id: string
  title: string
  description: string | null
  tags: string[]
  projectId: string | null
  departmentId: string | null
  deadline: string | null // yyyy-mm-dd, already formatted by the server
  priority: string
}

export function EditTaskForm({
  task,
  departments,
  projects,
}: {
  task: EditableTask
  departments: Array<{ id: string; name: string }>
  projects: Array<{ id: string; name: string }>
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<TaskActionState, FormData>(updateTaskAction, {})

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Edit task
      </button>
    )
  }

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <input type="hidden" name="taskId" value={task.id} />
      <div>
        <label className={label} htmlFor="edit-title">Title</label>
        <input id="edit-title" name="title" defaultValue={task.title} required className={field} />
      </div>
      <div>
        <label className={label} htmlFor="edit-description">Description</label>
        <textarea id="edit-description" name="description" rows={3} defaultValue={task.description ?? ''} className={field} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="edit-project">Project</label>
          <select id="edit-project" name="projectId" defaultValue={task.projectId ?? ''} className={field}>
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="edit-department">Department</label>
          <select id="edit-department" name="departmentId" defaultValue={task.departmentId ?? ''} className={field}>
            <option value="">No department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="edit-deadline">Deadline</label>
          <input id="edit-deadline" type="date" name="deadline" defaultValue={task.deadline ?? ''} className={field} />
        </div>
        <div>
          <label className={label} htmlFor="edit-priority">Priority</label>
          <select id="edit-priority" name="priority" defaultValue={task.priority} className={field}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>
      <div>
        <label className={label} htmlFor="edit-tags">Tags</label>
        <input id="edit-tags" name="tags" defaultValue={task.tags.join(', ')} placeholder="comma separated" className={field} />
      </div>

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
