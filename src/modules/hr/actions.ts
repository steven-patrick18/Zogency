'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit } from '@/lib/audit'
import { requirePermission, requireSession, withTenant } from '@/lib/authz'
import { prisma, scoped } from '@/lib/db/prisma'
import {
  completeExit,
  confirmEmployment,
  decideLeave,
  hireCandidate,
  moveCandidateStage,
  punchAttendance,
  requestLeave,
  runLeaveAccrual,
  setWeeklyOff,
  startExit,
  type StageName,
} from './service'

export type HrActionState = { error?: string; success?: string }
type S = HrActionState
const uuid = z.string().uuid()

export async function createRequisitionAction(_p: S, formData: FormData): Promise<S> {
  const session = await requirePermission('hr.manage')
  const departmentId = uuid.parse(formData.get('departmentId'))
  const roleTitle = String(formData.get('roleTitle') ?? '').trim()
  const justification = String(formData.get('justification') ?? '').trim()
  const headcount = Number(formData.get('headcount') ?? 1)
  if (!roleTitle || !justification) return { error: 'Role and justification are required (FR-4.1)' }
  await withTenant(async () => {
    const req = await prisma.jobRequisition.create({
      data: scoped({
        departmentId,
        roleTitle,
        headcount,
        budgetRange: String(formData.get('budgetRange') ?? '') || null,
        justification,
        raisedBy: session.user.id,
      }),
    })
    await audit('requisition.create', 'job_requisition', req.id, null, { roleTitle, headcount })
  })
  revalidatePath('/hr')
  return { success: 'Requisition raised' }
}

export async function addCandidateAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('hr.manage')
  const requisitionId = uuid.parse(formData.get('requisitionId'))
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'Candidate name required' }
  await withTenant(async () => {
    await prisma.jobRequisition.findUniqueOrThrow({ where: { id: requisitionId } })
    const candidate = await prisma.candidate.create({
      data: scoped({
        requisitionId,
        name,
        phone: String(formData.get('phone') ?? '') || null,
        email: String(formData.get('email') ?? '') || null,
        noticePeriod: String(formData.get('noticePeriod') ?? '') || null,
        expectedCtc: String(formData.get('expectedCtc') ?? '') || null,
      }),
    })
    await prisma.candidateStageHistory.create({
      data: scoped({ candidateId: candidate.id, to: 'applied' }),
    })
  })
  revalidatePath('/hr')
  return { success: 'Candidate added' }
}

export async function moveCandidateAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('hr.manage')
  const candidateId = uuid.parse(formData.get('candidateId'))
  const to = String(formData.get('to')) as StageName
  const rejectionReason = String(formData.get('rejectionReason') ?? '') || undefined
  const r = await withTenant(() => moveCandidateStage(candidateId, to, { rejectionReason }))
  revalidatePath('/hr')
  return r.ok ? { success: `Moved to ${to}` } : { error: r.error }
}

export async function addInterviewFeedbackAction(_p: S, formData: FormData): Promise<S> {
  const session = await requirePermission('hr.manage')
  const candidateId = uuid.parse(formData.get('candidateId'))
  const feedback = String(formData.get('feedback') ?? '').trim()
  const recommendation = z.enum(['hire', 'no_hire']).parse(formData.get('recommendation'))
  if (!feedback) return { error: 'Feedback text required (FR-4.3)' }
  await withTenant(async () => {
    await prisma.candidate.findUniqueOrThrow({ where: { id: candidateId } })
    await prisma.candidateInterview.create({
      data: scoped({
        candidateId,
        round: String(formData.get('round') ?? 'technical'),
        interviewerId: session.user.id,
        feedback,
        recommendation,
      }),
    })
  })
  revalidatePath('/hr')
  return { success: 'Interview feedback recorded' }
}

