'use client'

// Editable role × permission matrix. Each checkbox grants/revokes one permission
// on one role via a server action; the server enforces the escalation/self-lock
// guards. Changes save on toggle and the page refreshes to reflect the truth.
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setRolePermissionAction } from '@/modules/users/actions'

type Role = { id: string; name: string; isSystem: boolean }
type Permission = { id: string; key: string; module: string }

export function RoleMatrix({
  roles,
  permissions,
  granted,
  canManage,
}: {
  roles: Role[]
  permissions: Permission[]
  granted: string[] // "roleId:permissionId"
  canManage: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const grantedSet = new Set(granted)

  function toggle(roleId: string, permissionId: string, grant: boolean) {
    setMsg(null)
    const fd = new FormData()
    fd.set('roleId', roleId)
    fd.set('permissionId', permissionId)
    fd.set('grant', grant ? '1' : '0')
    startTransition(async () => {
      const res = await setRolePermissionAction({}, fd)
      if (res.error) setMsg({ text: res.error, ok: false })
      router.refresh()
    })
  }

  return (
    <div>
      {canManage && (
        <p className="mb-2 text-xs text-slate-500">
          Tick a box to grant a permission to a role; untick to revoke. Changes save immediately.
          {pending && <span className="ml-2 text-indigo-600">Saving…</span>}
        </p>
      )}
      {msg && (
        <p className={`mb-2 rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-600'}`}>
          {msg.text}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500">
            <tr>
              <th className="sticky left-0 bg-slate-50 px-3 py-2">Permission</th>
              {roles.map((r) => (
                <th key={r.id} className="px-2 py-2 text-center">{r.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {permissions.map((p) => (
              <tr key={p.id}>
                <td className="sticky left-0 bg-white px-3 py-1.5 font-mono text-slate-700" title={p.module}>{p.key}</td>
                {roles.map((r) => {
                  const on = grantedSet.has(`${r.id}:${p.id}`)
                  return (
                    <td key={r.id} className="px-2 py-1.5 text-center">
                      {canManage ? (
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={pending}
                          onChange={(e) => toggle(r.id, p.id, e.target.checked)}
                          className="cursor-pointer accent-indigo-600 disabled:opacity-40"
                          aria-label={`${p.key} for ${r.name}`}
                        />
                      ) : on ? (
                        <span className="text-green-600">✓</span>
                      ) : (
                        <span className="text-slate-200">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
