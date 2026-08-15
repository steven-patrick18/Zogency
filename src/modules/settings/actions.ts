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

export type GeneralSettingsState = { error?: string; success?: string }

const opt = (max: number) => z.string().trim().max(max).optional()
// Accept a bare domain and normalise to a URL, so "brb.digital" doesn't fail
// the whole save. Empty → undefined.
const website = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : undefined))
  .refine((v) => v === undefined || /^https?:\/\/[^\s.]+\.[^\s]+$/.test(v), 'Enter a valid website (e.g. brb.digital)')
const generalSchema = z.object({
  primaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Brand color must be a hex value like #4f46e5'),
  slaHours: z.coerce.number().int().min(1).max(168),
  revisionRoundDefault: z.coerce.number().int().min(0).max(10),
  emailSenderName: opt(100),
  emailSenderAddress: z.union([z.literal(''), z.string().email('Enter a valid email address')]).optional(),
  timezone: z.string().trim().min(1).max(64),
  country: opt(80),
  addressLine: opt(200),
  city: opt(80),
  stateRegion: opt(80),
  postalCode: opt(20),
  phone: opt(30),
  websiteUrl: website,
  taxId: opt(40),
})

// useActionState signature so validation problems are shown, not swallowed.
export async function updateGeneralSettings(
  _prev: GeneralSettingsState,
  formData: FormData,
): Promise<GeneralSettingsState> {
  await requirePermission('settings.manage')
  const parsed = generalSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Some fields are invalid.' }
  }
  const data = parsed.data
  const nn = (v: string | undefined) => (v && v.length ? v : null) // '' → null
  try {
    await withTenant(async () => {
      await assertWritable()
      const before = await prisma.tenantSettings.findFirst()
      await prisma.tenantSettings.update({
        where: { id: before!.id },
        data: {
          primaryColor: data.primaryColor,
          slaHours: data.slaHours,
          revisionRoundDefault: data.revisionRoundDefault,
          emailSenderName: nn(data.emailSenderName),
          emailSenderAddress: nn(data.emailSenderAddress),
          timezone: data.timezone,
          country: nn(data.country),
          addressLine: nn(data.addressLine),
          city: nn(data.city),
          stateRegion: nn(data.stateRegion),
          postalCode: nn(data.postalCode),
          phone: nn(data.phone),
          websiteUrl: nn(data.websiteUrl),
          taxId: nn(data.taxId),
        },
      })
      await audit('settings.update', 'tenant_settings', before!.id, { ...before }, data)
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save settings.' }
  }
  revalidatePath('/settings')
  return { success: 'Settings saved.' }
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
    // Don't orphan people or task boards — block deletion while in use.
    const [employees, tasks] = await Promise.all([
      prisma.employee.count({ where: { departmentId: id } }),
      prisma.task.count({ where: { departmentId: id } }),
    ])
    if (employees > 0 || tasks > 0) {
      throw new Error(
        `Can't remove "${before.name}" — it still has ${employees} employee(s) and ${tasks} task(s). Reassign them first.`,
      )
    }
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
