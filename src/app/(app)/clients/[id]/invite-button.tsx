'use client'

import { useActionState } from 'react'
import { invitePortalContactAction, type PortalInviteState } from '@/modules/portal/admin-actions'

export function InvitePortalButton({ contactId }: { contactId: string }) {
  const [state, formAction, pending] = useActionState<PortalInviteState, FormData>(invitePortalContactAction, {})

  return (
    <div className="mt-1">
      <form action={formAction}>
        <input type="hidden" name="contactId" value={contactId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-indigo-300 px-2 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
        >
          {pending ? 'Inviting…' : 'Invite to portal'}
        </button>
      </form>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      {state.success && (
        <div className="mt-1 rounded-md bg-green-50 p-2 text-xs text-green-700">
          <p>{state.success}</p>
          {state.inviteLink && (
            <code className="mt-1 block break-all rounded bg-white px-1.5 py-1 text-[11px] text-slate-700">
              {state.inviteLink}
            </code>
          )}
        </div>
      )}
    </div>
  )
}
