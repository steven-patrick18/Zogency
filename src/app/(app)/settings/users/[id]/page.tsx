import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { visibleRoles } from '@/lib/roles'
import { setUserRoles } from '@/modules/users/actions'
import { AvatarPanel, PasswordPanel, ProfilePanel } from './edit-panels'

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('users.manage')
  const canVendor = session.user.permissions.includes('vendor.manage')
  const { id } = await params
  const data = await withTenant(async () => {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { userRoles: true },
    })
    if (!user) return null
    const allRoles = await prisma.role.findMany({ orderBy: { name: 'asc' } })
    return { user, roles: visibleRoles(allRoles, canVendor) }
  })
  if (!data) notFound()
  const { user, roles } = data
  const assigned = new Set(data.user.userRoles.map((ur) => ur.roleId))

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Edit team member</h2>
        <Link href="/settings/users" className="text-sm text-indigo-600 hover:underline">
          ← Back to users
        </Link>
      </div>

      <AvatarPanel userId={user.id} avatar={user.avatar} name={user.name} />
      <ProfilePanel
        userId={user.id}
        name={user.name}
        email={user.email}
        phone={user.phone ?? ''}
      />

      <form action={setUserRoles} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900">Roles</h3>
        <input type="hidden" name="userId" value={user.id} />
        <div className="grid grid-cols-3 gap-2">
          {roles.map((r) => (
            <label key={r.id} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="roleIds"
                value={r.id}
                defaultChecked={assigned.has(r.id)}
                className="rounded"
              />
              {r.name}
            </label>
          ))}
        </div>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
          Save roles
        </button>
      </form>

      <PasswordPanel userId={user.id} />
    </div>
  )
}
