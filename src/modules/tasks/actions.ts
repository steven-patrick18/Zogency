'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit } from '@/lib/audit'
import { requirePermission, requireSession, withTenant } from '@/lib/authz'
import { prisma, scoped } from '@/lib/db/prisma'
import { notify } from '@/lib/notify'

export type TaskActionState = { error?: string; success?: string }

const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done', 'blocked'] as const

export async function changeTaskStatusAction(formData: FormData) {
  const session = await requirePermission('tasks.edit')
  const taskId = z.string().uuid().parse(formData.get('taskId'))
  const to = z.enum(TASK_STATUSES).parse(formData.get('to'))

  await withTenant(async () => {
    const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId }, include: { assignees: true } })
    if (task.status === to) return
    // Completion workflow gate (BRB): when enabled, a task must pass through
    // Review, and only an approver (approvals.act) can mark it Done.
    if (to === 'done') {
      const settings = await prisma.tenantSettings.findFirst({ select: { requireTaskApproval: true } })
      if (settings?.requireTaskApproval) {
        if (task.status !== 'review') throw new Error('Move the task to Review before it can be completed.')
        if (!session.user.permissions.includes('approvals.act')) {
          throw new Error('Only an approver can mark a task as Done.')
        }
      }
    }
    await prisma.task.update({ where: { id: taskId }, data: { status: to } })
    await prisma.taskStatusHistory.create({
      data: scoped({ taskId, from: task.status, to, actorId: session.user.id }),
    })
    // Deliverable status tracks its tasks (FR-6.6 basic).
    if (task.sowDeliverableId) {
      await prisma.sowDeliverable.update({
        where: { id: task.sowDeliverableId },
        data: { status: to === 'done' ? 'delivered' : 'in_progress' },
      })
    }
    // Notify the task's assignees (except whoever made the change).
    const by = session.user.name ?? 'Someone'
    for (const a of task.assignees) {
      if (a.userId !== session.user.id) {
        await notify(a.userId, 'task.status_changed', { by, title: task.title, status: to })
      }
    }
    await audit('task.status_change', 'task', taskId, { status: task.status }, { status: to })
  })
  revalidatePath('/tasks')
}

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title required'),
  description: z.string().max(4000).optional().or(z.literal('')),
  tags: z.string().max(500).optional().or(z.literal('')),
  projectId: z.string().uuid().optional().or(z.literal('')),
  departmentId: z.string().uuid().optional().or(z.literal('')),
  deadline: z.string().optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
})
const uuid = z.string().uuid()
const MAX_ATTACH_BYTES = 2_000_000

/** Read uploaded files → data-URIs (≤2MB each, up to 10). */
async function readAttachments(formData: FormData): Promise<Array<{ name: string; mimeType: string; data: string; size: number }>> {
  const files = formData.getAll('attachments').filter((f): f is File => f instanceof File && f.size > 0)
  const out: Array<{ name: string; mimeType: string; data: string; size: number }> = []
  for (const f of files.slice(0, 10)) {
    if (f.size > MAX_ATTACH_BYTES) continue
    const mime = f.type || 'application/octet-stream'
    const buf = Buffer.from(await f.arrayBuffer())
    out.push({ name: f.name.slice(0, 200), mimeType: mime, data: `data:${mime};base64,${buf.toString('base64')}`, size: f.size })
  }
  return out
}

/** Assignees come as repeated `assigneeIds` fields (multi-select, BRB). */
function readAssigneeIds(formData: FormData, fallback: string): string[] {
  const ids = [...new Set(formData.getAll('assigneeIds').map(String).filter((v) => uuid.safeParse(v).success))]
  return ids.length > 0 ? ids : [fallback]
}

/** Notify each assignee (except the actor) that a task landed on their plate. */
async function notifyAssigned(userIds: string[], actorId: string, actorName: string, title: string, deadline?: string) {
  for (const userId of userIds) {
    if (userId !== actorId) {
      await notify(userId, 'task.assigned', { by: actorName, title, deadline: deadline || null })
    }
  }
}

