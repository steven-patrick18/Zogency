'use client'

import { deleteDepartment } from '@/modules/settings/actions'

export function DeleteDeptButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteDepartment}
      onSubmit={(e) => {
        if (!confirm(`Remove the "${name}" department? This can't be undone.`)) e.preventDefault()
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="text-xs font-medium text-red-600 hover:underline">Remove</button>
    </form>
  )
}
