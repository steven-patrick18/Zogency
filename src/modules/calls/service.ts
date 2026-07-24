// Call logging (doc 04 §5, FR-2.2–2.4). Two paths converge here:
//  - manual log (fallback adapter, always available — PRD risk mitigation)
//  - IVR provider events via /api/webhooks/ivr (TelephonyPort adapters)
// Logging a call sets the lead's firstContactedAt (real contact — replaces
// the S3 status-change proxy) and resolves any open first-contact escalation.
import { audit } from '@/lib/audit'
import { requireTenantContext } from '@/lib/db/context'
import { prisma, scoped } from '@/lib/db/prisma'

export const DISPOSITIONS = [
  'connected',
  'no_answer',
  'busy',
  'wrong_number',
  'callback_requested',
] as const

export type LogCallInput = {
  leadId: string
  direction: 'inbound' | 'outbound'
  durationSec?: number | null
  disposition: string
  outcomeNote?: string | null
  provider?: string
  providerCallId?: string | null
  startedAt?: Date
  isManualLog?: boolean
}

export async function logCall(input: LogCallInput) {
  const ctx = requireTenantContext()
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: input.leadId } })

  const call = await prisma.call.create({
    data: scoped({
      leadId: input.leadId,
      userId: ctx.userId ?? null,
      provider: input.provider ?? 'manual',
      providerCallId: input.providerCallId ?? null,
      direction: input.direction,
      startedAt: input.startedAt ?? new Date(),
      durationSec: input.durationSec ?? null,
      disposition: input.disposition,
      outcomeNote: input.outcomeNote ?? null,
      isManualLog: input.isManualLog ?? true,
    }),
  })

  if (!lead.firstContactedAt) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { firstContactedAt: call.startedAt },
    })
    await prisma.slaEscalation.updateMany({
      where: { entityType: 'lead', entityId: lead.id, resolvedAt: null },
      data: { resolvedAt: new Date() },
    })
  }
  await audit('call.log', 'lead', lead.id, null, {
    direction: input.direction,
    disposition: input.disposition,
    durationSec: input.durationSec ?? null,
    provider: input.provider ?? 'manual',
  })
  return call
}
