'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createRoleAction, deleteRoleAction, type RolePermState } from '@/modules/users/actions'

type Role = { id: string; name: string; userCount: number; deletable: boolean }

export function RoleManager({ roles }: { roles: Role[] }) {
  const router = useRouter()
  const [addState, addAction, adding] = useActionState<RolePermState, FormData>(createRoleAction, {})
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Refresh the page (matrix + chips) after a role is created.
  useEffect(() => {
    if (addState.success) router.refresh()
  }, [addState.success, router])

  function remove(role: Role) {
    if (!confirm(`Delete the “${role.name}” role? This can’t be undone.`)) return
    setMsg(null)
    const fd = new FormData()
    fd.set('roleId', role.id)
    startTransition(async () => {
      const res = await deleteRoleAction({}, fd)
      setMsg(res.error ? { text: res.error, ok: false } : { text: res.success ?? 'Deleted.', ok: true })
      router.refresh()
    })
  }

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-slate-900">Manage roles</h2>
      <p className="text-xs text-slate-400">Create roles for your team and delete ones you don’t use. Set each role’s access in the matrix below.</p>

      {/* Existing roles as chips with delete. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {roles.map((r) => (
          <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
            {r.name}
            <span className="text-xs text-slate-400">· {r.userCount}</span>
            {r.deletable && (
              <button
                type="button"
                onClick={() => remove(r)}
                disabled={pending}
                title={r.userCount > 0 ? 'Reassign members first' : 'Delete role'}
                className="ml-0.5 text-slate-400 hover:text-red-600 disabled:opacity-40"
              >
                ✕
              </button>
            )}
          </span>
        ))}
      </div>

      {/* Add a custom role. */}
      <form action={addAction} className="mt-4 flex flex-wrap items-center gap-2">
        <input
          name="name"
          required
          placeholder="New role name (e.g. Video Editor)"
          className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
        />
        <button disabled={adding} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
          {adding ? 'Adding…' : 'Add role'}
        </button>
      </form>

      {(addState.error || addState.success || msg) && (
        <p className={`mt-2 text-sm ${addState.error || msg?.ok === false ? 'text-red-600' : 'text-green-700'}`}>
          {addState.error ?? msg?.text ?? addState.success}
        </p>
      )}
    </div>
  )
}
