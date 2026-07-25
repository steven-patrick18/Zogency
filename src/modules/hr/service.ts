// HR domain service (doc 06, FR-4.1–4.13).
import bcrypt from 'bcryptjs'
import { audit } from '@/lib/audit'
import { requireTenantContext } from '@/lib/db/context'
import { prisma, scoped } from '@/lib/db/prisma'
import { notify } from '@/lib/notify'
import { accrualDueMonths, assessLeave, type LeaveContext, type WoffAdjacency } from './leave-rules'

type Result = { ok: true } | { ok: false; error: string }

export type StageName = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'

// Base new-hire checklist (FR-4.5) incl. BGV/joining-docs/IT per doc 11 Q15.
const ONBOARDING_ITEMS = [
  'Collect joining documents (ID, address, education, bank)',
  'Background verification initiated',
  'Workstation, email & system access provisioned',
  'Induction: policies, code of conduct, benefits',
  'Buddy assigned & team introduction',
]

/** Candidate stage machine (FR-4.2) with append-only history. */
export async function moveCandidateStage(
  candidateId: string,
  to: StageName,
  opts: { rejectionReason?: string } = {},
): Promise<Result> {
  const ctx = requireTenantContext()
  const candidate = await prisma.candidate.findUniqueOrThrow({ where: { id: candidateId } })
  if (candidate.currentStage === 'hired' || candidate.currentStage === 'rejected') {
    return { ok: false, error: `Candidate is already ${candidate.currentStage}` }
  }
  if (to === 'rejected' && !opts.rejectionReason) {
    return { ok: false, error: 'A rejection reason is required' }
  }
  if (to === 'hired') {
    const offer = await prisma.offer.findUnique({ where: { candidateId } })
    if (offer?.status !== 'accepted') {
      return { ok: false, error: 'The candidate must have an accepted offer before hiring (FR-4.4).' }
    }
  }
  await prisma.candidate.update({
    where: { id: candidateId },
    data: { currentStage: to, rejectionReason: to === 'rejected' ? opts.rejectionReason : null },
  })
  await prisma.candidateStageHistory.create({
    data: scoped({ candidateId, from: candidate.currentStage, to, actorId: ctx.userId ?? null }),
  })
  await audit('candidate.stage_change', 'candidate', candidateId,
    { stage: candidate.currentStage }, { stage: to })
  return { ok: true }
}

/**
 * Hire flow (FR-4.6): candidate → user account + employee record, Day-1
 * auto-link to department + manager, onboarding checklist, leave balances.
 */
export async function hireCandidate(
  candidateId: string,
  input: { departmentId: string; managerId: string; designation: string; tempPassword: string },
): Promise<Result & { employeeId?: string }> {
  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { id: candidateId },
    include: { offer: true },
  })
  const moved = await moveCandidateStage(candidateId, 'hired')
  if (!moved.ok) return moved
  if (!candidate.email) return { ok: false, error: 'Candidate needs an email to create their account' }

  const user = await prisma.user.create({
    data: scoped({
      name: candidate.name,
      email: candidate.email.toLowerCase(),
      phone: candidate.phone,
      passwordHash: await bcrypt.hash(input.tempPassword, 12),
    }),
  })
  const employee = await prisma.employee.create({
    data: scoped({
      userId: user.id,
      departmentId: input.departmentId,
      managerId: input.managerId,
      designation: input.designation,
      joinedOn: candidate.offer?.joiningOn ?? new Date(),
      probationEndsOn: new Date(Date.now() + 90 * 86_400_000),
    }),
  })
  for (const title of ONBOARDING_ITEMS) {
    await prisma.employeeOnboardingItem.create({ data: scoped({ employeeId: employee.id, title }) })
  }
  // Current-year leave balances (FR-4.10). Accrual types start empty and are
  // pro-rated by runLeaveAccrual below; fixed-quota types are granted in full.
  const year = new Date().getFullYear()
  for (const type of await prisma.leaveType.findMany()) {
    await prisma.leaveBalance.create({
      data: scoped({
        employeeId: employee.id,
        typeId: type.id,
        year,
        available: type.accrualPerMonth > 0 ? 0 : type.annualQuota,
      }),
    })
  }
  await runLeaveAccrual() // grant accrued-to-date for the joining month onward
  await notify(input.managerId, 'hr.new_hire', { name: candidate.name, designation: input.designation })
  await audit('employee.hired', 'employee', employee.id, null, {
    candidateId, designation: input.designation,
  })
  const requisition = await prisma.jobRequisition.findUniqueOrThrow({ where: { id: candidate.requisitionId } })
  const hiredCount = await prisma.candidate.count({
    where: { requisitionId: requisition.id, currentStage: 'hired' },
  })
  if (hiredCount >= requisition.headcount) {
    await prisma.jobRequisition.update({ where: { id: requisition.id }, data: { status: 'filled' } })
  }
  return { ok: true, employeeId: employee.id }
}

