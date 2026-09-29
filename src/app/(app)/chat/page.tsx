import { requireSession, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import {
  getConversations,
  getMessages,
  isParticipant,
  markRead,
  CHANNELS,
} from '@/modules/chat/service'
import { ChatWorkspace } from './chat-workspace'

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>
}) {
  const session = await requireSession()
  const me = session.user.id
  const raw = (await searchParams).channel ?? 'general'

  const data = await withTenant(async () => {
    const users = await prisma.user.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, avatar: true },
      orderBy: { name: 'asc' },
    })
    // Fall back to #general for an unknown channel or a DM this user is not in.
    const known = (CHANNELS as readonly string[]).includes(raw) || raw.startsWith('dm:')
    const channel = known && isParticipant(raw, me) ? raw : 'general'

    const byId = new Map(users.map((u) => [u.id, u]))
    const messages = await getMessages(channel, me, byId)
    await markRead(me, channel, session.user.tenantId)
    const conversations = await getConversations(me, users)
    return { channel, messages, conversations, users }
  })

  return (
    <div className="flex h-full min-h-0 flex-col">
      <h1 className="text-2xl font-bold text-slate-900">Team chat</h1>
      <p className="mt-1 mb-3 text-sm text-slate-500">
        Channels are seen by everyone; direct messages are private between you and one teammate.
      </p>
      <div className="min-h-0 flex-1">
        <ChatWorkspace
          me={me}
          initialChannel={data.channel}
          initialMessages={data.messages}
          initialConversations={data.conversations}
          users={data.users.map((u) => ({ id: u.id, name: u.name }))}
        />
      </div>
    </div>
  )
}