export async function makeOfferAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('hr.view_salaries')
  const candidateId = uuid.parse(formData.get('candidateId'))
  const compensation = String(formData.get('compensation') ?? '').trim()
  const joiningOn = String(formData.get('joiningOn') ?? '')
  if (!compensation) return { error: 'Compensation is required (FR-4.4)' }
  await withTenant(async () => {
    await prisma.offer.upsert({
      where: { candidateId },
      update: { compensation, status: 'sent', joiningOn: joiningOn ? new Date(joiningOn) : null },
      create: scoped({
        candidateId,
        compensation,
        status: 'sent',
        joiningOn: joiningOn ? new Date(joiningOn) : null,
      }),
    })
    await audit('offer.sent', 'candidate', candidateId, null, { joiningOn })
  })
  revalidatePath('/hr')
  return { success: 'Offer sent' }
}

export async function offerStatusAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('hr.manage')
  const candidateId = uuid.parse(formData.get('candidateId'))
  const status = z.enum(['accepted', 'declined']).parse(formData.get('status'))
  await withTenant(() => prisma.offer.update({ where: { candidateId }, data: { status } }))
  revalidatePath('/hr')
  return { success: `Offer ${status}` }
}

const hireSchema = z.object({
  candidateId: uuid,
  departmentId: uuid,
  managerId: uuid,
  designation: z.string().min(1),
  tempPassword: z.string().min(8, 'Temp password min 8 chars'),
})

export async function hireCandidateAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('hr.manage')
  const parsed = hireSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Fill all hire fields' }
  const { candidateId, ...input } = parsed.data
  const r = await withTenant(() => hireCandidate(candidateId, input))
  revalidatePath('/hr')
  revalidatePath('/settings/users')
  return r.ok ? { success: 'Hired — user account, onboarding checklist and leave balances created' } : { error: r.error }
}

export async function punchAction(_p: S, formData: FormData): Promise<S> {
  const session = await requireSession()
  const mode = z.enum(['office', 'wfh']).parse(formData.get('mode') ?? 'office')
  const r = await withTenant(async () => {
    const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } })
    if (!employee) return { ok: false as const, error: 'You have no employee record — ask HR to link one.' }
    return punchAttendance(employee.id, mode)
  })
  revalidatePath('/hr')
  return r.ok ? { success: r.action === 'in' ? 'Punched in' : 'Punched out' } : { error: r.error }
}

const leaveSchema = z.object({
  typeId: uuid,
  fromOn: z.string().min(1),
  toOn: z.string().min(1),
  reason: z.string().min(1, 'Reason required'),
  emergency: z.string().optional(),
})

export async function requestLeaveAction(_p: S, formData: FormData): Promise<S> {
  const session = await requireSession()
  const parsed = leaveSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Fill all leave fields' }
  const r = await withTenant(async () => {
    const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } })
    if (!employee) return { ok: false as const, error: 'You have no employee record — ask HR to link one.' }
    return requestLeave(employee.id, {
      typeId: parsed.data.typeId,
      fromOn: new Date(parsed.data.fromOn),
      toOn: new Date(parsed.data.toOn),
      reason: parsed.data.reason,
      isEmergency: parsed.data.emergency === 'on',
    })
  })
  revalidatePath('/hr')
  return r.ok ? { success: 'Leave requested — your manager has been notified' } : { error: r.error }
}

export async function decideLeaveAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('hr.manage')
  const requestId = uuid.parse(formData.get('requestId'))
  const decision = z.enum(['approved', 'rejected']).parse(formData.get('decision'))
  const r = await withTenant(() => decideLeave(requestId, decision))
  revalidatePath('/hr')
  return r.ok ? { success: `Leave ${decision}` } : { error: r.error }
}

const exitSchema = z.object({
  employeeId: uuid,
  type: z.enum(['resignation', 'termination']),
  noticeStartOn: z.string().min(1),
  lastDayOn: z.string().min(1),
  notes: z.string().optional().or(z.literal('')),
})

export async function startExitAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('hr.manage')
  const parsed = exitSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Fill exit type and dates (FR-4.7)' }
  const { employeeId, type, noticeStartOn, lastDayOn, notes } = parsed.data
  const r = await withTenant(() =>
    startExit(employeeId, {
      type,
      noticeStartOn: new Date(noticeStartOn),
      lastDayOn: new Date(lastDayOn),
      notes: notes || undefined,
    }),
  )
  revalidatePath('/hr')
  return r.ok ? { success: 'Exit started — employee is on notice' } : { error: r.error }
}

