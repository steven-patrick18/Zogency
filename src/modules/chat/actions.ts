'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@/generated/prisma/client'
import { requireSession, withTenant } from '@/lib/authz'
import { prisma, scoped } from '@/lib/db/prisma'
import { notify } from '@/lib/notify'

// Internal team chat. @mentions resolve to users by name and notify them.
export async function postChatAction(formData: FormData) {
  const session = await requireSession()
  const channel = String(formData.get('channel') ?? 'general').slice(0, 40)
  const body = String(formData.get('body') ?? '').trim()
  if (!body) return
  await withTenant(async () => {
    // Resolve @Name mentions against active users — match the full name first
    // (picker inserts it), then the first name as a fallback.
    const users = await prisma.user.findMany({ where: { status: 'active' }, select: { id: true, name: true } })
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const mentioned = users
      .filter((u) => {
        const first = u.name.split(' ')[0]
        return new RegExp(`@(${esc(u.name)}|${esc(first)})\\b`, 'i').test(body)
      })
      .map((u) => u.id)
    await prisma.chatMessage.create({
      data: scoped({ channel, authorId: session.user.id, body, mentions: mentioned as unknown as Prisma.InputJsonValue }),
    })
    for (const userId of mentioned) {
      if (userId !== session.user.id) {
        await notify(userId, 'chat.mention', { by: session.user.name, channel })
      }
    }
  })
  revalidatePath('/chat')
}