/** Attendance punch (FR-4.8): one row per employee per day, in/out updates. */
export async function punchAttendance(
  employeeId: string,
  mode: 'office' | 'wfh',
): Promise<Result & { action?: 'in' | 'out' }> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const existing = await prisma.attendanceRecord.findFirst({
    where: { employeeId, date: today },
  })
  if (!existing) {
    await prisma.attendanceRecord.create({
      data: scoped({ employeeId, date: today, inAt: new Date(), mode }),
    })
    return { ok: true, action: 'in' }
  }
  if (existing.outAt) return { ok: false, error: 'Already punched out for today' }
  await prisma.attendanceRecord.update({ where: { id: existing.id }, data: { outAt: new Date() } })
  return { ok: true, action: 'out' }
}

/**
 * Leave request (FR-4.9) with strict-policy enforcement + balance check; routed
 * to the reporting manager. All rules (consecutive caps, WOFF adjacency,
 * clubbing, continuous-absence cap, advance notice) come from the configured
 * leave type + tenant policy, so they stay admin-editable.
 */
export async function requestLeave(
  employeeId: string,
  input: { typeId: string; fromOn: Date; toOn: Date; reason: string; isEmergency?: boolean },
): Promise<Result> {
  const [type, employee, settings] = await Promise.all([
    prisma.leaveType.findUnique({ where: { id: input.typeId } }),
    prisma.employee.findUniqueOrThrow({ where: { id: employeeId } }),
    prisma.tenantSettings.findFirst(),
  ])
  if (!type) return { ok: false, error: 'Unknown leave type' }

  // Context for the rule engine: employee weekly-offs, company holidays, and the
  // employee's other approved/pending leaves (to detect clubbing / overlaps).
  const [holidays, existing] = await Promise.all([
    prisma.holiday.findMany({ select: { date: true } }),
    prisma.leaveRequest.findMany({
      where: { employeeId, state: { in: ['pending', 'approved'] } },
      include: { type: { select: { name: true } } },
    }),
  ])
  const ctx: LeaveContext = {
    weeklyOffDays: employee.weeklyOffDays,
    holidays: new Set(holidays.map((h) => h.date.toISOString().slice(0, 10))),
    existingLeaves: existing.map((l) => ({ fromOn: l.fromOn, toOn: l.toOn, typeId: l.typeId, typeName: l.type.name })),
    maxContinuousAbsenceDays: settings?.maxContinuousAbsenceDays ?? 4,
    plannedNoticeDays: settings?.plannedLeaveNoticeDays ?? 2,
    today: new Date(new Date().toISOString().slice(0, 10)), // UTC midnight today
  }

  const assessment = assessLeave(
    { fromOn: input.fromOn, toOn: input.toOn, isEmergency: input.isEmergency },
    {
      id: type.id,
      name: type.name,
      maxConsecutive: type.maxConsecutive,
      woffAdjacency: type.woffAdjacency as WoffAdjacency,
      standaloneOnly: type.standaloneOnly,
      clubbableWithLeave: type.clubbableWithLeave,
    },
    ctx,
  )
  if (!assessment.ok) return { ok: false, error: assessment.error }
  const days = assessment.leaveDays

  const year = input.fromOn.getFullYear()
  const balance = await prisma.leaveBalance.findFirst({
    where: { employeeId, typeId: input.typeId, year },
  })
  if (!balance || balance.available - balance.used < days) {
    return { ok: false, error: `Insufficient balance: ${balance ? balance.available - balance.used : 0} day(s) left, ${days} requested.` }
  }
  await prisma.leaveRequest.create({
    data: scoped({ employeeId, typeId: input.typeId, fromOn: input.fromOn, toOn: input.toOn, days, reason: input.reason }),
  })
  if (employee.managerId) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: employee.userId } })
    await notify(employee.managerId, 'hr.leave_requested', { name: user.name, days })
  }
  return { ok: true }
}

