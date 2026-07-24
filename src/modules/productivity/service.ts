// Productivity metrics (doc 11 O6 screen-time). Works from CRM signals today
// (audit actions, calls, tasks completed, punch hours) and enriches with
// desktop agent data (active/idle time, top apps) when the Electron agent is
// connected. Admin/managers view it on /productivity.
import { prisma } from '@/lib/db/prisma'

export type MemberProductivity = {
  userId: string
  name: string
  department: string | null
  agentConnected: boolean
  actions: number // CRM mutations today (audit log)
  calls: number
  tasksDone: number
  activeMin: number // from agent pings (non-idle)
  idleMin: number
  topApps: string[]
}

export async function getProductivity(dateStart: Date): Promise<MemberProductivity[]> {
  const [users, employees, departments, audits, calls, taskHistory, pings] = await Promise.all([
    prisma.user.findMany({ where: { status: 'active' }, select: { id: true, name: true, agentToken: true } }),
    prisma.employee.findMany({ where: { status: { not: 'exited' } } }),
    prisma.department.findMany(),
    prisma.auditLog.findMany({ where: { at: { gte: dateStart } }, select: { actorId: true } }),
    prisma.call.findMany({ where: { startedAt: { gte: dateStart } }, select: { userId: true } }),
    prisma.taskStatusHistory.findMany({
      where: { at: { gte: dateStart }, to: 'done' },
      select: { actorId: true },
    }),
    prisma.activityPing.findMany({ where: { at: { gte: dateStart } } }),
  ])

  const deptName = new Map(departments.map((d) => [d.id, d.name]))
  const deptByUser = new Map(employees.map((e) => [e.userId, e.departmentId ? deptName.get(e.departmentId) ?? null : null]))

  const countBy = <T,>(rows: T[], key: (r: T) => string | null) => {
    const m = new Map<string, number>()
    for (const r of rows) {
      const k = key(r)
      if (k) m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }
  const auditByUser = countBy(audits, (a) => a.actorId)
  const callByUser = countBy(calls, (c) => c.userId)
  const taskByUser = countBy(taskHistory, (t) => t.actorId)

  // Pings are ~1/min from the agent: active = idleSec<60, idle otherwise.
  const pingByUser = new Map<string, { active: number; idle: number; apps: Map<string, number> }>()
  for (const p of pings) {
    const e = pingByUser.get(p.userId) ?? { active: 0, idle: 0, apps: new Map() }
    if (p.idleSec < 60) e.active++
    else e.idle++
    if (p.appName) e.apps.set(p.appName, (e.apps.get(p.appName) ?? 0) + 1)
    pingByUser.set(p.userId, e)
  }

  return users
    .map((u) => {
      const ping = pingByUser.get(u.id)
      const topApps = ping
        ? [...ping.apps.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([app]) => app)
        : []
      return {
        userId: u.id,
        name: u.name,
        department: deptByUser.get(u.id) ?? null,
        agentConnected: !!u.agentToken && !!ping,
        actions: auditByUser.get(u.id) ?? 0,
        calls: callByUser.get(u.id) ?? 0,
        tasksDone: taskByUser.get(u.id) ?? 0,
        activeMin: ping?.active ?? 0,
        idleMin: ping?.idle ?? 0,
        topApps,
      }
    })
    .sort((a, b) => b.actions + b.calls + b.tasksDone - (a.actions + a.calls + a.tasksDone))
}
