import { withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { createUser, toggleUserStatus } from '@/modules/users/actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'

export default async function UsersPage() {
  const [users, roles] = await withTenant(() =>
    Promise.all([
      prisma.user.findMany({
        include: { userRoles: { include: { role: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.role.findMany({ orderBy: { name: 'asc' } }),
    ]),
  )

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Roles</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3 text-slate-600">
                  {u.userRoles.map((ur) => ur.role.name).join(', ')}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      u.status === 'active'
                        ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700'
                        : 'rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600'
                    }
                  >
                    {u.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={toggleUserStatus}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button className="text-xs font-medium text-indigo-600 hover:underline">
                      {u.status === 'active' ? 'Disable' : 'Enable'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={createUser} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">Add team member</h2>
        <div className="grid grid-cols-3 gap-4">
          <input name="name" placeholder="Full name" required className={field} />
          <input name="email" type="email" placeholder="Email" required className={field} />
          <input
            name="password"
            type="password"
            placeholder="Temp password (min 8)"
            required
            minLength={8}
            className={field}
          />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Roles (multi-select)</legend>
          <div className="grid grid-cols-3 gap-2">
            {roles.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="roleIds" value={r.id} className="rounded" />
                {r.name}
              </label>
            ))}
          </div>
        </fieldset>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
          Create user
        </button>
      </form>
    </div>
  )
}