export async function completeExitAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('hr.manage')
  const employeeId = uuid.parse(formData.get('employeeId'))
  const r = await withTenant(() => completeExit(employeeId))
  revalidatePath('/hr')
  revalidatePath('/settings/users')
  return r.ok ? { success: 'Exit completed — access revoked, assets recovered' } : { error: r.error }
}

export async function saveReviewAction(_p: S, formData: FormData): Promise<S> {
  const session = await requirePermission('hr.manage')
  const employeeId = uuid.parse(formData.get('employeeId'))
  const cycleId = uuid.parse(formData.get('cycleId'))
  const selfAssessment = String(formData.get('selfAssessment') ?? '') || null
  const managerReview = String(formData.get('managerReview') ?? '') || null
  const rating = Number(formData.get('finalRating') ?? 0)
  await withTenant(async () => {
    await prisma.performanceReview.upsert({
      where: { tenantId_employeeId_cycleId: { tenantId: session.user.tenantId, employeeId, cycleId } },
      update: { selfAssessment, managerReview, finalRating: rating || null, reviewedBy: session.user.id },
      create: scoped({
        employeeId,
        cycleId,
        selfAssessment,
        managerReview,
        finalRating: rating || null,
        reviewedBy: session.user.id,
      }),
    })
    await audit('review.saved', 'employee', employeeId, null, { cycleId, rating })
  })
  revalidatePath('/hr')
  return { success: 'Review saved' }
}

// ── Employee HRMS profile ───────────────────────────────────────────────────

const employeeUpdateSchema = z.object({
  employeeId: uuid,
  designation: z.string().min(1),
  departmentId: uuid.optional().or(z.literal('')),
  managerId: uuid.optional().or(z.literal('')),
  employmentType: z.enum(['permanent', 'contract', 'intern']),
})

export async function updateEmployeeAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('hr.manage')
  const parsed = employeeUpdateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const { employeeId, designation, departmentId, managerId, employmentType } = parsed.data
  await withTenant(async () => {
    const before = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } })
    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        designation,
        departmentId: departmentId || null,
        managerId: managerId || null,
        employmentType,
      },
    })
    await audit('employee.updated', 'employee', employeeId,
      { designation: before.designation, departmentId: before.departmentId, managerId: before.managerId },
      { designation, departmentId: departmentId || null, managerId: managerId || null })
  })
  revalidatePath(`/hr/employees/${employeeId}`)
  revalidatePath('/hr/employees')
  return { success: 'Employee details updated' }
}

const DOC_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
const DOC_MAX = 2_000_000

