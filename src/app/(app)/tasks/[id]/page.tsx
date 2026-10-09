import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { changeTaskStatusAction } from '@/modules/tasks/actions'
import { Avatar } from '@/components/avatar'
import { canEditTask, canReassignTask, TASK_EDIT_DENIED, taskVisibilityWhere } from '@/modules/tasks/task-scope'
import { AssigneesForm } from './assignees-form'
import { AttachmentForm } from './attachment-form'
import { EditTaskForm } from './edit-task-form'

const COLUMNS = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
  { key: 'blocked', label: 'Blocked' },
]
const STATUS_STYLE: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  review: 'bg-amber-100 text-amber-700',
  done: 'bg-green-100 text-green-700',
  blocked: 'bg-red-100 text-red-700',
}
const fmtBytes = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('tasks.view')
  const canEdit = session.user.permissions.includes('tasks.edit')
  const canApprove = session.user.permissions.includes('approvals.act')
  const { id } = await params

  const data = await withTenant(async () => {
    // AND-ed with the visibility filter: a task you may not see 404s rather
    // than rendering, so the id cannot be used to read someone else's work.
    const task = await prisma.task.findFirst({
      where: { AND: [{ id }, taskVisibilityWhere({ id: session.user.id, permissions: session.user.permissions })] },
      include: {
        project: { include: { client: { select: { id: true, name: true } } } },
        assignees: true,
        attachments: { orderBy: { createdAt: 'desc' } },
        statusHistory: { orderBy: { at: 'desc' }, take: 30 },
      },
    })
    if (!task) return null
    const [users, departments, projects, settings] = await Promise.all([
      prisma.user.findMany({ where: { status: 'active' }, select: { id: true, name: true, avatar: true }, orderBy: { name: 'asc' } }),
      prisma.department.findMany({ select: { id: true, name: true } }),
      prisma.project.findMany({ where: { status: 'active' }, select: { id: true, name: true } }),
      prisma.tenantSettings.findFirst({ select: { requireTaskApproval: true } }),
    ])
    return { task, users, departments, projects, gate: settings?.requireTaskApproval ?? false }
  })
  if (!data) notFound()
  const { task, users, departments, projects, gate } = data
  // Scoped edit rights (BRB): the board stays visible to everyone, but only the
  // task's own people — or a tasks.manage holder — can change it.
  const actor = { id: session.user.id, permissions: session.user.permissions }
  const canEditThis = canEdit && canEditTask(actor, task)
  // Reassigning is stricter than editing: creator or a tasks.manage holder.
  const canReassignThis = canEdit && canReassignTask(actor, task)
  const userName = new Map(users.map((u) => [u.id, u.name]))
  const userAvatar = new Map(users.map((u) => [u.id, u.avatar]))
  const deptName = new Map(departments.map((d) => [d.id, d.name]))

  const targets = COLUMNS.filter((c) => c.key !== task.status).filter((c) => {
    if (c.key === 'done' && gate) return canApprove && task.status === 'review'
    return true
  })

  return (
    <div className="max-w-3xl">
      <Link href="/tasks" className="text-sm text-slate-500 hover:underline">← Tasks</Link>
      <div className="mt-2 flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{task.title}</h1>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLE[task.status] ?? ''}`}>
          {task.status.replace('_', ' ')}
        </span>
      </div>

      {task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <span key={tag} className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">{tag}</span>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <dl className="space-y-1.5">
            <div className="flex justify-between"><dt className="text-slate-500">Project</dt><dd className="font-medium text-slate-800">{task.project ? task.project.client.name : '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Department</dt><dd className="font-medium text-slate-800">{task.departmentId ? deptName.get(task.departmentId) ?? '—' : '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Deadline</dt><dd className="font-medium text-slate-800">{task.deadline ? task.deadline.toDateString() : '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Priority</dt><dd className="font-medium capitalize text-slate-800">{task.priority}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Assignees</dt><dd className="flex items-center gap-1 font-medium text-slate-800">
              {task.assignees.length ? (
                <>
                  {task.assignees.map((a) => (
                    <Avatar key={a.userId} avatar={userAvatar.get(a.userId) ?? null} name={userName.get(a.userId) ?? '?'} size="xs" />
                  ))}
                  <span>{task.assignees.map((a) => userName.get(a.userId) ?? '?').join(', ')}</span>
                </>
              ) : (
                'Unassigned'
              )}
            </dd></div>
          </dl>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-1 text-xs font-medium text-slate-500">Description</p>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{task.description || <span className="text-slate-400">No description.</span>}</p>
        </div>
      </div>

      {/* Edit + status controls — only for this task's own people */}
      {canReassignThis && (
        <div className="mt-4">
          <AssigneesForm
            taskId={task.id}
            current={task.assignees.map((a) => a.userId)}
            users={users}
          />
        </div>
      )}

      {canEditThis && (
        <div className="mt-4">
          <EditTaskForm
            task={{
              id: task.id,
              title: task.title,
              description: task.description,
              tags: task.tags,
              projectId: task.projectId,
              departmentId: task.departmentId,
              deadline: task.deadline ? task.deadline.toISOString().slice(0, 10) : null,
              priority: task.priority,
            }}
            departments={departments}
            projects={projects}
          />
        </div>
      )}

      {canEdit && !canEditThis && (
        <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          {TASK_EDIT_DENIED}
        </p>
      )}

      {canEditThis && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-medium text-slate-500">Move to</p>
          <form action={changeTaskStatusAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="taskId" value={task.id} />
            {targets.map((c) => (
              <button key={c.key} name="to" value={c.key} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {c.label}
              </button>
            ))}
          </form>
          {gate && task.status !== 'review' && (
            <p className="mt-2 text-xs text-amber-600">Completion requires the task to be in Review and approved by an approver.</p>
          )}
        </div>
      )}

      {/* Attachments */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Attachments</h2>
        <ul className="mt-2 divide-y divide-slate-100">
          {task.attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2 text-sm">
              <a href={`/api/tasks/attachment/${a.id}`} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">
                📎 {a.name}
              </a>
              <span className="text-xs text-slate-400">{fmtBytes(a.size)}</span>
            </li>
          ))}
          {task.attachments.length === 0 && <li className="py-2 text-sm text-slate-400">No files attached.</li>}
        </ul>
        {canEditThis && <div className="mt-3 border-t border-slate-100 pt-3"><AttachmentForm taskId={task.id} /></div>}
      </div>

      {/* History */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Status history</h2>
        <ol className="mt-2 space-y-1.5 text-sm">
          {task.statusHistory.map((h) => (
            <li key={h.id} className="flex items-center justify-between text-slate-600">
              <span>{h.from ? `${h.from.replace('_', ' ')} → ` : ''}<span className="font-medium capitalize">{h.to.replace('_', ' ')}</span></span>
              <span className="text-xs text-slate-400">
                {h.actorId ? (userName.get(h.actorId) ?? 'user') : 'system'} · {h.at.toLocaleString('en-IN')}
              </span>
            </li>
          ))}
          {task.statusHistory.length === 0 && <li className="text-slate-400">No history yet.</li>}
        </ol>
      </div>
    </div>
  )
}
