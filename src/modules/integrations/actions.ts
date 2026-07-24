'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePermission, withTenant } from '@/lib/authz'
import { connectIntegration, disconnectIntegration } from './service'
import { INTEGRATION_CATALOG } from './catalog'

export type IntegrationActionState = { error?: string; success?: string }

export async function connectIntegrationAction(
  _p: IntegrationActionState,
  formData: FormData,
): Promise<IntegrationActionState> {
  await requirePermission('settings.manage')
  const provider = z.string().min(1).parse(formData.get('provider'))
  const def = INTEGRATION_CATALOG.find((d) => d.provider === provider)
  if (!def) return { error: 'Unknown provider' }

  const config: Record<string, string> = {}
  for (const field of def.fields) {
    const value = String(formData.get(field.key) ?? '').trim()
    if (value) config[field.key] = value
  }
  const result = await withTenant(() => connectIntegration(provider, config))
  revalidatePath('/settings/integrations')
  return result.ok
    ? { success: `${def.name} connected — credentials encrypted at rest` }
    : { error: result.error }
}

export async function disconnectIntegrationAction(formData: FormData) {
  await requirePermission('settings.manage')
  const provider = z.string().min(1).parse(formData.get('provider'))
  await withTenant(() => disconnectIntegration(provider))
  revalidatePath('/settings/integrations')
}
