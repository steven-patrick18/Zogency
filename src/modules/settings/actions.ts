'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit } from '@/lib/audit'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma, scoped } from '@/lib/db/prisma'
import { isWritable, verifyLicense } from '@/lib/license'
import { deployMode, getWorkspaceLicense } from './service'

/** Blocks mutations when the license is expired (doc 02 §11.1 read-only rule). */
async function assertWritable() {
  const info = await getWorkspaceLicense()
  if (!isWritable(info, deployMode())) {
    throw new Error('Workspace license expired — read-only until a new key is installed')
  }
}

const generalSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  slaHours: z.coerce.number().int().min(1).max(168),
  revisionRoundDefault: z.coerce.number().int().min(0).max(10),
  emailSenderName: z.string().max(100).optional(),
  emailSenderAddress: z.string().email().optional().or(z.literal('')),
})

export async function updateGeneralSettings(formData: FormData) {
  await requirePermission('settings.manage')
  const data = generalSchema.parse(Object.fromEntries(formData))
  await withTenant(async () => {
    await assertWritable()
    const before = await prisma.tenantSettings.findFirst()
    await prisma.tenantSettings.update({
      where: { id: before!.id },
      data: {
        primaryColor: data.primaryColor,
        slaHours: data.slaHours,
        revisionRoundDefault: data.revisionRoundDefault,
        emailSenderName: data.emailSenderName || null,
        emailSenderAddress: data.emailSenderAddress || null,
      },
    })
    await audit('settings.update', 'tenant_settings', before!.id, { ...before }, data)
  })
  revalidatePath('/settings')
}

export async function createDepartment(formData: FormData) {
  await requirePermission('settings.manage')
  const name = z.string().min(1).max(50).parse(formData.get('name'))
  await withTenant(async () => {
    await assertWritable()
    const count = await prisma.department.count()
    const dept = await prisma.department.create({
      data: scoped({ name, type: name.toLowerCase().replace(/\s+/g, '_'), sort: count }),
    })
    await audit('department.create', 'department', dept.id, null, { name })
  })
  revalidatePath('/settings/departments')
}

export async function deleteDepartment(formData: FormData) {
  await requirePermission('settings.manage')
  const id = z.string().uuid().parse(formData.get('id'))
  await withTenant(async () => {
    await assertWritable()
    const before = await prisma.department.findUnique({ where: { id } })
    if (!before) return
    await prisma.department.delete({ where: { id } })
    await audit('department.delete', 'department', id, { name: before.name }, null)
  })
  revalidatePath('/settings/departments')
}

export async function activateLicense(formData: FormData) {
  await requirePermission('settings.manage')
  const key = z.string().min(10).parse(formData.get('key'))
  const info = verifyLicense(key)
  if (info.state === 'invalid') {
    throw new Error(`License rejected: ${info.reason}`)
  }
  // Installing a key is always allowed — it is the way out of read-only.
  await withTenant(async () => {
    const settings = await prisma.tenantSettings.findFirst()
    await prisma.tenantSettings.update({ where: { id: settings!.id }, data: { licenseKey: key } })
    await audit('license.activate', 'tenant_settings', settings!.id, null, {
      licenseId: info.claims?.licenseId,
      plan: info.claims?.plan,
      expiresAt: info.claims?.expiresAt,
    })
  })
  revalidatePath('/', 'layout')
}
