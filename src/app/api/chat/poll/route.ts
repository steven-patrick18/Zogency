// Chat polling endpoint. POST (not GET) because opening a conversation also
// moves the caller's read cursor — a side effect that does not belong on a GET.
import { NextRequest, NextResponse } from 'next/server'
import { requireSession, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { canAccessChannel, getConversations, getMessages, markRead } from '@/modules/chat/service'

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const me = session.user.id

  let body: { channel?: string; after?: string; read?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const channel = String(body.channel ?? 'general').slice(0, 80)
  const after = body.after ? new Date(body.after) : undefined
  const validAfter = after && !Number.isNaN(after.getTime()) ? after : undefined

  const data = await withTenant(async () => {
    // Private conversations are never served to an outsider, even if they
    // guess the channel id. Group membership lives in the DB, so this is
    // checked inside tenant context.
    if (!(await canAccessChannel(channel, me))) return null
    const users = await prisma.user.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, avatar: true },
    })
    const byId = new Map(users.map((u) => [u.id, u]))
    const messages = await getMessages(channel, me, byId, validAfter)
    // Mark read AFTER reading, so the unread counts in this same response
    // already reflect the conversation the user is looking at.
    if (body.read !== false) await markRead(me, channel, session.user.tenantId)
    const conversations = await getConversations(me, users)
    return { messages, conversations }
  })

  if (!data) return NextResponse.json({ error: 'not a participant' }, { status: 403 })
  return NextResponse.json(data)
}
