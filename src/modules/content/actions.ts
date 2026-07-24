'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit } from '@/lib/audit'
import { requirePermission, requireSession, withTenant } from '@/lib/authz'
import { prisma, scoped } from '@/lib/db/prisma'

export type ContentActionState = { error?: string; success?: string }

const schema = z.object({
  title: z.string().min(1),
  channel: z.enum(['instagram', 'facebook', 'blog', 'email', 'youtube', 'other']),
  scheduledOn: z.string().min(1),
  clientId: z.string().uuid().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})

export async function createContentAction(_p: ContentActionState, formData: FormData): Promise<ContentActionState> {
  const session = await requireSession()
  await requirePermission('campaigns.edit')
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const d = parsed.data
  await withTenant(async () => {
    const item = await prisma.contentItem.create({
      data: scoped({
        title: d.title,
        channel: d.channel,
        scheduledOn: new Date(d.scheduledOn),
        clientId: d.clientId || null,
        ownerId: session.user.id,
        notes: d.notes || null,
      }),
    })
    await audit('content.create', 'content_item', item.id, null, { title: d.title })
  })
  revalidatePath('/content')
  return { success: 'Content scheduled' }
}

export async function moveContentStatusAction(formData: FormData) {
  await requirePermission('campaigns.edit')
  const id = z.string().uuid().parse(formData.get('id'))
  const status = z.enum(['idea', 'drafting', 'review', 'scheduled', 'published']).parse(formData.get('status'))
  await withTenant(() => prisma.contentItem.update({ where: { id }, data: { status } }))
  revalidatePath('/content')
}

export async function deleteContentAction(formData: FormData) {
  await requirePermission('campaigns.edit')
  const id = z.string().uuid().parse(formData.get('id'))
  await withTenant(() => prisma.contentItem.delete({ where: { id } }))
  revalidatePath('/content')
}
