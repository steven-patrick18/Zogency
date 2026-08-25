import { requireSession, withTenant } from '@/lib/authz'
import { prisma, prismaUnscoped } from '@/lib/db/prisma'
import { visibleRoles } from '@/lib/roles'
import { RoleMatrix } from './role-matrix'
import { RoleManager } from './role-manager'

export default async function RolesPage() {
  const session = await requireSession()
  const canManage = session.user.permissions.includes('settings.manage')
  const canVendor = session.user.permissions.includes('vendor.manage')

  const roles = await withTenant(() =>
    prisma.role.findMany({
      include: { rolePermissions: true, _count: { select: { userRoles: true } } },
      orderBy: { name: 'asc' },
    }),
  )
  const permissions = await prismaUnscoped.permission.findMany({
    orderBy: [{ module: 'asc' }, { key: 'asc' }],
  })

  // Hide the internal Demo Admin / Vendor Owner roles unless the viewer runs
  // the vendor console; hide the vendor.manage row from non-operators too.
  const shownRoles = visibleRoles(roles, canVendor)
  const shownPerms = canVendor ? permissions : permissions.filter((p) => p.key !== 'vendor.manage')
  const granted = shownRoles.flatMap((r) => r.rolePermissions.map((rp) => `${r.id}:${rp.permissionId}`))
  // Core admin permissions are locked (read-only) — grant the Admin role instead.
  const lockedKeys = canVendor ? [] : ['settings.manage', 'users.manage', 'system.manage']

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        What each role can do. {canManage ? 'Create/delete roles and edit permissions below.' : 'Read-only (needs Settings management).'}
      </p>
      {canManage && (
        <RoleManager
          roles={shownRoles.map((r) => ({ id: r.id, name: r.name, userCount: r._count.userRoles, deletable: r.name !== 'Admin' }))}
        />
      )}
      <RoleMatrix
        roles={shownRoles.map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem }))}
        permissions={shownPerms.map((p) => ({ id: p.id, key: p.key, module: p.module }))}
        granted={granted}
        canManage={canManage}
        lockedKeys={lockedKeys}
      />
    </div>
  )
}
