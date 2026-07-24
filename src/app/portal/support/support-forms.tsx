'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { portalCreateTicketAction, portalReplyTicketAction } from '@/modules/portal/actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'

function ReplySubmit() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
    >
      {pending ? 'Sending…' : 'Reply'}
    </button>
  )
}

export function ReplyForm({ ticketId }: { ticketId: string }) {
  return (
    <form action={portalReplyTicketAction} className="flex items-start gap-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <textarea name="body" rows={2} required placeholder="Write a reply…" className={field} />
      <ReplySubmit />
    </form>
  )
}

export function NewTicketForm() {
  const [state, formAction, pending] = useActionState(portalCreateTicketAction, {})

  return (
    <form action={formAction} className="space-y-2">
      <input name="subject" required placeholder="Subject" className={field} />
      <textarea name="body" rows={3} required placeholder="How can we help?" className={field} />
      {state.error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">{state.success}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? 'Raising…' : 'Raise ticket'}
      </button>
    </form>
  )
}
