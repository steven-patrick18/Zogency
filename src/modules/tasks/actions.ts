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
  assigneeId: z.string().uuid().optional().or(z.literal('')),
  deadline: z.string().optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
})

export async function createTaskAction(_p: TaskActionState, formData: FormData): Promise<TaskActionState> {
  const session = await requireSession()
  await requirePermission('tasks.edit')
  const parsed = createTaskSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const d = parsed.data

  await withTenant(async () => {
    const task = await prisma.task.create({
      data: scoped({
        title: d.title,
        projectId: d.projectId || null,
        departmentId: d.departmentId || null,
        assigneeId: d.assigneeId || session.user.id,
        deadline: d.deadline ? new Date(d.deadline) : null,
        priority: d.priority,
      }),
    })
    await audit('task.create', 'task', task.id, null, { title: d.title })
  })
  revalidatePath('/tasks')
  return { success: 'Task created' }
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
