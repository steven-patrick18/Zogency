'use server'

// Disposable demo logins (master server): demo1, demo2… get the Demo Admin
// role — full product access, no vendor console, no user administration.
// Auto-disabled after expiry; credentials shown once at creation.
import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { audit } from '@/lib/audit'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma, scoped } from '@/lib/db/prisma'
import { vendorModeEnabled } from './config'
import { freshInstallReset } from './reset-actions'

export type DemoActionState = { error?: string; success?: string; credentials?: { email: string; password: string; expiresAt: string } }

function readablePassword(): string {
  const letters = randomBytes(4).toString('hex').slice(0, 4)
  const digits = String(1000 + Math.floor(Math.random() * 9000))
  return `Demo-${letters}-${digits}`
}

export async function createDemoUserAction(_p: DemoActionState, formData: FormData): Promise<DemoActionState> {
  await requirePermission('vendor.manage')
  if (!vendorModeEnabled()) return { error: 'Vendor mode is not enabled' }
  const hours = z.coerce.number().int().min(1).max(720).default(24).parse(formData.get('hours') || 24)

  // Fresh-install demos (default): wipe the workspace to a brand-new install so
  // the prospect starts from an empty org and configures everything themselves.
  const fresh = formData.get('fresh') !== 'off'
  if (fresh) await freshInstallReset()

  const result = await withTenant(async () => {
    const demoRole = await prisma.role.findFirst({ where: { name: 'Demo Admin' } })
    if (!demoRole) return { error: 'Demo Admin role missing — run the seed first' }

    const count = await prisma.user.count({ where: { email: { startsWith: 'demo', endsWith: '@zogency.demo' } } })
    const email = `demo${count + 1}@zogency.demo`
    const password = readablePassword()
    const expiresAt = new Date(Date.now() + hours * 3_600_000)

    const user = await prisma.user.create({
      data: scoped({
        name: `Demo User ${count + 1}`,
        email,
        passwordHash: await bcrypt.hash(password, 12),
        demoExpiresAt: expiresAt,
      }),
    })
    await prisma.userRole.create({ data: { userId: user.id, roleId: demoRole.id } })
    await audit('demo.user_created', 'user', user.id, null, { email, expiresAt: expiresAt.toISOString() })
    return { email, password, expiresAt: expiresAt.toLocaleString() }
  })

  revalidatePath('/vendor')
  if ('error' in result && result.error) return { error: result.error }
  const credentials = result as { email: string; password: string; expiresAt: string }
  return {
    success: 'Demo login created — copy the credentials now, the password is not shown again.',
    credentials,
  }
}

export async function endDemoUserAction(formData: FormData) {
  await requirePermission('vendor.manage')
  const userId = z.string().uuid().parse(formData.get('userId'))
  await withTenant(async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    if (!user.demoExpiresAt) throw new Error('Not a demo user')
    await prisma.user.update({ where: { id: userId }, data: { status: 'disabled' } })
    await audit('demo.user_ended', 'user', userId, null, null)
  })
  revalidatePath('/vendor')
}

/** Disables demo users past expiry — called on vendor page load. */
export async function sweepExpiredDemoUsers(): Promise<void> {
  await prisma.user.updateMany({
    where: { demoExpiresAt: { lt: new Date() }, status: 'active' },
    data: { status: 'disabled' },
  })
}
