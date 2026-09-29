// Chat data for the WhatsApp-style workspace: the conversation rail (last
// message + unread count per channel) and the message list for the open one.
import { prisma } from '@/lib/db/prisma'

export const CHANNELS = ['general', 'sales', 'delivery', 'marketing'] as const

/** A DM channel id is deterministic for a pair of users: dm:<idA>:<idB> sorted. */
export function dmChannel(a: string, b: string): string {
  return 'dm:' + [a, b].sort().join(':')
}

export function dmParticipants(channel: string): string[] {
  return channel.startsWith('dm:') ? channel.slice(3).split(':') : []
}

export function isParticipant(channel: string, userId: string): boolean {
  return !channel.startsWith('dm:') || dmParticipants(channel).includes(userId)
}

export type ChatMessageView = {
  id: string
  authorId: string
  author: string
  avatar: string | null
  body: string
  at: string
  mine: boolean
}

export type ConversationView = {
  channel: string
  label: string
  kind: 'channel' | 'dm'
  avatar: string | null
  lastBody: string | null
  lastAt: string | null
  unread: number
}

type UserRow = { id: string; name: string; avatar: string | null }

function toView(
  m: { id: string; authorId: string; body: string; createdAt: Date },
  users: Map<string, UserRow>,
  me: string,
): ChatMessageView {
  const u = users.get(m.authorId)
  return {
    id: m.id,
    authorId: m.authorId,
    author: u?.name ?? 'Unknown',
    avatar: u?.avatar ?? null,
    body: m.body,
    at: m.createdAt.toISOString(),
    mine: m.authorId === me,
  }
}

/** Messages for one channel, oldest first. `after` fetches only newer ones. */
export async function getMessages(
  channel: string,
  me: string,
  users: Map<string, UserRow>,
  after?: Date,
): Promise<ChatMessageView[]> {
  if (after) {
    const rows = await prisma.chatMessage.findMany({
      where: { channel, createdAt: { gt: after } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    })
    return rows.map((m) => toView(m, users, me))
  }
  // First load: the newest 100, flipped back into reading order.
  const rows = await prisma.chatMessage.findMany({
    where: { channel },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return rows.reverse().map((m) => toView(m, users, me))
}

/**
 * The conversation rail: every public channel, plus each teammate as a DM.
 * Unread = messages by someone else newer than this user's read cursor.
 * A DM with no history yet still appears, so you can start one.
 */
export async function getConversations(me: string, users: UserRow[]): Promise<ConversationView[]> {
  const others = users.filter((u) => u.id !== me)
  const channels = [...CHANNELS, ...others.map((u) => dmChannel(me, u.id))]

  const [reads, lastMessages, unreadRows] = await Promise.all([
    prisma.chatRead.findMany({ where: { userId: me } }),
    // One pass over recent traffic is cheaper than a query per conversation at
    // this scale; the newest row per channel wins.
    prisma.chatMessage.findMany({
      where: { channel: { in: channels } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { channel: true, body: true, createdAt: true, authorId: true },
    }),
    prisma.chatMessage.findMany({
      where: { channel: { in: channels }, authorId: { not: me } },
      select: { channel: true, createdAt: true },
    }),
  ])

  const readAt = new Map(reads.map((r) => [r.channel, r.lastReadAt]))
  const last = new Map<string, { body: string; at: Date; authorId: string }>()
  for (const m of lastMessages) {
    if (!last.has(m.channel)) last.set(m.channel, { body: m.body, at: m.createdAt, authorId: m.authorId })
  }
  const unread = new Map<string, number>()
  for (const m of unreadRows) {
    const cursor = readAt.get(m.channel)
    if (!cursor || m.createdAt > cursor) unread.set(m.channel, (unread.get(m.channel) ?? 0) + 1)
  }

  const byId = new Map(users.map((u) => [u.id, u]))
  const rows: ConversationView[] = channels.map((channel) => {
    const isDm = channel.startsWith('dm:')
    const otherId = isDm ? dmParticipants(channel).find((id) => id !== me) : null
    const other = otherId ? byId.get(otherId) : null
    const l = last.get(channel)
    return {
      channel,
      kind: isDm ? 'dm' : 'channel',
      label: isDm ? (other?.name ?? 'teammate') : `#${channel}`,
      avatar: isDm ? (other?.avatar ?? null) : null,
      lastBody: l?.body ?? null,
      lastAt: l?.at.toISOString() ?? null,
      unread: unread.get(channel) ?? 0,
    }
  })

  // Most recent conversation first; ones that have never been used sink to the
  // bottom but stay visible so a DM can be started.
  return rows.sort((a, b) => {
    if (a.lastAt && b.lastAt) return a.lastAt < b.lastAt ? 1 : -1
    if (a.lastAt) return -1
    if (b.lastAt) return 1
    return a.label.localeCompare(b.label)
  })
}

/** Moves this user's read cursor for a channel to now. */
export async function markRead(me: string, channel: string, tenantId: string): Promise<void> {
  await prisma.chatRead.upsert({
    where: { userId_channel: { userId: me, channel } },
    update: { lastReadAt: new Date() },
    create: { tenantId, userId: me, channel, lastReadAt: new Date() },
  })
}
