import Link from 'next/link'
import { requireSession, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { ChatForm } from './chat-form'

const CHANNELS = ['general', 'sales', 'delivery', 'marketing'] as const

function renderBody(body: string) {
  // Highlight @mention tokens.
  return body.split(/(@\w+)/g).map((part, i) =>
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
  await requireSession()
  const params = await searchParams
  const channel = CHANNELS.includes(params.channel as (typeof CHANNELS)[number])
    ? (params.channel as string)
    : 'general'

  const [rawMessages, users] = await withTenant(() =>
    Promise.all([
      prisma.chatMessage.findMany({
        where: { channel },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.user.findMany({ select: { id: true, name: true } }),
    ]),
  )
  const userName = new Map(users.map((u) => [u.id, u.name]))

  // Reverse to chronological order (oldest first) for display.
  const messages = rawMessages
    .slice()
    .reverse()
    .map((m) => ({
      id: m.id,
      author: userName.get(m.authorId) ?? 'Unknown',
      body: m.body,
      at: m.createdAt.toISOString(),
    }))

  return (
    <div className="flex h-full flex-col">
      <h1 className="text-2xl font-bold text-slate-900">Team chat</h1>
      <p className="mt-1 text-sm text-slate-500">Internal channels — mention teammates with @Name.</p>

      <div className="mt-4 flex gap-2">
        {CHANNELS.map((c) => (
          <Link
            key={c}
            href={`/chat?channel=${c}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              c === channel
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            #{c}
          </Link>
        ))}
      </div>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">No messages in #{channel} yet.</p>
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
        <ChatForm channel={channel} users={users.map((u) => ({ id: u.id, name: u.name }))} />
      </div>
    </div>
  )
}
