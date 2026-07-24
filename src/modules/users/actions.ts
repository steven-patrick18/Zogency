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

const updateUserSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional().or(z.literal('')),
})

export async function updateUserAction(
  _prev: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  await requirePermission('users.manage')
  const parsed = updateUserSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const { userId, name, email, phone } = parsed.data

  try {
    await withTenant(async () => {
      const before = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
      await prisma.user.update({
        where: { id: userId },
        data: { name, email: email.toLowerCase(), phone: phone || null },
      })
      await audit('user.update', 'user', userId,
        { name: before.name, email: before.email, phone: before.phone },
        { name, email: email.toLowerCase(), phone: phone || null })
    })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      return { error: 'That email is already used by another team member' }
    }
    throw err
  }
  revalidatePath('/settings/users')
  revalidatePath(`/settings/users/${userId}`)
  return { success: 'Profile updated' }
}

export async function resetPasswordAction(
  _prev: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  await requirePermission('users.manage')
  const userId = z.string().uuid().parse(formData.get('userId'))
  const password = String(formData.get('password') ?? '')
  if (password.length < 8) return { error: 'Password must be at least 8 characters' }

  await withTenant(async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(password, 12) },
    })
    // Never log the password — the event is what matters.
    await audit('user.password_reset', 'user', userId, null, { byAdmin: true })
  })
  revalidatePath(`/settings/users/${userId}`)
  return { success: 'Password updated — share it with the user securely' }
}

const AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const AVATAR_MAX_BYTES = 300_000

export async function uploadAvatarAction(
  _prev: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  await requirePermission('users.manage')
  const userId = z.string().uuid().parse(formData.get('userId'))
  const file = formData.get('avatar')
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose an image' }
  if (!AVATAR_TYPES.has(file.type)) return { error: 'Use a PNG, JPEG, or WebP image' }
  if (file.size > AVATAR_MAX_BYTES) return { error: 'Image too large — max 300 KB (crop/resize it first)' }

  const dataUri = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`
  await withTenant(async () => {
    await prisma.user.update({ where: { id: userId }, data: { avatar: dataUri } })
    await audit('user.avatar_set', 'user', userId, null, { size: file.size, type: file.type })
  })
  revalidatePath(`/settings/users/${userId}`)
  revalidatePath('/settings/users')
  revalidatePath('/', 'layout')
  return { success: 'Photo updated' }
}

export async function removeAvatarAction(formData: FormData) {
  await requirePermission('users.manage')
  const userId = z.string().uuid().parse(formData.get('userId'))
  await withTenant(() => prisma.user.update({ where: { id: userId }, data: { avatar: null } }))
  revalidatePath(`/settings/users/${userId}`)
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
