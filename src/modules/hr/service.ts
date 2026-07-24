// HR domain service (doc 06, FR-4.1–4.13).
import bcrypt from 'bcryptjs'
import { audit } from '@/lib/audit'
import { requireTenantContext } from '@/lib/db/context'
import { prisma, scoped } from '@/lib/db/prisma'
import { notify } from '@/lib/notify'

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
  // Current-year leave balances from seeded types (FR-4.10).
  const year = new Date().getFullYear()
  for (const type of await prisma.leaveType.findMany()) {
    await prisma.leaveBalance.create({
      data: scoped({ employeeId: employee.id, typeId: type.id, year, available: type.annualQuota }),
    })
  }
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

/** Leave request (FR-4.9) with balance check; routed to the reporting manager. */
export async function requestLeave(
  employeeId: string,
  input: { typeId: string; fromOn: Date; toOn: Date; reason: string },
): Promise<Result> {
  const days = Math.round((input.toOn.getTime() - input.fromOn.getTime()) / 86_400_000) + 1
  if (days <= 0) return { ok: false, error: 'End date must be on/after start date' }
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
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } })
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
