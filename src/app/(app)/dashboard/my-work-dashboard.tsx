// Department-aware "My work" dashboard (BRB) — what a staff member sees on their
// home: their tasks, their department's board, active projects, their open
// leads and today's attendance. Leadership (reports.view) gets the company view.
import Link from 'next/link'
import { withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { getSelfDaySummary } from '@/modules/hr/attendance'

const STATUS_LABEL: Record<string, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  review: 'Review',
  done: 'Done',
  blocked: 'Blocked',
}

function Tile({ label, value, href }: { label: string; value: string; href?: string }) {
  const inner = (
    <>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </>
  )
  return href ? (
    <Link href={href} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-indigo-300">{inner}</Link>
  ) : (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">{inner}</div>
  )
}

export async function MyWorkDashboard({
  userId,
  name,
  canSeeLeads,
}: {
  userId: string
  name: string
  canSeeLeads: boolean
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const data = await withTenant(async () => {
    const employee = await prisma.employee.findUnique({ where: { userId }, select: { departmentId: true } })
    const departmentId = employee?.departmentId ?? null
    const [myTasks, department, deptTasks, myLeads, self] = await Promise.all([
      prisma.task.findMany({
        where: { assignees: { some: { userId } } },
        include: { project: { include: { client: { select: { name: true } } } } },
        orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
        take: 100,
      }),
      departmentId ? prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } }) : Promise.resolve(null),
      departmentId
        ? prisma.task.findMany({ where: { departmentId }, select: { status: true, projectId: true } })
        : Promise.resolve([] as Array<{ status: string; projectId: string | null }>),
      canSeeLeads
        ? prisma.lead.count({ where: { ownerId: userId, archivedAt: null, status: { isTerminal: false } } })
        : Promise.resolve(0),
      getSelfDaySummary(userId, today),
    ])
    // Active projects touched by this department's tasks.
    const projIds = [...new Set(deptTasks.map((t) => t.projectId).filter((x): x is string => !!x))]
    const deptProjects = projIds.length
      ? await prisma.project.findMany({
          where: { id: { in: projIds }, status: 'active' },
          include: { client: { select: { name: true } } },
          take: 10,
        })
      : []
    return { departmentName: department?.name ?? null, myTasks, deptTasks, deptProjects, myLeads, self }
  })

  const { departmentName, myTasks, deptTasks, deptProjects, myLeads, self } = data
  const myOpen = myTasks.filter((t) => t.status !== 'done')
  const activeMin = self?.activeMinutes ?? 0
  const deptCounts = ['todo', 'in_progress', 'review', 'done', 'blocked'].map((s) => ({
    key: s,
    label: STATUS_LABEL[s],
    count: deptTasks.filter((t) => t.status === s).length,
  }))

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-slate-900">Hi {name.split(' ')[0]} — your work</h1>
      <p className="mt-1 text-sm text-slate-500">
        {departmentName ? `${departmentName} team` : 'Personal workspace'} · today at a glance.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile label="My open tasks" value={String(myOpen.length)} href="/tasks" />
        {canSeeLeads && <Tile label="My open leads" value={String(myLeads)} href="/leads" />}
        <Tile label="Active today" value={`${Math.floor(activeMin / 60)}h ${activeMin % 60}m`} />
        <Tile label="Department" value={departmentName ?? '—'} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* My tasks */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">My tasks</h2>
            <Link href="/tasks" className="text-xs font-medium text-indigo-600 hover:underline">Task board →</Link>
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {myOpen.slice(0, 8).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{t.title}</p>
                  <p className="text-xs text-slate-400">
                    {t.project ? t.project.client.name : 'No project'} · {STATUS_LABEL[t.status] ?? t.status}
                  </p>
                </div>
                {t.deadline && (
                  <span className={`shrink-0 text-xs ${t.deadline < today ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
                    {t.deadline.toLocaleDateString('en-IN')}
                  </span>
                )}
              </li>
            ))}
            {myOpen.length === 0 && <li className="py-3 text-sm text-slate-400">No open tasks — you’re all caught up. 🎉</li>}
          </ul>
        </div>

        {/* Department snapshot */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">{departmentName ? `${departmentName} — team board` : 'Team board'}</h2>
          {departmentName ? (
            <>
              <div className="mt-3 grid grid-cols-5 gap-2 text-center">
                {deptCounts.map((c) => (
                  <div key={c.key} className="rounded-lg bg-slate-50 py-2">
                    <p className="text-lg font-bold text-slate-900">{c.count}</p>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">{c.label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 mb-1 text-xs font-medium text-slate-500">Active projects</p>
              <ul className="space-y-1 text-sm">
                {deptProjects.map((p) => (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className="text-slate-700 hover:text-indigo-600">{p.name}</Link>
                    <span className="text-xs text-slate-400"> · {p.client.name}</span>
                  </li>
                ))}
                {deptProjects.length === 0 && <li className="text-sm text-slate-400">No active projects for your team.</li>}
              </ul>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-400">You’re not linked to a department yet — ask HR to set one.</p>
          )}
        </div>
      </div>
    </div>
  )
}
