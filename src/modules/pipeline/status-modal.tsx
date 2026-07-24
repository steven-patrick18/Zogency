'use client'

import { useState, useActionState } from 'react'
import { changeStatusAction, type ActionState } from './actions'

export type StatusOption = { id: string; name: string; color: string; isJunk: boolean }

export function StatusChangeModal({
  leadId,
  leadName,
  currentStatusId,
  statuses,
  triggerClass,
}: {
  leadId: string
  leadName: string
  currentStatusId: string
  statuses: StatusOption[]
  triggerClass?: string
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await changeStatusAction(prev, formData)
      if (result.success) setOpen(false)
      return result
    },
    {},
  )

  const targets = statuses.filter((s) => s.id !== currentStatusId)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClass ??
          'rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500'
        }
      >
        Move
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="font-semibold text-slate-900">Change status — {leadName}</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              A comment is mandatory on every change; the history is permanent.
            </p>
            <form action={formAction} className="mt-4 space-y-3">
              <input type="hidden" name="leadId" value={leadId} />
              <select
                name="toStatusId"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                defaultValue=""
              >
                <option value="" disabled>
                  New status…
                </option>
                {targets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <textarea
                name="comment"
                required
                rows={3}
                placeholder="What happened? (required — for Junk this becomes the disqualification reason)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
              {state.error && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  disabled={pending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {pending ? 'Saving…' : 'Update status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
