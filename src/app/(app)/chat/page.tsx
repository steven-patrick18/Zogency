import Link from 'next/link'
import { requireSession, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { ChatForm } from './chat-form'

const CHANNELS = ['general', 'sales', 'delivery', 'marketing'] as const

/** A DM channel id is deterministic for a pair of users: dm:<idA>:<idB> sorted. */
function dmChannel(a: string, b: string) {
  return 'dm:' + [a, b].sort().join(':')
}
function dmParticipants(channel: string): string[] {
  return channel.startsWith('dm:') ? channel.slice(3).split(':') : []
}

function renderBody(body: string) {
  // Highlight @mention tokens — but not the @ inside an email (must not be
  // preceded by a word char, dot or @).
  return body.split(/((?<![\w.@])@\w+)/g).map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="font-semibold text-indigo-600">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>
}) {
  const session = await requireSession()
  const me = session.user.id
  const params = await searchParams
  const raw = params.channel ?? 'general'

  const users = await withTenant(() => prisma.user.findMany({ where: { status: 'active' }, select: { id: true, name: true } }))
  const userName = new Map(users.map((u) => [u.id, u.name]))

  // Resolve channel: a public one, or a DM the current user is a participant of.
  const isPublic = (CHANNELS as readonly string[]).includes(raw)
  const isMyDm = raw.startsWith('dm:') && dmParticipants(raw).includes(me)
  const channel = isPublic ? raw : isMyDm ? raw : 'general'
  const isDm = channel.startsWith('dm:')
  const dmOtherId = isDm ? dmParticipants(channel).find((id) => id !== me) : null
  const dmOtherName = dmOtherId ? userName.get(dmOtherId) ?? 'teammate' : null

  const rawMessages = await withTenant(() =>
    prisma.chatMessage.findMany({ where: { channel }, orderBy: { createdAt: 'desc' }, take: 100 }),
  )
  const messages = rawMessages
    .slice()
    .reverse()
    .map((m) => ({ id: m.id, author: userName.get(m.authorId) ?? 'Unknown', body: m.body, at: m.createdAt.toISOString() }))

  const others = users.filter((u) => u.id !== me)

  return (
    <div className="flex h-full flex-col">
      <h1 className="text-2xl font-bold text-slate-900">Team chat</h1>
      <p className="mt-1 text-sm text-slate-500">Channels are seen by everyone; direct messages are private between you and one teammate.</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {CHANNELS.map((c) => (
          <Link
            key={c}
            href={`/chat?channel=${c}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${c === channel ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            #{c}
          </Link>
        ))}
        {others.length > 0 && (
          <form method="GET" className="ml-2 flex items-center gap-1">
            <span className="text-xs text-slate-400">Direct:</span>
            <select
              name="channel"
              defaultValue={isDm ? channel : ''}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
            >
              <option value="" disabled>Message a teammate…</option>
              {others.map((u) => (
                <option key={u.id} value={dmChannel(me, u.id)}>{u.name}</option>
              ))}
            </select>
            <button className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200">Open</button>
          </form>
        )}
      </div>

      {isDm && (
        <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700">
          🔒 Private conversation with <span className="font-semibold">{dmOtherName}</span>
        </p>
      )}

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">
            {isDm ? `No messages with ${dmOtherName} yet — say hi.` : `No messages in #${channel} yet.`}
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="text-sm">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-slate-900">{m.author}</span>
              <span className="text-xs text-slate-400">{new Date(m.at).toLocaleString()}</span>
            </div>
            <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{renderBody(m.body)}</p>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <ChatForm channel={channel} users={others.map((u) => ({ id: u.id, name: u.name }))} />
      </div>
    </div>
  )
}
