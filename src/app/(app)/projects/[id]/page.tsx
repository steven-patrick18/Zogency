import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'

const COLUMNS: Array<{ key: string; label: string }> = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
  { key: 'blocked', label: 'Blocked' },
]

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('tasks.view')
  const { id } = await params

  const data = await withTenant(async () => {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        tasks: { include: { assignees: true }, orderBy: { createdAt: 'desc' } },
      },
    })
    if (!project) return null
    const users = await prisma.user.findMany({ select: { id: true, name: true } })
    return { project, users }
  })
  if (!data) notFound()
  const { project, users } = data
  const userName = new Map(users.map((u) => [u.id, u.name]))

  return (
    <div className="max-w-5xl">
      <Link href="/projects" className="text-sm text-slate-500 hover:underline">← Projects</Link>
      <div className="mt-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            <Link href={`/clients/${project.client.id}`} className="hover:text-indigo-600">{project.client.name}</Link>
            {' · '}{project.type === 'retainer' ? 'Retainer' : 'One-off'} · <span className="capitalize">{project.status}</span>
          </p>
        </div>
        <Link href="/tasks" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Task board →
        </Link>
      </div>

      <div className="mt-6 flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const column = project.tasks.filter((t) => t.status === col.key)
          return (
            <div key={col.key} className="w-64 shrink-0 rounded-xl bg-slate-200/60 p-2">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-sm font-semibold text-slate-700">{col.label}</span>
                <span className="text-xs text-slate-500">{column.length}</span>
              </div>
              <div className="mt-1 space-y-2">
                {column.map((t) => (
                  <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-sm font-medium text-slate-900">{t.title}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {t.assignees.length > 0 ? t.assignees.map((a) => userName.get(a.userId) ?? '?').join(', ') : 'Unassigned'}
                      {t.deadline ? ` · due ${t.deadline.toDateString()}` : ''}
                      {` · ${t.priority}`}
                    </p>
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
