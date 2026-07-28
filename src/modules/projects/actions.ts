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
