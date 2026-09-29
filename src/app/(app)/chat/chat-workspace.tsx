'use client'

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Avatar } from '@/components/avatar'
import { postChatAction } from '@/modules/chat/actions'
import type { ChatMessageView, ConversationView } from '@/modules/chat/service'

const POLL_MS = 4000

function dayKey(iso: string): string {
  return new Date(iso).toDateString()
}

/** "Today" / "Yesterday" / "12 Aug 2026" — the WhatsApp date divider. */
function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

/** Relative stamp for the conversation rail. */
function railStamp(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return timeOf(iso)
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/**
 * Highlights @mentions without dangerouslySetInnerHTML. The colour has to flip
 * on your own bubbles — indigo-on-indigo renders the mention invisible.
 */
function renderBody(body: string, mine: boolean) {
  return body.split(/(@[\w.' -]+)/g).map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className={`font-semibold ${mine ? 'text-white underline decoration-indigo-300' : 'text-indigo-600'}`}>
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

export function ChatWorkspace({
  me,
  initialChannel,
  initialMessages,
  initialConversations,
  users,
}: {
  me: string
  initialChannel: string
  initialMessages: ChatMessageView[]
  initialConversations: ConversationView[]
  users: Array<{ id: string; name: string }>
}) {
  const [channel, setChannel] = useState(initialChannel)
  const [messages, setMessages] = useState<ChatMessageView[]>(initialMessages)
  const [conversations, setConversations] = useState<ConversationView[]>(initialConversations)
  const [value, setValue] = useState('')
  const [menu, setMenu] = useState<{ query: string; start: number } | null>(null)
  const [sending, setSending] = useState(false)

  const scrollerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Latest message timestamp drives the incremental poll.
  const cursorRef = useRef<string | null>(initialMessages.at(-1)?.at ?? null)
  const atBottomRef = useRef(true)

  const active = conversations.find((c) => c.channel === channel)

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollerRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [channel, scrollToBottom])

  /** One poll cycle: append anything new, refresh the rail. */
  const poll = useCallback(
    async (opts: { reset?: boolean; target?: string } = {}) => {
      const ch = opts.target ?? channel
      try {
        const res = await fetch('/api/chat/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: ch,
            after: opts.reset ? undefined : cursorRef.current,
          }),
        })
        if (!res.ok) return
        const data = (await res.json()) as {
          messages: ChatMessageView[]
          conversations: ConversationView[]
        }
        setConversations(data.conversations)
        if (opts.reset) {
          setMessages(data.messages)
          cursorRef.current = data.messages.at(-1)?.at ?? null
          requestAnimationFrame(() => scrollToBottom())
        } else if (data.messages.length > 0) {
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id))
            return [...prev, ...data.messages.filter((m) => !seen.has(m.id))]
          })
          cursorRef.current = data.messages.at(-1)?.at ?? cursorRef.current
          // Only auto-scroll if they were already at the bottom — don't yank
          // the view while someone is reading history.
          if (atBottomRef.current) requestAnimationFrame(() => scrollToBottom(true))
        }
      } catch {
        // Offline or a dropped request — the next tick retries.
      }
    },
    [channel, scrollToBottom],
  )

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void poll()
    }, POLL_MS)
    return () => clearInterval(id)
  }, [poll])

  function openConversation(next: string) {
    if (next === channel) return
    setChannel(next)
    setMessages([])
    cursorRef.current = null
    atBottomRef.current = true
    void poll({ reset: true, target: next })
  }

  function onScroll() {
    const el = scrollerRef.current
    if (!el) return
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
  }

  // ── @mention picker ──────────────────────────────────────────────────────
  const matches = menu
    ? users.filter((u) => u.id !== me && u.name.toLowerCase().includes(menu.query.toLowerCase())).slice(0, 6)
    : []

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setValue(v)
    const caret = e.target.selectionStart ?? v.length
    const m = v.slice(0, caret).match(/@([^\s@]*)$/)
    setMenu(m ? { query: m[1], start: caret - m[1].length - 1 } : null)
  }

  function pick(name: string) {
    if (!menu) return
    setValue(`${value.slice(0, menu.start)}@${name} ${value.slice(menu.start + 1 + menu.query.length)}`)
    setMenu(null)
    inputRef.current?.focus()
  }

  async function send() {
    const body = value.trim()
    if (!body || sending) return
    setSending(true)
    setValue('')
    setMenu(null)
    const fd = new FormData()
    fd.set('channel', channel)
    fd.set('body', body)
    try {
      await postChatAction(fd)
      atBottomRef.current = true
      await poll()
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* ── Conversation rail ── */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-50">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold text-slate-900">Chats</h2>
          <p className="text-xs text-slate-500">Channels are team-wide · direct messages are private</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {conversations.map((c) => {
            const isActive = c.channel === channel
            return (
              <button
                key={c.channel}
                onClick={() => openConversation(c.channel)}
                className={`flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left transition-colors ${
                  isActive ? 'bg-white' : 'hover:bg-slate-100'
                }`}
              >
                {c.kind === 'dm' ? (
                  <Avatar avatar={c.avatar} name={c.label} size="md" />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-500">
                    #
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-sm ${c.unread > 0 ? 'font-bold text-slate-900' : 'font-medium text-slate-800'}`}>
                      {c.label}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">{railStamp(c.lastAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`truncate text-xs ${c.unread > 0 ? 'text-slate-700' : 'text-slate-400'}`}>
                      {c.lastBody ?? 'No messages yet'}
                    </span>
                    {c.unread > 0 && (
                      <span className="shrink-0 rounded-full bg-green-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {c.unread > 99 ? '99+' : c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </aside>

      {/* ── Conversation ── */}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          {active?.kind === 'dm' ? (
            <Avatar avatar={active.avatar} name={active.label} size="md" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-500">
              #
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{active?.label ?? channel}</p>
            <p className="text-xs text-slate-400">
              {active?.kind === 'dm' ? 'Private conversation' : 'Everyone in the workspace can see this'}
            </p>
          </div>
        </header>

        <div
          ref={scrollerRef}
          onScroll={onScroll}
          className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-slate-100 px-4 py-4"
        >
          {messages.length === 0 && (
            <p className="py-16 text-center text-sm text-slate-400">
              No messages yet — say hello.
            </p>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1]
            // Derived from the neighbour rather than a running variable —
            // mutating during render breaks on re-render.
            const showDay = !prev || dayKey(m.at) !== dayKey(prev.at)
            // Group consecutive messages from one person, like WhatsApp.
            const grouped =
              !showDay &&
              prev?.authorId === m.authorId &&
              new Date(m.at).getTime() - new Date(prev.at).getTime() < 5 * 60_000

            return (
              <div key={m.id}>
                {showDay && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm">
                      {dayLabel(m.at)}
                    </span>
                  </div>
                )}
                <div className={`flex items-end gap-2 ${m.mine ? 'justify-end' : 'justify-start'}`}>
                  {!m.mine && (
                    <div className={grouped ? 'w-6 shrink-0' : ''}>
                      {!grouped && <Avatar avatar={m.avatar} name={m.author} size="xs" />}
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-1.5 shadow-sm ${
                      m.mine
                        ? 'rounded-br-sm bg-indigo-600 text-white'
                        : 'rounded-bl-sm bg-white text-slate-800'
                    } ${grouped ? 'mt-0.5' : 'mt-2'}`}
                  >
                    {!m.mine && !grouped && (
                      <p className="text-xs font-semibold text-indigo-600">{m.author}</p>
                    )}
                    <p className="whitespace-pre-wrap break-words text-sm">{renderBody(m.body, m.mine)}</p>
                    <p className={`mt-0.5 text-right text-[10px] ${m.mine ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {timeOf(m.at)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="relative border-t border-slate-200 bg-white px-3 py-2.5">
          {menu && matches.length > 0 && (
            <div className="absolute bottom-full left-3 z-20 mb-1 w-64 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
              {matches.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pick(u.name)
                  }}
                  className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                >
                  @{u.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={value}
              onChange={onChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              placeholder={`Message ${active?.label ?? channel} — type @ to mention`}
              className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <button
              onClick={() => void send()}
              disabled={sending || value.trim().length === 0}
              className="shrink-0 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
