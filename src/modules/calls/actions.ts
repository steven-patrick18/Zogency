'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePermission, withTenant } from '@/lib/authz'
import { DISPOSITIONS, logCall } from './service'

export type CallFormState = { error?: string; success?: string }

const logCallSchema = z.object({
  leadId: z.string().uuid(),
  direction: z.enum(['inbound', 'outbound']),
  durationMin: z.coerce.number().min(0).max(600).optional(),
  disposition: z.enum(DISPOSITIONS),
  outcomeNote: z.string().max(2000).optional().or(z.literal('')),
})

export async function logCallAction(_prev: CallFormState, formData: FormData): Promise<CallFormState> {
  await requirePermission('calls.log')
  const parsed = logCallSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const d = parsed.data

  await withTenant(() =>
    logCall({
      leadId: d.leadId,
      direction: d.direction,
      durationSec: d.durationMin ? Math.round(d.durationMin * 60) : null,
      disposition: d.disposition,
      outcomeNote: d.outcomeNote || null,
      isManualLog: true,
    }),
  )
  revalidatePath(`/leads/${d.leadId}`)
  revalidatePath('/leads')
  revalidatePath('/pipeline')
  return { success: 'Call logged' }
}
