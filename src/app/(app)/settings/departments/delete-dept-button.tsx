'use client'

import { useActionState } from 'react'
import { deleteDepartment, type DeleteDeptState } from '@/modules/settings/actions'

export function DeleteDeptButton({ id, name }: { id: string; name: string }) {
  const [state, formAction, pending] = useActionState<DeleteDeptState, FormData>(
    deleteDepartment,
    {},
  )

  return (
    <div className="flex items-center gap-3">
      {/* A refusal (department still in use) reads as a message here — it used
          to throw, which Next rendered as a full-page crash. */}
      {state.error && <span className="text-right text-xs text-red-600">{state.error}</span>}
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!confirm(`Remove the "${name}" department? This can't be undone.`)) e.preventDefault()
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button
          disabled={pending}
          className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
        >
          {pending ? 'Removing…' : 'Remove'}
        </button>
      </form>
    </div>
  )
}
