import Link from 'next/link'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { changeTaskStatusAction } from '@/modules/tasks/actions'
import { NewTaskForm } from './new-task-form'

const COLUMNS: Array<{ key: 'todo' | 'in_progress' | 'review' | 'done' | 'blocked'; label: string }> = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
  { key: 'blocked', label: 'Blocked' },
]

export default async function TasksPage() {
  const session = await requirePermission('tasks.view')
  const canEdit = session.user.permissions.includes('tasks.edit')
  const canApprove = session.user.permissions.includes('approvals.act')
  const [tasks, departments, users, projects, settings] = await withTenant(() =>
    Promise.all([
      prisma.task.findMany({ include: { project: { include: { client: true } }, assignees: true, _count: { select: { attachments: true } } }, orderBy: { createdAt: 'desc' } }),
      prisma.department.findMany({ orderBy: { sort: 'asc' } }),
      prisma.user.findMany({ where: { status: 'active' }, select: { id: true, name: true } }),
      prisma.project.findMany({ where: { status: 'active' }, select: { id: true, name: true } }),
      prisma.tenantSettings.findFirst({ select: { requireTaskApproval: true } }),
    ]),
  )
  const deptName = new Map(departments.map((d) => [d.id, d.name]))
  const userName = new Map(users.map((u) => [u.id, u.name]))
  const gate = settings?.requireTaskApproval ?? false
  // With the gate on, "Done" is only offered to an approver on a task in Review.
  const allowedTargets = (status: string) =>
    COLUMNS.filter((c) => c.key !== status).filter((c) => {
      if (c.key === 'done' && gate) return canApprove && status === 'review'
      return true
    }).slice(0, 4)

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
      <p className="mt-1 text-sm text-slate-500">
        Auto-created from SoW deliverables on handover; department boards per doc 11 Q12.
      </p>
      <NewTaskForm
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        users={users.map((u) => ({ id: u.id, name: u.name }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      />
      <div className="mt-6 flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const column = tasks.filter((t) => t.status === col.key)
          return (
            <div key={col.key} className="w-64 shrink-0 rounded-xl bg-slate-200/60 p-2">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-sm font-semibold text-slate-700">{col.label}</span>
                <span className="text-xs text-slate-500">{column.length}</span>
              </div>
              <div className="mt-1 space-y-2">
                {column.map((t) => (
                  <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <Link href={`/tasks/${t.id}`} className="text-sm font-medium text-slate-900 hover:text-indigo-600">{t.title}</Link>
                    {t.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{t.description}</p>
                    )}
                    {t.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {t.tags.map((tag) => (
                          <span key={tag} className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">{tag}</span>
                        ))}
                      </div>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {t.project ? `${t.project.client.name}` : 'No project'}
                      {t.departmentId ? ` · ${deptName.get(t.departmentId)}` : ''}
                      {t._count.attachments > 0 ? ` · 📎 ${t._count.attachments}` : ''}
                    </p>
                    <p className="text-xs text-slate-400">
                      {t.assignees.length > 0
                        ? t.assignees.map((a) => userName.get(a.userId) ?? '?').join(', ')
                        : 'Unassigned'}
                      {t.deadline ? ` · due ${t.deadline.toDateString()}` : ''}
                      {` · ${t.priority}`}
                    </p>
                    {canEdit && (
                      <form action={changeTaskStatusAction} className="mt-2 flex flex-wrap gap-1">
                        <input type="hidden" name="taskId" value={t.id} />
                        {allowedTargets(t.status).map((c) => (
                          <button
                            key={c.key}
                            name="to"
                            value={c.key}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-indigo-100 hover:text-indigo-700"
                          >
                            {c.label}
                          </button>
                        ))}
                      </form>
                    )}
                  </div>
                ))}
                {column.length === 0 && <p className="px-2 py-3 text-center text-xs text-slate-400">Empty</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
