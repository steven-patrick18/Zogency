'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit } from '@/lib/audit'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'

export type SystemActionState = { error?: string; success?: string }

const retentionSchema = z.object({
  // Admin picks a value + unit; stored as hours.
  value: z.coerce.number().int().min(1).max(3650),
  unit: z.enum(['hours', 'days']),
})

/** Set how long deep-monitoring screen captures are kept before auto-purge. */
export async function saveCaptureRetentionAction(
  _prev: SystemActionState,
  formData: FormData,
): Promise<SystemActionState> {
  await requirePermission('system.manage')
  const parsed = retentionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Enter a valid retention period.' }
  const hours = parsed.data.unit === 'days' ? parsed.data.value * 24 : parsed.data.value
  await withTenant(async () => {
    const before = await prisma.tenantSettings.findFirst()
    await prisma.tenantSettings.update({ where: { id: before!.id }, data: { captureRetentionHours: hours } })
    await audit('system.retention_update', 'tenant_settings', before!.id, { hours: before?.captureRetentionHours }, { hours })
  })
  revalidatePath('/settings/server')
  return { success: `Captures now kept for ${hours} hour(s).` }
}

/** Delete captured screenshots to free storage. mode: 'all' | 'stale'. */
export async function purgeCapturesAction(formData: FormData) {
  await requirePermission('system.manage')
  const mode = z.enum(['all', 'stale']).parse(formData.get('mode'))
  await withTenant(async () => {
    const settings = await prisma.tenantSettings.findFirst()
    const where =
      mode === 'stale'
        ? { at: { lt: new Date(Date.now() - (settings?.captureRetentionHours ?? 336) * 3_600_000) } }
        : {}
    const { count } = await prisma.screenCapture.deleteMany({ where })
    await audit('system.captures_purged', 'screen_captures', null, null, { mode, count })
  })
  revalidatePath('/settings/server')
}