export async function uploadEmployeeDocAction(_p: S, formData: FormData): Promise<S> {
  const session = await requirePermission('hr.manage')
  const employeeId = uuid.parse(formData.get('employeeId'))
  const title = String(formData.get('title') ?? '').trim()
  const file = formData.get('file')
  if (!title) return { error: 'Document title required (e.g. Aadhaar, Offer letter)' }
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a file' }
  if (!DOC_TYPES.has(file.type)) return { error: 'PDF, PNG, JPEG or WebP only' }
  if (file.size > DOC_MAX) return { error: 'Max 2 MB per document (S3 storage lifts this later)' }

  await withTenant(async () => {
    await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } })
    const doc = await prisma.employeeDocument.create({
      data: scoped({
        employeeId,
        title,
        mime: file.type,
        size: file.size,
        dataUri: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`,
        uploadedBy: session.user.id,
      }),
    })
    await audit('employee.doc_uploaded', 'employee', employeeId, null, { title, docId: doc.id, size: file.size })
  })
  revalidatePath(`/hr/employees/${employeeId}`)
  return { success: 'Document uploaded' }
}

export async function deleteEmployeeDocAction(formData: FormData) {
  await requirePermission('hr.manage')
  const docId = uuid.parse(formData.get('docId'))
  const employeeId = uuid.parse(formData.get('employeeId'))
  await withTenant(async () => {
    await prisma.employeeDocument.delete({ where: { id: docId } })
    await audit('employee.doc_deleted', 'employee', employeeId, { docId }, null)
  })
  revalidatePath(`/hr/employees/${employeeId}`)
}

// Desktop monitoring agent token (issued per employee; requires signed consent).
export async function issueAgentTokenAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('hr.manage')
  const userId = uuid.parse(formData.get('userId'))
  const { randomBytes } = await import('node:crypto')
  const token = `zga_${randomBytes(24).toString('hex')}`
  await withTenant(async () => {
    await prisma.user.update({ where: { id: userId }, data: { agentToken: token } })
    await audit('agent.token_issued', 'user', userId, null, { issued: true })
  })
  revalidatePath('/hr/employees')
  return { success: `Agent token issued — paste into the desktop agent: ${token}` }
}

export async function revokeAgentTokenAction(formData: FormData) {
  await requirePermission('hr.manage')
  const userId = uuid.parse(formData.get('userId'))
  await withTenant(async () => {
    await prisma.user.update({ where: { id: userId }, data: { agentToken: null } })
    await audit('agent.token_revoked', 'user', userId, null, null)
  })
  revalidatePath('/hr/employees')
}

// ── Leave policy & company calendar (admin-managed) ─────────────────────────

export async function saveLeaveTypeAction(_p: S, formData: FormData): Promise<S> {
  const session = await requirePermission('hr.manage')
  const name = String(formData.get('name') ?? '').trim()
  const annualQuota = Number(formData.get('annualQuota'))
  if (!name || !annualQuota || annualQuota < 0) return { error: 'Name and a positive annual quota are required' }

  const num = (k: string, d = 0) => {
    const v = Number(formData.get(k))
    return Number.isFinite(v) && v >= 0 ? v : d
  }
  const woffAdjacency = String(formData.get('woffAdjacency') ?? 'allowed')
  const carryForwardMax = num('carryForwardMax')
  const rules = {
    code: String(formData.get('code') ?? '').trim() || null,
    carryForward: carryForwardMax > 0,
    carryForwardMax,
    accrualPerMonth: num('accrualPerMonth'),
    maxConsecutive: num('maxConsecutive'),
    woffAdjacency: ['allowed', 'limited1', 'forbidden'].includes(woffAdjacency) ? woffAdjacency : 'allowed',
    standaloneOnly: formData.get('standaloneOnly') === 'on',
    clubbableWithLeave: formData.get('clubbableWithLeave') === 'on',
    encashable: formData.get('encashable') === 'on',
    requiresConfirmation: formData.get('requiresConfirmation') === 'on',
  }

  await withTenant(async () => {
    const type = await prisma.leaveType.upsert({
      where: { tenantId_name: { tenantId: session.user.tenantId, name } },
      update: { annualQuota, ...rules },
      create: scoped({ name, annualQuota, ...rules }),
    })
    // Provision current-year balances for every active employee that lacks one
    // (existing balances keep their remaining days — quota changes apply to
    // future years / new employees).
    const year = new Date().getFullYear()
    const employees = await prisma.employee.findMany({ where: { status: { not: 'exited' } } })
    for (const employee of employees) {
      await prisma.leaveBalance.upsert({
        where: {
          tenantId_employeeId_typeId_year: {
            tenantId: session.user.tenantId, employeeId: employee.id, typeId: type.id, year,
          },
        },
        update: {},
        // Accrual types start empty (topped up by the accrual sweep); fixed-quota
        // types are granted in full.
        create: scoped({
          employeeId: employee.id,
          typeId: type.id,
          year,
          available: rules.accrualPerMonth > 0 ? 0 : annualQuota,
          openingBalance: rules.accrualPerMonth > 0 ? 0 : annualQuota,
        }),
      })
    }
    await runLeaveAccrual()
    await audit('leave_type.saved', 'leave_type', type.id, null, { name, annualQuota, ...rules })
  })
  revalidatePath('/hr/policy')
  return { success: `Leave policy "${name}" saved — balances provisioned for all active employees` }
}

export async function confirmEmploymentAction(formData: FormData) {
  await requirePermission('hr.manage')
  const employeeId = uuid.parse(formData.get('employeeId'))
  await withTenant(() => confirmEmployment(employeeId))
  revalidatePath(`/hr/employees/${employeeId}`)
}

export async function setWeeklyOffAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('hr.manage')
  const employeeId = uuid.parse(formData.get('employeeId'))
  const days = formData.getAll('days').map((d) => Number(d)).filter((n) => Number.isInteger(n))
  const r = await withTenant(() => setWeeklyOff(employeeId, days))
  revalidatePath(`/hr/employees/${employeeId}`)
  return r.ok ? { success: 'Weekly-offs updated.' } : { error: r.error }
}

/** Tenant-level leave caps: continuous-absence cap + planned-leave notice. */
export async function saveLeavePolicyAction(_p: S, formData: FormData): Promise<S> {
  const session = await requirePermission('hr.manage')
  const maxContinuousAbsenceDays = Math.max(1, Number(formData.get('maxContinuousAbsenceDays')) || 4)
  const plannedLeaveNoticeDays = Math.max(0, Number(formData.get('plannedLeaveNoticeDays')) || 0)
  await withTenant(async () => {
    await prisma.tenantSettings.update({
      where: { tenantId: session.user.tenantId },
      data: { maxContinuousAbsenceDays, plannedLeaveNoticeDays },
    })
    await audit('leave_policy.saved', 'tenant_settings', session.user.tenantId, null, {
      maxContinuousAbsenceDays, plannedLeaveNoticeDays,
    })
  })
  revalidatePath('/hr/policy')
  return { success: 'Leave caps updated.' }
}

export async function deleteLeaveTypeAction(formData: FormData) {
  await requirePermission('hr.manage')
  const typeId = uuid.parse(formData.get('typeId'))
  await withTenant(async () => {
    // History guard: block deletion if any leave was ever requested against it.
    const inUse = await prisma.leaveRequest.count({ where: { typeId } })
    if (inUse > 0) {
      throw new Error('This leave type has request history and cannot be deleted — set its quota to 0 to retire it.')
    }
    await prisma.leaveBalance.deleteMany({ where: { typeId } })
    const type = await prisma.leaveType.findUniqueOrThrow({ where: { id: typeId } })
    await prisma.leaveType.delete({ where: { id: typeId } })
    await audit('leave_type.deleted', 'leave_type', typeId, { name: type.name }, null)
  })
  revalidatePath('/hr/policy')
}

export async function addHolidayAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('hr.manage')
  const date = String(formData.get('date') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  if (!date || !name) return { error: 'Date and holiday name are required' }
  try {
    await withTenant(async () => {
      const holiday = await prisma.holiday.create({ data: scoped({ date: new Date(date), name }) })
      await audit('holiday.added', 'holiday', holiday.id, null, { date, name })
    })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') return { error: 'A holiday already exists on that date' }
    throw err
  }
  revalidatePath('/hr/policy')
  return { success: 'Holiday added to the company calendar' }
}

export async function removeHolidayAction(formData: FormData) {
  await requirePermission('hr.manage')
  const id = z.string().uuid().parse(formData.get('id'))
  await withTenant(async () => {
    await prisma.holiday.delete({ where: { id } })
    await audit('holiday.removed', 'holiday', id, null, null)
  })
  revalidatePath('/hr/policy')
}

export async function createCycleAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('hr.manage')
  const name = String(formData.get('name') ?? '').trim()
  const periodStart = String(formData.get('periodStart') ?? '')
  const periodEnd = String(formData.get('periodEnd') ?? '')
  if (!name || !periodStart || !periodEnd) return { error: 'Name and period required (FR-4.12)' }
  await withTenant(() =>
    prisma.performanceCycle.create({
      data: scoped({ name, periodStart: new Date(periodStart), periodEnd: new Date(periodEnd) }),
    }),
  )
  revalidatePath('/hr')
  return { success: 'Review cycle created' }
}
