'use client'

import { useRef } from 'react'
import { postChatAction } from '@/modules/chat/actions'

export function ChatForm({ channel }: { channel: string }) {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await postChatAction(formData)
        formRef.current?.reset()
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="channel" value={channel} />
      <input
        name="body"
        required
        autoComplete="off"
        placeholder={`Message #${channel} — use @Name to mention`}
        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
      />
      <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
        Send
      </button>
    </form>
  )
}
