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

// ── Per-member drill-down (clickable rows on /productivity) ─────────────────

export type HourBucket = { hour: number; activeMin: number; idleMin: number }
export type AppUsage = { app: string; minutes: number }

export type MemberActivityDetail = {
  name: string
  department: string | null
  designation: string | null
  agentIssued: boolean
  hasPings: boolean
  // Summary
  activeMin: number
  idleMin: number
  firstPingAt: Date | null
  lastPingAt: Date | null
  actions: number
  callCount: number
  tasksDone: number
  punch: { inAt: Date | null; outAt: Date | null; mode: string } | null
  // Detail
  hours: HourBucket[] // only hours with data
  apps: AppUsage[]
  auditTrail: Array<{ at: Date; action: string; entityType: string }>
  calls: Array<{ at: Date; direction: string; durationSec: number | null; disposition: string | null; leadName: string }>
  completedTasks: Array<{ at: Date; title: string }>
  // Deep monitoring (monitoring.deep permission) — window titles + screenshots.
  titles: Array<{ at: Date; app: string | null; title: string }>
  screenshots: Array<{ id: string; at: Date; app: string | null; image: string }>
}

/**
 * Everything we know about one member's day: agent pings + CRM signals.
 * `includeDeep` adds window titles + screenshots (caller must hold
 * monitoring.deep — enforced at the page).
 */
export async function getMemberActivityDetail(
  userId: string,
  dayStart: Date,
  includeDeep = false,
): Promise<MemberActivityDetail | null> {
  const dayEnd = new Date(dayStart.getTime() + 86_400_000)
  const range = { gte: dayStart, lt: dayEnd }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, agentToken: true },
  })
  if (!user) return null

  const [employee, pings, audits, calls, taskHistory] = await Promise.all([
    prisma.employee.findUnique({ where: { userId } }),
    prisma.activityPing.findMany({ where: { userId, at: range }, orderBy: { at: 'asc' } }),
    prisma.auditLog.findMany({
      where: { actorId: userId, at: range },
      orderBy: { at: 'desc' },
      select: { at: true, action: true, entityType: true },
      take: 100,
    }),
    prisma.call.findMany({
      where: { userId, startedAt: range },
      orderBy: { startedAt: 'desc' },
      include: { lead: { select: { name: true } } },
    }),
    prisma.taskStatusHistory.findMany({
      where: { actorId: userId, at: range, to: 'done' },
      orderBy: { at: 'desc' },
      include: { task: { select: { title: true } } },
    }),
  ])

  const [department, attendance, screenshots] = await Promise.all([
    employee?.departmentId
      ? prisma.department.findUnique({ where: { id: employee.departmentId }, select: { name: true } })
      : Promise.resolve(null),
    employee
      ? prisma.attendanceRecord.findFirst({ where: { employeeId: employee.id, date: range } })
      : Promise.resolve(null),
    includeDeep
      ? prisma.screenCapture.findMany({
          where: { userId, at: range },
          orderBy: { at: 'asc' },
          select: { id: true, at: true, appName: true, image: true },
        })
      : Promise.resolve([]),
  ])

  // Hourly buckets + app minutes from ~1/min pings (active = idleSec < 60).
  const hourMap = new Map<number, { activeMin: number; idleMin: number }>()
  const appMap = new Map<string, number>()
  let active = 0
  let idle = 0
  for (const p of pings) {
    const hour = p.at.getHours()
    const bucket = hourMap.get(hour) ?? { activeMin: 0, idleMin: 0 }
    if (p.idleSec < 60) {
      bucket.activeMin++
      active++
    } else {
      bucket.idleMin++
      idle++
    }
    hourMap.set(hour, bucket)
    if (p.appName) appMap.set(p.appName, (appMap.get(p.appName) ?? 0) + 1)
  }

  return {
    name: user.name,
    department: department?.name ?? null,
    designation: employee?.designation ?? null,
    agentIssued: !!user.agentToken,
    hasPings: pings.length > 0,
    activeMin: active,
    idleMin: idle,
    firstPingAt: pings[0]?.at ?? null,
    lastPingAt: pings[pings.length - 1]?.at ?? null,
    actions: audits.length,
    callCount: calls.length,
    tasksDone: taskHistory.length,
    punch: attendance ? { inAt: attendance.inAt, outAt: attendance.outAt, mode: attendance.mode } : null,
    hours: [...hourMap.entries()].map(([hour, b]) => ({ hour, ...b })).sort((a, b) => a.hour - b.hour),
    apps: [...appMap.entries()].map(([app, minutes]) => ({ app, minutes })).sort((a, b) => b.minutes - a.minutes),
    auditTrail: audits,
    calls: calls.map((c) => ({
      at: c.startedAt,
      direction: c.direction,
      durationSec: c.durationSec,
      disposition: c.disposition,
      leadName: c.lead.name,
    })),
    completedTasks: taskHistory.map((t) => ({ at: t.at, title: t.task.title })),
    // Deep monitoring: dedupe consecutive identical titles so the feed reads as
    // "what they worked on", not 60 copies per hour.
    titles: includeDeep
      ? pings
          .filter((p) => p.windowTitle)
          .filter((p, i, arr) => i === 0 || p.windowTitle !== arr[i - 1].windowTitle)
          .map((p) => ({ at: p.at, app: p.appName, title: p.windowTitle! }))
      : [],
    screenshots: screenshots.map((s) => ({ id: s.id, at: s.at, app: s.appName, image: s.image })),
  }
}
