'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { postChatAction } from '@/modules/chat/actions'

const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'

export function ChatForm({ channel, users }: { channel: string; users: Array<{ id: string; name: string }> }) {
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  // When typing an @token, `menu` holds the partial query + where it starts.
  const [menu, setMenu] = useState<{ query: string; start: number } | null>(null)

  const matches = menu
    ? users.filter((u) => u.name.toLowerCase().includes(menu.query.toLowerCase())).slice(0, 6)
    : []

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setValue(v)
    const caret = e.target.selectionStart ?? v.length
    const m = v.slice(0, caret).match(/@([^\s@]*)$/) // the @token ending at the caret
    setMenu(m ? { query: m[1], start: caret - m[1].length - 1 } : null)
  }

  function pick(name: string) {
    if (!menu) return
    const before = value.slice(0, menu.start)
    const after = value.slice(menu.start + 1 + menu.query.length)
    setValue(`${before}@${name} ${after}`)
    setMenu(null)
    inputRef.current?.focus()
  }

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await postChatAction(formData)
        setValue('')
        setMenu(null)
      }}
      className="relative flex items-center gap-2"
    >
      <input type="hidden" name="channel" value={channel} />
      {menu && matches.length > 0 && (
        <div className="absolute bottom-full left-0 z-20 mb-1 w-64 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {matches.map((u) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault() // keep focus in the input
                pick(u.name)
              }}
              className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
            >
              @{u.name}
            </button>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        name="body"
        required
        autoComplete="off"
        value={value}
        onChange={onChange}
        placeholder={`Message #${channel} — type @ to mention`}
        className={`flex-1 ${input}`}
      />
      <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
        Send
      </button>
    </form>
  )
}
