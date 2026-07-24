// Server-side license issuing (vendor console). Requires the production
// private key in ZOGENCY_LICENSE_PRIVATE_KEY — set only on the master server.
import { createPrivateKey, randomUUID, sign as edSign } from 'node:crypto'
import type { LicenseClaims } from './license'

export function issuerConfigured(): boolean {
  return !!process.env.ZOGENCY_LICENSE_PRIVATE_KEY
}

export function issueLicense(input: {
  customer: string
  plan?: string
  seats?: number
  days?: number
  graceDays?: number
}): { key: string; claims: LicenseClaims } {
  const privB64 = process.env.ZOGENCY_LICENSE_PRIVATE_KEY
  if (!privB64) throw new Error('ZOGENCY_LICENSE_PRIVATE_KEY is not set on this server')

  const now = new Date()
  const claims: LicenseClaims = {
    licenseId: randomUUID(),
    customer: input.customer,
    plan: input.plan ?? 'pro',
    seats: input.seats ?? 15,
    features: ['all'],
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + (input.days ?? 365) * 86_400_000).toISOString(),
    graceDays: input.graceDays ?? 14,
  }
  const payload = Buffer.from(JSON.stringify(claims))
  const key = createPrivateKey({ key: Buffer.from(privB64, 'base64'), format: 'der', type: 'pkcs8' })
  const signature = edSign(null, payload, key)
  return { key: `zgy1.${payload.toString('base64url')}.${signature.toString('base64url')}`, claims }
}
