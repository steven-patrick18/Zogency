// Webhook lead intake (doc 02 §6.1, doc 04 §2): verify → persist raw
// webhook_events → 200 fast → enqueue → process (map, dedupe, create, assign).
// Failed events stay replayable with their raw payload.
import { randomUUID } from 'node:crypto'
import type { Prisma } from '@/generated/prisma/client'
import { decryptJson } from '@/lib/crypto'
import { runWithTenant } from '@/lib/db/context'
import { prisma, prismaUnscoped, scoped } from '@/lib/db/prisma'
import { enqueue, registerProcessor } from '@/lib/queue'
import { getIntegrationConfig } from '@/modules/integrations/service'
import { extractLeadgenId, fetchMetaLeadFields, hasInlineFieldData } from './meta-graph'
import { readWebFormFields } from './web-form'
import { createLead, type LeadInput } from './service'

type IntakeSource = 'website' | 'meta' | 'google'

const SOURCE_NAMES: Record<IntakeSource, string> = {
  website: 'Website Form',
  meta: 'Meta Lead Ads',
  google: 'Google Ads Lead Form',
}

/** Resolves the tenant owning an intake key (unscoped by necessity — auth step). */
export async function resolveTenantByCredential(
  provider: string,
  key: string,
): Promise<string | null> {
  if (!key) return null
  const credentials = await prismaUnscoped.integrationCredential.findMany({
    where: { provider, status: 'connected' },
  })
  for (const cred of credentials) {
    try {
      const config = decryptJson<Record<string, string>>(cred.configEncrypted)
      if (config.key === key || config.verifyToken === key) return cred.tenantId
    } catch {
      // unreadable row (rotated key) — skip
    }
  }
  return null
}

/** Persists the raw event and queues processing. Returns fast (<2s NFR). */
export async function acceptWebhook(
  tenantId: string,
  source: IntakeSource,
  externalId: string | null,
  raw: unknown,
): Promise<{ accepted: boolean; duplicate?: boolean }> {
  return runWithTenant({ tenantId }, async () => {
    try {
      const event = await prisma.webhookEvent.create({
        data: scoped({
          source,
          externalId: externalId ?? randomUUID(),
          raw: raw as Prisma.InputJsonValue,
        }),
      })
      await enqueue('lead-intake', { tenantId, webhookEventId: event.id })
      return { accepted: true }
    } catch (err: unknown) {
      // Unique (tenant, source, external_id) → provider redelivery; already handled.
      if ((err as { code?: string }).code === 'P2002') return { accepted: true, duplicate: true }
      throw err
    }
  })
}

registerProcessor('lead-intake', async (payload) => {
  const eventId = payload.webhookEventId as string
  const event = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: eventId } })
  try {
    const source = event.source as IntakeSource
    const raw = source === 'meta' ? await enrichMetaPayload(event.raw) : event.raw
    const input = mapPayload(source, raw)
    const result = await createLead(input)
    if (result.outcome === 'rejected') {
      await prisma.webhookEvent.update({
        where: { id: eventId },
        data: { status: 'failed', error: result.reason },
      })
      return
    }
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { status: 'processed', processedAt: new Date() },
    })
  } catch (err) {
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { status: 'failed', error: err instanceof Error ? err.message : String(err) },
    })
  }
})

/**
 * A live Meta leadgen webhook carries only the lead's ID — the answers must be
 * fetched from the Graph API with the stored Page access token. Meta's own test
 * sender inlines field_data, so that case is passed through untouched.
 * Runs inside the job's tenant context, so the credential lookup is scoped.
 */
async function enrichMetaPayload(raw: unknown): Promise<unknown> {
  if (hasInlineFieldData(raw)) return raw
  const leadgenId = extractLeadgenId(raw)
  if (!leadgenId) throw new Error('Meta webhook carried neither field_data nor a leadgen_id')

  const config = await getIntegrationConfig<{ pageToken?: string }>('meta')
  if (!config?.pageToken) {
    throw new Error('Meta is not connected (no Page access token) — reconnect it in Settings → Integrations')
  }
  return { field_data: await fetchMetaLeadFields(leadgenId, config.pageToken) }
}

/** Maps provider payload shapes to LeadInput. */
export function mapPayload(source: IntakeSource, raw: unknown): LeadInput {
  const r = raw as Record<string, unknown>
  if (source === 'website') {
    // Alias-aware: a WordPress form posts `your-name` / `Full Name` / split
    // first+last, not our exact keys.
    return { ...readWebFormFields(r), sourceName: SOURCE_NAMES.website }
  }
  if (source === 'meta') {
    // Lead detail shape: { field_data: [{ name, values: [v] }] } — present in
    // test payloads directly; live events carry only leadgen_id and the worker
    // fetches detail via Graph API once credentials exist (doc 09 §2.1).
    const value =
      ((r.entry as Array<{ changes?: Array<{ value?: Record<string, unknown> }> }>)?.[0]
        ?.changes?.[0]?.value as Record<string, unknown>) ?? r
    const fields = new Map(
      ((value.field_data as Array<{ name: string; values: string[] }>) ?? []).map((f) => [
        f.name.toLowerCase(),
        f.values?.[0],
      ]),
    )
    const pick = (...keys: string[]) => keys.map((k) => fields.get(k)).find(Boolean) ?? null
    return {
      name: String(pick('full_name', 'name') ?? ''),
      phone: pick('phone_number', 'phone'),
      email: pick('email'),
      company: pick('company_name', 'company'),
      city: pick('city'),
      industry: pick('industry'),
      sourceName: SOURCE_NAMES.meta,
    }
  }
  // google: { user_column_data: [{ column_id, string_value }] }
  const cols = new Map(
    ((r.user_column_data as Array<{ column_id: string; string_value: string }>) ?? []).map((c) => [
      c.column_id.toUpperCase(),
      c.string_value,
    ]),
  )
  return {
    name: String(cols.get('FULL_NAME') ?? ''),
    phone: cols.get('PHONE_NUMBER') ?? null,
    email: cols.get('EMAIL') ?? null,
    company: cols.get('COMPANY_NAME') ?? null,
    city: cols.get('CITY') ?? null,
    industry: null,
    sourceName: SOURCE_NAMES.google,
  }
}
