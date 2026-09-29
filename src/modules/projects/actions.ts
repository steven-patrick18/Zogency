'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit } from '@/lib/audit'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma, scoped } from '@/lib/db/prisma'

export type ProjectActionState = { error?: string; success?: string }

const schema = z.object({
  name: z.string().min(1, 'Project name required'),
  clientId: z.string().uuid('Pick a client'),
  type: z.enum(['one_off', 'retainer']).default('one_off'),
  startOn: z.string().optional().or(z.literal('')),
  endOn: z.string().optional().or(z.literal('')),
})

export async function createProjectAction(_p: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  await requirePermission('clients.edit')
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const d = parsed.data
  await withTenant(async () => {
    const project = await prisma.project.create({
      data: scoped({
        name: d.name,
        clientId: d.clientId,
        type: d.type,
        startOn: d.startOn ? new Date(d.startOn) : null,
        endOn: d.endOn ? new Date(d.endOn) : null,
      }),
    })
    await audit('project.create', 'project', project.id, null, { name: d.name })
  })
  revalidatePath('/projects')
  return { success: 'Project created' }
}

const updateSchema = schema.extend({
  projectId: z.string().uuid(),
  status: z.enum(['active', 'paused', 'completed']),
}).omit({ clientId: true })

/**
 * Edit an existing project (BRB issue #4, second half): a one-off engagement
 * that the client decides to retain becomes a retainer here — the type, the
 * dates and the status are all editable instead of frozen at creation.
 * The client is deliberately not reassignable: that would silently move
 * delivery history, invoices and tasks between accounts.
 */
export async function updateProjectAction(_p: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  await requirePermission('clients.edit')
  const parsed = updateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const d = parsed.data

  try {
    await withTenant(async () => {
      const before = await prisma.project.findUniqueOrThrow({ where: { id: d.projectId } })
      await prisma.project.update({
        where: { id: d.projectId },
        data: {
          name: d.name,
          type: d.type,
          status: d.status,
          startOn: d.startOn ? new Date(d.startOn) : null,
          endOn: d.endOn ? new Date(d.endOn) : null,
        },
      })
      await audit(
        'project.update',
        'project',
        d.projectId,
        { name: before.name, type: before.type, status: before.status, startOn: before.startOn, endOn: before.endOn },
        { name: d.name, type: d.type, status: d.status, startOn: d.startOn || null, endOn: d.endOn || null },
      )
    })
  } catch {
    return { error: 'Could not save the project' }
  }
  revalidatePath('/projects')
  revalidatePath(`/projects/${d.projectId}`)
  return { success: 'Project updated' }
}
