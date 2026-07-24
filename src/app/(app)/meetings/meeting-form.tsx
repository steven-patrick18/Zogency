'use client'

import { useActionState } from 'react'
import { createMeetingAction, type MeetingActionState } from '@/modules/meetings/actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'
const primaryBtn =
  'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50'

function Feedback({ state }: { state: MeetingActionState }) {
  if (state.error) return <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>
  if (state.success) return <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">{state.success}</p>
  return null
}

export function MeetingForm({ clients }: { clients: Array<{ id: string; name: string }> }) {
  const [state, formAction, pending] = useActionState<MeetingActionState, FormData>(createMeetingAction, {})

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">New meeting</h2>
      <form action={formAction} className="mt-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input name="title" required placeholder="Title *" className={field} />
          <input name="meetingAt" type="datetime-local" required className={field} title="Meeting date & time" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select name="clientId" defaultValue="" className={field}>
            <option value="">Client (optional)…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input name="recordingUrl" type="url" placeholder="Recording URL (optional)" className={field} />
        </div>
        <textarea name="transcript" rows={4} placeholder="Transcript (optional)" className={field} />
        <p className="text-xs text-slate-400">
          Paste a transcript to get an AI summary (needs ANTHROPIC_API_KEY on the server).
        </p>
        <Feedback state={state} />
        <button disabled={pending} className={primaryBtn}>
          {pending ? 'Saving…' : 'Save meeting'}
        </button>
      </form>
    </div>
  )
}
