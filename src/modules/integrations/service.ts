// Self-serve integration management (doc 11 Q4/Q5): each tenant connects
// their own provider accounts; credentials are AES-256-GCM encrypted at rest.
import { audit } from '@/lib/audit'
import { decryptJson, encryptJson } from '@/lib/crypto'
import { requireTenantContext } from '@/lib/db/context'
import { prisma, scoped } from '@/lib/db/prisma'
import { INTEGRATION_CATALOG, SENSITIVE_TYPES } from './catalog'

export type ConnectionSummary = {
  provider: string
  name: string
  category: string
  status: string
  connectedAt: string | null
  /** Non-sensitive config values + masked sensitive ones, for display. */
  display: Record<string, string>
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
}

export async function connectIntegration(
  provider: string,
  config: Record<string, string>,
): Promise<{ ok: true; provider: string } | { ok: false; error: string }> {
  const def = INTEGRATION_CATALOG.find((d) => d.provider === provider)
  if (!def) return { ok: false, error: 'Unknown provider' }

  for (const field of def.fields) {
    if (field.required && !config[field.key]?.trim()) {
      return { ok: false, error: `${field.label} is required` }
    }
    if (field.type === 'select' && config[field.key] && !field.options?.includes(config[field.key])) {
      return { ok: false, error: `Invalid ${field.label}` }
    }
  }

  // Custom APIs (Q4) can be registered multiple times — keyed by name.
  const storedProvider =
    provider === 'custom' ? `custom:${slugify(config.name ?? 'api')}` : provider

  const clean = Object.fromEntries(
    Object.entries(config).filter(([, v]) => v?.trim()),
  )
  const { tenantId } = requireTenantContext()
  await prisma.integrationCredential.upsert({
    where: { tenantId_provider: { tenantId, provider: storedProvider } },
    update: { configEncrypted: encryptJson(clean), status: 'connected' },
    create: scoped({ provider: storedProvider, configEncrypted: encryptJson(clean) }),
  })
  await audit('integration.connect', 'integration', null, null, { provider: storedProvider })
  return { ok: true, provider: storedProvider }
}

export async function disconnectIntegration(provider: string): Promise<void> {
  await prisma.integrationCredential.updateMany({
    where: { provider },
    data: { status: 'disconnected' },
  })
  await audit('integration.disconnect', 'integration', null, { provider }, null)
}

/** All connections for the settings page — secrets masked, never round-tripped. */
export async function listConnections(): Promise<ConnectionSummary[]> {
  const rows = await prisma.integrationCredential.findMany({ orderBy: { provider: 'asc' } })
  return rows.map((row) => {
    const def =
      INTEGRATION_CATALOG.find((d) => d.provider === row.provider) ??
      (row.provider.startsWith('custom:')
        ? INTEGRATION_CATALOG.find((d) => d.provider === 'custom')!
        : null)
    let display: Record<string, string> = {}
    try {
      const config = decryptJson<Record<string, string>>(row.configEncrypted)
      const sensitiveKeys = new Set(
        (def?.fields ?? []).filter((f) => SENSITIVE_TYPES.has(f.type ?? 'text')).map((f) => f.key),
      )
      display = Object.fromEntries(
        Object.entries(config).map(([k, v]) => [
          k,
          sensitiveKeys.has(k) || /token|secret|key|pass/i.test(k) ? `••••${String(v).slice(-4)}` : String(v),
        ]),
      )
    } catch {
      display = { note: 'stored with a previous key — reconnect to update' }
    }
    return {
      provider: row.provider,
      name: def?.name ?? row.provider,
      category: def?.category ?? 'Other',
      status: row.status,
      connectedAt: row.connectedAt.toLocaleString(),
      display,
    }
  })
}

/** Decrypted config for adapter/webhook use — server-side only. */
export async function getIntegrationConfig<T = Record<string, string>>(
  provider: string,
): Promise<T | null> {
  const row = await prisma.integrationCredential.findFirst({
    where: { provider, status: 'connected' },
  })
  if (!row) return null
  try {
    return decryptJson<T>(row.configEncrypted)
  } catch {
    return null
  }
}