/** Manager decision (FR-4.9); approval deducts the balance (FR-4.10). */
export async function decideLeave(
  requestId: string,
  decision: 'approved' | 'rejected',
): Promise<Result> {
  const ctx = requireTenantContext()
  const request = await prisma.leaveRequest.findUniqueOrThrow({ where: { id: requestId } })
  if (request.state !== 'pending') return { ok: false, error: 'Already decided' }
  await prisma.leaveRequest.update({
    where: { id: requestId },
    data: { state: decision, decidedBy: ctx.userId, decidedAt: new Date() },
  })
  if (decision === 'approved') {
    await prisma.leaveBalance.updateMany({
      where: { employeeId: request.employeeId, typeId: request.typeId, year: request.fromOn.getFullYear() },
      data: { used: { increment: request.days } },
    })
  }
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: request.employeeId } })
  await notify(employee.userId, 'hr.leave_decided', { decision, days: request.days })
  await audit('leave.decided', 'leave_request', requestId, { state: 'pending' }, { state: decision })
  return { ok: true }
}

/** Confirm employment (probation cleared) — starts confirmation-gated accrual (EL). */
export async function confirmEmployment(employeeId: string): Promise<Result> {
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } })
  if (employee.confirmedOn) return { ok: false, error: 'Employee is already confirmed' }
  await prisma.employee.update({ where: { id: employeeId }, data: { confirmedOn: new Date() } })
  await audit('employee.confirmed', 'employee', employeeId, null, { confirmedOn: new Date().toISOString() })
  // Top up any confirmation-gated accrual immediately.
  await runLeaveAccrual()
  return { ok: true }
}

