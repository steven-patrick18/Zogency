'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@/generated/prisma/client'
import { requireSession, withTenant } from '@/lib/authz'
import { prisma, scoped } from '@/lib/db/prisma'
import { notify } from '@/lib/notify'
import { canAccessChannel, groupChannel } from './service'
import { z } from 'zod'

// Internal team chat. @mentions resolve to users by name and notify them.
export async function postChatAction(formData: FormData) {
  const session = await requireSession()
  const channel = String(formData.get('channel') ?? 'general').slice(0, 80)
  const body = String(formData.get('body') ?? '').trim()
  if (!body) return
  // Private conversations: a DM needs participation, a group needs membership.
  // Checked inside tenant context so the group lookup is scoped.
  const allowed = await withTenant(() => canAccessChannel(channel, session.user.id))
  if (!allowed) return
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
    // Notify group members (except the author and anyone already @mentioned).
    if (channel.startsWith('grp:')) {
      const members = await prisma.chatGroupMember.findMany({
        where: { groupId: channel.slice(4) },
        select: { userId: true },
      })
      const group = await prisma.chatGroup.findUnique({
        where: { id: channel.slice(4) },
        select: { name: true },
      })
      for (const m of members) {
        if (m.userId !== session.user.id && !mentioned.includes(m.userId)) {
          await notify(m.userId, 'chat.group', { by: session.user.name, channel: group?.name ?? 'a group' })
        }
      }
    }
    // Notify the DM recipient (unless they were already @mentioned).
    if (channel.startsWith('dm:')) {
      const other = channel.slice(3).split(':').find((id) => id !== session.user.id)
      if (other && !mentioned.includes(other)) {
        await notify(other, 'chat.dm', { by: session.user.name })
      }
    }
  })
  revalidatePath('/chat')
}

const groupSchema = z.object({
  name: z.string().min(1, 'Group name required').max(80),
})

export type GroupActionState = { error?: string; channel?: string }

/**
 * Create a chat group. The creator is always a member — otherwise they would
 * make a group they cannot see. Members are validated as active users in the
 * tenant, so a stray id cannot pull an outsider in.
 */
export async function createChatGroupAction(
  _p: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const session = await requireSession()
  const parsed = groupSchema.safeParse({ name: formData.get('name') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const uuid = z.string().uuid()
  const requested = [
    ...new Set(formData.getAll('memberIds').map(String).filter((v) => uuid.safeParse(v).success)),
  ]

  try {
    const channel = await withTenant(async () => {
      const valid = await prisma.user.findMany({
        where: { id: { in: requested }, status: 'active' },
        select: { id: true },
      })
      const memberIds = [...new Set([session.user.id, ...valid.map((u) => u.id)])]
      if (memberIds.length < 2) throw new Error('Pick at least one other person for the group')

      const group = await prisma.chatGroup.create({
        data: scoped({ name: parsed.data.name, createdById: session.user.id }),
      })
      await prisma.chatGroupMember.createMany({
        data: memberIds.map((userId) => scoped({ groupId: group.id, userId })),
        skipDuplicates: true,
      })
      for (const userId of memberIds) {
        if (userId !== session.user.id) {
          await notify(userId, 'chat.group_added', { by: session.user.name, channel: parsed.data.name })
        }
      }
      return groupChannel(group.id)
    })
    revalidatePath('/chat')
    return { channel }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not create the group' }
  }
}
