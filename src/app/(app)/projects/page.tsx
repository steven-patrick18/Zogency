// Projects (BRB) — delivery containers auto-created on Won, plus manual ones.
// Shows client, type, status and task progress; each links to its board.
import Link from 'next/link'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { NewProjectForm } from './new-project-form'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  completed: 'bg-slate-100 text-slate-600',
  archived: 'bg-slate-100 text-slate-400',
}

export default async function ProjectsPage() {
  const session = await requirePermission('tasks.view')
  const canManage = session.user.permissions.includes('clients.edit')

  const [projects, clients] = await withTenant(() =>
    Promise.all([
      prisma.project.findMany({
        include: { client: { select: { name: true } }, tasks: { select: { status: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.client.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]),
  )

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="mt-1 text-sm text-slate-500">Delivery projects and their task progress.</p>
        </div>
        {canManage && <NewProjectForm clients={clients} />}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Tasks (done / total)</th>
              <th className="px-4 py-3">Dates</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects.map((p) => {
              const total = p.tasks.length
              const done = p.tasks.filter((t) => t.status === 'done').length
              const pct = total > 0 ? Math.round((done / total) * 100) : 0
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="font-medium text-slate-900 hover:text-indigo-600">{p.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.client.name}</td>
                  <td className="px-4 py-3 text-slate-600">{p.type === 'retainer' ? 'Retainer' : 'One-off'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[p.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{done}/{total}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {p.startOn ? p.startOn.toLocaleDateString('en-IN') : '—'}
                    {p.endOn ? ` → ${p.endOn.toLocaleDateString('en-IN')}` : ''}
                  </td>
                </tr>
              )
            })}
            {projects.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                  No projects yet — they’re created automatically when a deal is Won, or add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