export async function createTaskAction(_p: TaskActionState, formData: FormData): Promise<TaskActionState> {
  const session = await requireSession()
  await requirePermission('tasks.edit')
  const parsed = createTaskSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const d = parsed.data
  const assigneeIds = readAssigneeIds(formData, session.user.id)
  const tags = [...new Set((d.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 10)
  const attachments = await readAttachments(formData)

  await withTenant(async () => {
    const task = await prisma.task.create({
      data: scoped({
        title: d.title,
        description: d.description || null,
        tags,
        projectId: d.projectId || null,
        departmentId: d.departmentId || null,
        assigneeId: assigneeIds[0], // primary assignee (legacy index)
        deadline: d.deadline ? new Date(d.deadline) : null,
        priority: d.priority,
      }),
    })
    await prisma.taskAssignee.createMany({
      data: assigneeIds.map((userId) => scoped({ taskId: task.id, userId })),
      skipDuplicates: true,
    })
    if (attachments.length > 0) {
      await prisma.taskAttachment.createMany({
        data: attachments.map((a) => scoped({ taskId: task.id, uploadedBy: session.user.id, ...a })),
      })
    }
    await notifyAssigned(assigneeIds, session.user.id, session.user.name ?? 'Someone', d.title, d.deadline)
    await audit('task.create', 'task', task.id, null, { title: d.title, assignees: assigneeIds.length })
  })
  revalidatePath('/tasks')
  return { success: 'Task created' }
}

/** Replace a task's assignee set (BRB — reassign to one or many). */
export async function setTaskAssigneesAction(formData: FormData): Promise<void> {
  const session = await requirePermission('tasks.edit')
  const taskId = uuid.parse(formData.get('taskId'))
  const assigneeIds = readAssigneeIds(formData, session.user.id)
  await withTenant(async () => {
    const before = await prisma.task.findUniqueOrThrow({ where: { id: taskId }, include: { assignees: true } })
    const prev = new Set(before.assignees.map((a) => a.userId))
    await prisma.taskAssignee.deleteMany({ where: { taskId } })
    await prisma.taskAssignee.createMany({
      data: assigneeIds.map((userId) => scoped({ taskId, userId })),
      skipDuplicates: true,
    })
    await prisma.task.update({ where: { id: taskId }, data: { assigneeId: assigneeIds[0] } })
    // Only notify the newly-added people.
    const fresh = assigneeIds.filter((id) => !prev.has(id))
    await notifyAssigned(fresh, session.user.id, session.user.name ?? 'Someone', before.title)
    await audit('task.reassign', 'task', taskId, null, { assignees: assigneeIds.length })
  })
  revalidatePath('/tasks')
}

/** Attach files to an existing task (from the task detail page). */
export async function addTaskAttachmentsAction(formData: FormData): Promise<void> {
  const session = await requirePermission('tasks.edit')
  const taskId = uuid.parse(formData.get('taskId'))
  const attachments = await readAttachments(formData)
  if (attachments.length === 0) return
  await withTenant(async () => {
    await prisma.taskAttachment.createMany({
      data: attachments.map((a) => scoped({ taskId, uploadedBy: session.user.id, ...a })),
    })
  })
  revalidatePath(`/tasks/${taskId}`)
}

export async function toggleOnboardingItemAction(formData: FormData) {
  await requirePermission('clients.edit')
  const itemId = z.string().uuid().parse(formData.get('itemId'))
  const clientId = z.string().uuid().parse(formData.get('clientId'))
  await withTenant(async () => {
    const item = await prisma.onboardingChecklistItem.findUniqueOrThrow({ where: { id: itemId } })
    await prisma.onboardingChecklistItem.update({
      where: { id: itemId },
      data: { doneAt: item.doneAt ? null : new Date() },
    })
  })
  revalidatePath(`/clients/${clientId}`)
}
