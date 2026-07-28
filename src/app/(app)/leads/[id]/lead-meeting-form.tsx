'use client'

import { useActionState, useState } from 'react'
import { createMeetingAction, type MeetingActionState } from '@/modules/meetings/actions'

const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'

/** Compact "log a prospect meeting" form, pre-scoped to this lead. */
export function LeadMeetingForm({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<MeetingActionState, FormData>(createMeetingAction, {})

  if (state.success && !open) {
    // collapsed after a successful save
  }
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm font-medium text-indigo-600 hover:underline">
        + Log a meeting
      </button>
    )
  }
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <input name="title" required placeholder="Meeting title *" className={field} />
      <input name="meetingAt" type="datetime-local" required className={field} title="Date & time" />
      <input name="recordingUrl" type="url" placeholder="Recording URL (optional)" className={field} />
      <textarea name="transcript" rows={3} placeholder="Transcript (optional — enables AI summary)" className={field} />
      <div className="flex items-center gap-2">
        <button disabled={pending} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
          {pending ? 'Saving…' : 'Save meeting'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:underline">Cancel</button>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">{state.success}</p>}
    </form>
  )
}