/** Set an employee's two rotational weekly-off days (0=Sun … 6=Sat). */
export async function setWeeklyOff(employeeId: string, days: number[]): Promise<Result> {
  const clean = [...new Set(days.filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b)
  if (clean.length === 0 || clean.length > 3) return { ok: false, error: 'Choose 1–3 weekly-off days.' }
  await prisma.employee.update({ where: { id: employeeId }, data: { weeklyOffDays: clean } })
  await audit('employee.weekly_off', 'employee', employeeId, null, { days: clean })
  return { ok: true }
}

/**
 * Monthly leave accrual (FR-4.10). Idempotent: each balance tracks accruedMonths
 * so re-running only tops up the shortfall. Accrual is pro-rated from the month
 * the employee became eligible (join month this year, or — for confirmation-
 * gated types like EL — the confirmation month) and capped at the annual quota.
 * Non-accrual types (accrualPerMonth = 0) are provisioned in full and skipped.
 */
export async function runLeaveAccrual(now = new Date()): Promise<number> {
  const year = now.getUTCFullYear()

  const [employees, types] = await Promise.all([
    prisma.employee.findMany({ where: { status: { not: 'exited' } } }),
    prisma.leaveType.findMany({ where: { accrualPerMonth: { gt: 0 } } }),
  ])
  let granted = 0
  for (const emp of employees) {
    for (const type of types) {
      const dueMonths = accrualDueMonths(type, emp, now)
      if (dueMonths === 0) continue

      const balance = await prisma.leaveBalance.findFirst({
        where: { employeeId: emp.id, typeId: type.id, year },
      })
      if (balance && balance.accruedMonths >= dueMonths) continue

      const already = balance?.accruedMonths ?? 0
      const grant = (dueMonths - already) * type.accrualPerMonth
      const base = balance?.available ?? 0
      const available = Math.min(base + grant, type.annualQuota)
      if (balance) {
        await prisma.leaveBalance.update({
          where: { id: balance.id },
          data: { available, accruedMonths: dueMonths },
        })
      } else {
        await prisma.leaveBalance.create({
          data: scoped({ employeeId: emp.id, typeId: type.id, year, available, accruedMonths: dueMonths }),
        })
      }
      granted++
    }
  }
  return granted
}

let lastAccrualAt = 0
/** Opportunistic accrual trigger on HR page loads; at most once/hour per process. */
export async function maybeRunLeaveAccrual(): Promise<void> {
  if (Date.now() - lastAccrualAt < 3_600_000) return
  lastAccrualAt = Date.now()
  await runLeaveAccrual()
}

/** Exit workflow (FR-4.7): record + access revocation (user disabled). */
export async function startExit(
  employeeId: string,
  input: { type: 'resignation' | 'termination'; noticeStartOn: Date; lastDayOn: Date; notes?: string },
): Promise<Result> {
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } })
  if (employee.status === 'exited') return { ok: false, error: 'Employee already exited' }
  await prisma.employeeExit.create({
    data: scoped({
      employeeId,
      type: input.type,
      noticeStartOn: input.noticeStartOn,
      lastDayOn: input.lastDayOn,
      exitInterviewNotes: input.notes ?? null,
    }),
  })
  await prisma.employee.update({ where: { id: employeeId }, data: { status: 'notice' } })
  await audit('employee.exit_started', 'employee', employeeId, null, { type: input.type })
  return { ok: true }
}

export async function completeExit(employeeId: string): Promise<Result> {
  const exit = await prisma.employeeExit.findUnique({ where: { employeeId } })
  if (!exit) return { ok: false, error: 'No exit record' }
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } })
  await prisma.employeeExit.update({
    where: { employeeId },
    data: { accessRevokedAt: new Date(), assetsRecovered: true },
  })
  await prisma.employee.update({
    where: { id: employeeId },
    data: { status: 'exited', exitedOn: new Date() },
  })
  // Access revocation — the user can no longer log in (audit-logged).
  await prisma.user.update({ where: { id: employee.userId }, data: { status: 'disabled' } })
  await audit('employee.exited', 'employee', employeeId, { status: employee.status }, { status: 'exited', accessRevoked: true })
  return { ok: true }
}

/** Department capacity (FR-4.11) — same tasks data as Delivery (FR-6.7). */
export async function getCapacityByDepartment() {
  const [departments, employees, users, tasks] = await Promise.all([
    prisma.department.findMany({ orderBy: { sort: 'asc' } }),
    prisma.employee.findMany({ where: { status: { not: 'exited' } } }),
    prisma.user.findMany({ select: { id: true, name: true } }),
    prisma.task.findMany({ where: { status: { notIn: ['done'] } } }),
  ])
  const userName = new Map(users.map((u) => [u.id, u.name]))
  return departments.map((dept) => ({
    department: dept.name,
    members: employees
      .filter((e) => e.departmentId === dept.id)
      .map((e) => ({
        name: userName.get(e.userId) ?? '?',
        openTasks: tasks.filter((t) => t.assigneeId === e.userId).length,
        overdue: tasks.filter(
          (t) => t.assigneeId === e.userId && t.deadline && t.deadline < new Date(),
        ).length,
      })),
    unassignedDeptTasks: tasks.filter((t) => t.departmentId === dept.id && !t.assigneeId).length,
  }))
}
