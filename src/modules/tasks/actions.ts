'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit } from '@/lib/audit'
import { requirePermission, requireSession, withTenant } from '@/lib/authz'
import { prisma, scoped } from '@/lib/db/prisma'

export type TaskActionState = { error?: string; success?: string }

const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done', 'blocked'] as const

export async function changeTaskStatusAction(formData: FormData) {
  const session = await requirePermission('tasks.edit')
  const taskId = z.string().uuid().parse(formData.get('taskId'))
  const to = z.enum(TASK_STATUSES).parse(formData.get('to'))

  await withTenant(async () => {
    const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } })
    if (task.status === to) return
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
    await audit('task.status_change', 'task', taskId, { status: task.status }, { status: to })
  })
  revalidatePath('/tasks')
}

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title required'),
  projectId: z.string().uuid().optional().or(z.literal('')),
  departmentId: z.string().uuid().optional().or(z.literal('')),
  deadline: z.string().optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
})
const uuid = z.string().uuid()

/** Assignees come as repeated `assigneeIds` fields (multi-select, BRB). */
function readAssigneeIds(formData: FormData, fallback: string): string[] {
  const ids = [...new Set(formData.getAll('assigneeIds').map(String).filter((v) => uuid.safeParse(v).success))]
  return ids.length > 0 ? ids : [fallback]
}

export async function createTaskAction(_p: TaskActionState, formData: FormData): Promise<TaskActionState> {
  const session = await requireSession()
  await requirePermission('tasks.edit')
  const parsed = createTaskSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const d = parsed.data
  const assigneeIds = readAssigneeIds(formData, session.user.id)

  await withTenant(async () => {
    const task = await prisma.task.create({
      data: scoped({
        title: d.title,
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
    await prisma.taskAssignee.deleteMany({ where: { taskId } })
    await prisma.taskAssignee.createMany({
      data: assigneeIds.map((userId) => scoped({ taskId, userId })),
      skipDuplicates: true,
    })
    await prisma.task.update({ where: { id: taskId }, data: { assigneeId: assigneeIds[0] } })
    await audit('task.reassign', 'task', taskId, null, { assignees: assigneeIds.length })
  })
  revalidatePath('/tasks')
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
