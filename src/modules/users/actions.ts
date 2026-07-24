'use server'

import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { audit, redact } from '@/lib/audit'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma, scoped } from '@/lib/db/prisma'
import { notify } from '@/lib/notify'

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
})

export async function createUser(formData: FormData) {
  await requirePermission('users.manage')
  const data = createUserSchema.parse(Object.fromEntries(formData))
  const roleIds = formData.getAll('roleIds').map(String)
  if (roleIds.length === 0) throw new Error('Select at least one role')

  await withTenant(async () => {
    const user = await prisma.user.create({
      data: scoped({
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash: await bcrypt.hash(data.password, 12),
      }),
    })
    for (const roleId of roleIds) {
      await prisma.role.findUniqueOrThrow({ where: { id: roleId } }) // tenant-guarded
    }
    await prismaCreateUserRoles(user.id, roleIds)
    await audit('user.create', 'user', user.id, null, redact(user))
    await notify(user.id, 'user.created', { name: user.name })
  })
  revalidatePath('/settings/users')
}

// UserRole is a join model (no tenant_id) — parents are validated above.
async function prismaCreateUserRoles(userId: string, roleIds: string[]) {
  await prisma.userRole.createMany({
    data: roleIds.map((roleId) => ({ userId, roleId })),
    skipDuplicates: true,
  })
}

export async function setUserRoles(formData: FormData) {
  await requirePermission('users.manage')
  const userId = z.string().uuid().parse(formData.get('userId'))
  const roleIds = formData.getAll('roleIds').map(String)
  if (roleIds.length === 0) throw new Error('A user needs at least one role')

  await withTenant(async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } }) // tenant-guarded
    for (const roleId of roleIds) {
      await prisma.role.findUniqueOrThrow({ where: { id: roleId } })
    }
    const before = await prisma.userRole.findMany({ where: { userId } })
    await prisma.userRole.deleteMany({ where: { userId } })
    await prisma.userRole.createMany({ data: roleIds.map((roleId) => ({ userId, roleId })) })
    const roles = await prisma.role.findMany({ where: { id: { in: roleIds } } })
    await audit('user.set_roles', 'user', userId,
      { roleIds: before.map((r) => r.roleId) }, { roleIds })
    await notify(user.id, 'user.roles_changed', { roles: roles.map((r) => r.name) })
  })
  revalidatePath('/settings/users')
}

export async function toggleUserStatus(formData: FormData) {
  const session = await requirePermission('users.manage')
  const userId = z.string().uuid().parse(formData.get('userId'))
  if (userId === session.user.id) throw new Error('You cannot disable your own account')

  await withTenant(async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const status = user.status === 'active' ? 'disabled' : 'active'
    await prisma.user.update({ where: { id: userId }, data: { status } })
    await audit('user.toggle_status', 'user', userId, { status: user.status }, { status })
  })
  revalidatePath('/settings/users')
}
