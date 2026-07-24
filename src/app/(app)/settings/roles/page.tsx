import { withTenant } from '@/lib/authz'
import { prisma, prismaUnscoped } from '@/lib/db/prisma'

export default async function RolesPage() {
  const roles = await withTenant(() =>
    prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    }),
  )
  const permissions = await prismaUnscoped.permission.findMany({
    orderBy: [{ module: 'asc' }, { key: 'asc' }],
  })

  return (
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
              <td className="sticky left-0 bg-white px-3 py-1.5 font-mono text-slate-700">{p.key}</td>
              {roles.map((r) => (
                <td key={r.id} className="px-2 py-1.5 text-center">
                  {r.rolePermissions.some((rp) => rp.permissionId === p.id) ? (
                    <span className="text-green-600">✓</span>
                  ) : (
                    <span className="text-slate-200">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
