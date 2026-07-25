// Attendance computed from desktop-agent activity (doc 06 / FR-4.8). Productive
// minutes = active pings (idleSec < 60). Status is derived from the tenant's
// min-productive / half-day thresholds, plus any Admin-approved excess credit.
import { audit } from '@/lib/audit'
import { prisma, scoped } from '@/lib/db/prisma'

export type AttendanceStatus = 'present' | 'half_day' | 'absent'

/** Active minutes for a user on a day (≈1 ping/min, active = idleSec < 60). */
async function activeMinutesByUser(dayStart: Date, dayEnd: Date): Promise<Map<string, number>> {
  const pings = await prisma.activityPing.findMany({
    where: { at: { gte: dayStart, lt: dayEnd } },
    select: { userId: true, idleSec: true },
  })
  const m = new Map<string, number>()
  for (const p of pings) if (p.idleSec < 60) m.set(p.userId, (m.get(p.userId) ?? 0) + 1)
  return m
}

/**
 * Recompute attendance for a day from agent activity + approved credits, writing
 * productiveMinutes/creditMinutes/status onto each employee's record. Leave and
 * holiday records are left untouched. Returns the number of records written.
 */
export async function computeDayAttendance(dayStart: Date): Promise<number> {
  const dayEnd = new Date(dayStart.getTime() + 86_400_000)
  const settings = await prisma.tenantSettings.findFirst()
  const minP = settings?.minProductiveMinutes ?? 480
  const halfP = settings?.halfDayMinutes ?? 240

  const [employees, activeByUser, credits] = await Promise.all([
    prisma.employee.findMany({ where: { status: { not: 'exited' } }, select: { id: true, userId: true } }),
    activeMinutesByUser(dayStart, dayEnd),
    prisma.attendanceAdjustment.findMany({ where: { date: dayStart, state: 'approved' }, select: { employeeId: true, minutes: true } }),
  ])
  const creditByEmp = new Map<string, number>()
  for (const c of credits) creditByEmp.set(c.employeeId, (creditByEmp.get(c.employeeId) ?? 0) + c.minutes)

  let written = 0
  for (const emp of employees) {
    const productive = activeByUser.get(emp.userId) ?? 0
    const credit = creditByEmp.get(emp.id) ?? 0
    const existing = await prisma.attendanceRecord.findFirst({ where: { employeeId: emp.id, date: dayStart } })
    if (existing && (existing.mode === 'leave' || existing.mode === 'holiday')) continue
    if (productive === 0 && credit === 0 && !existing) continue // nothing to record

    const effective = productive + credit
    const status: AttendanceStatus = effective >= minP ? 'present' : effective >= halfP ? 'half_day' : 'absent'
    if (existing) {
      await prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: { productiveMinutes: productive, creditMinutes: credit, status },
      })
    } else {
      await prisma.attendanceRecord.create({
        data: scoped({ employeeId: emp.id, date: dayStart, productiveMinutes: productive, creditMinutes: credit, status, mode: 'office' }),
      })
    }
    written++
  }
  return written
}

export type LoginHoursRow = {
  employeeId: string
  name: string
  department: string | null
  inAt: Date | null
  outAt: Date | null
  productiveMinutes: number
  creditMinutes: number
  status: AttendanceStatus | null
  pendingCredit: { id: string; minutes: number; reason: string } | null
}

/** Per-employee login hours + attendance for a day (recomputes first). */
export async function getLoginHours(dayStart: Date): Promise<LoginHoursRow[]> {
  await computeDayAttendance(dayStart)
  const [employees, users, departments, records, pending] = await Promise.all([
    prisma.employee.findMany({ where: { status: { not: 'exited' } } }),
    prisma.user.findMany({ select: { id: true, name: true } }),
    prisma.department.findMany({ select: { id: true, name: true } }),
    prisma.attendanceRecord.findMany({ where: { date: dayStart } }),
    prisma.attendanceAdjustment.findMany({ where: { date: dayStart, state: 'pending' } }),
  ])
  const userName = new Map(users.map((u) => [u.id, u.name]))
  const deptName = new Map(departments.map((d) => [d.id, d.name]))
  const recByEmp = new Map(records.map((r) => [r.employeeId, r]))
  const pendByEmp = new Map(pending.map((p) => [p.employeeId, p]))

  return employees
    .map((e) => {
      const r = recByEmp.get(e.id)
      const p = pendByEmp.get(e.id)
      return {
        employeeId: e.id,
        name: userName.get(e.userId) ?? '—',
        department: e.departmentId ? deptName.get(e.departmentId) ?? null : null,
        inAt: r?.inAt ?? null,
        outAt: r?.outAt ?? null,
        productiveMinutes: r?.productiveMinutes ?? 0,
        creditMinutes: r?.creditMinutes ?? 0,
        status: (r?.status as AttendanceStatus | undefined) ?? null,
        pendingCredit: p ? { id: p.id, minutes: p.minutes, reason: p.reason } : null,
      }
    })
    .sort((a, b) => b.productiveMinutes - a.productiveMinutes)
}

/** HR requests excess-hours credit for an employee (pending Admin approval). */
export async function requestAttendanceCredit(input: {
  employeeId: string
  date: Date
  minutes: number
  reason: string
  requestedBy: string | null
}): Promise<void> {
  await prisma.attendanceAdjustment.create({
    data: scoped({
      employeeId: input.employeeId,
      date: input.date,
      minutes: input.minutes,
      reason: input.reason,
      requestedBy: input.requestedBy,
    }),
  })
  await audit('attendance.credit_requested', 'employee', input.employeeId, null, { minutes: input.minutes, date: input.date.toISOString().slice(0, 10) })
}

/** Admin decides a credit request; on approval the day is auto-recomputed. */
export async function decideAttendanceCredit(id: string, approve: boolean, approverId: string | null): Promise<void> {
  const adj = await prisma.attendanceAdjustment.findFirstOrThrow({ where: { id } })
  if (adj.state !== 'pending') return
  await prisma.attendanceAdjustment.update({
    where: { id },
    data: { state: approve ? 'approved' : 'rejected', approvedBy: approverId, decidedAt: new Date() },
  })
  await audit('attendance.credit_decided', 'employee', adj.employeeId, { state: 'pending' }, { state: approve ? 'approved' : 'rejected' })
  if (approve) await computeDayAttendance(adj.date) // auto-mark with the credit applied
}

/** Current user's own summary for the header punch widget. */
export async function getSelfDaySummary(userId: string, dayStart: Date) {
  const emp = await prisma.employee.findUnique({ where: { userId }, select: { id: true } })
  if (!emp) return null
  const dayEnd = new Date(dayStart.getTime() + 86_400_000)
  const [record, active] = await Promise.all([
    prisma.attendanceRecord.findFirst({ where: { employeeId: emp.id, date: dayStart } }),
    activeMinutesByUser(dayStart, dayEnd),
  ])
  return {
    punchedIn: !!record?.inAt && !record?.outAt,
    inAt: record?.inAt ?? null,
    outAt: record?.outAt ?? null,
    activeMinutes: active.get(userId) ?? 0,
  }
}
