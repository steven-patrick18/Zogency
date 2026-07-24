// License-key system (doc 02 §11.1).
// Key format: zgy1.<base64url(claims JSON)>.<base64url(ed25519 signature)>
// Signed by Zogency's private key (scripts/issue-license.ts); verified offline
// with the public key embedded via env. Expired licenses go read-only — data
// access is never blocked (doc 02 §11.1).
import { createPublicKey, verify as edVerify } from 'node:crypto'

export type LicenseClaims = {
  licenseId: string
  customer: string
  plan: string
  seats: number
  features: string[]
  issuedAt: string // ISO date
  expiresAt: string // ISO date
  graceDays: number
}

export type LicenseState = 'valid' | 'expiring' | 'grace' | 'expired' | 'invalid'

export type LicenseInfo = {
  state: LicenseState
  claims?: LicenseClaims
  reason?: string
  daysLeft?: number
}

const EXPIRING_WINDOW_DAYS = 15

// Dev keypair public half — overridden in production builds via env.
const DEV_PUBLIC_KEY_B64 = 'MCowBQYDK2VwAyEAO6vaN4mPmujnrUZurK4gB/YK+0TBkdy3BKu8PECD9cY='

function publicKey() {
  const env = process.env.ZOGENCY_LICENSE_PUBLIC_KEY
  if (!env && process.env.NODE_ENV === 'production') {
    throw new Error('ZOGENCY_LICENSE_PUBLIC_KEY must be set in production — refusing the dev key.')
  }
  const b64 = env ?? DEV_PUBLIC_KEY_B64
  return createPublicKey({ key: Buffer.from(b64, 'base64'), format: 'der', type: 'spki' })
}

export function verifyLicense(key: string | null | undefined, now = new Date()): LicenseInfo {
  if (!key) return { state: 'invalid', reason: 'No license key installed' }
  const parts = key.trim().split('.')
  if (parts.length !== 3 || parts[0] !== 'zgy1') {
    return { state: 'invalid', reason: 'Malformed license key' }
  }
  const [, payloadB64, sigB64] = parts

  let claims: LicenseClaims
  try {
    const payload = Buffer.from(payloadB64, 'base64url')
    const signature = Buffer.from(sigB64, 'base64url')
    if (!edVerify(null, payload, publicKey(), signature)) {
      return { state: 'invalid', reason: 'Signature verification failed' }
    }
    claims = JSON.parse(payload.toString('utf-8'))
  } catch {
    return { state: 'invalid', reason: 'Unreadable license key' }
  }

  const expires = new Date(claims.expiresAt)
  if (Number.isNaN(expires.getTime())) return { state: 'invalid', reason: 'Invalid expiry', claims }

  const msLeft = expires.getTime() - now.getTime()
  const daysLeft = Math.ceil(msLeft / 86_400_000)
  if (msLeft > 0) {
    return {
      state: daysLeft <= EXPIRING_WINDOW_DAYS ? 'expiring' : 'valid',
      claims,
      daysLeft,
    }
  }
  const graceEnd = new Date(expires.getTime() + (claims.graceDays ?? 14) * 86_400_000)
  if (now < graceEnd) {
    return { state: 'grace', claims, daysLeft }
  }
  return { state: 'expired', claims, daysLeft }
}

/** True when the workspace may accept writes (doc 02 §11.1: expired = read-only). */
export function isWritable(info: LicenseInfo, mode: 'cloud' | 'self_hosted' = 'cloud'): boolean {
  // Cloud tenants are entitled via subscription (Phase 3); no key required.
  // A self-hosted install without a valid key is read-only until activated.
  if (info.state === 'invalid') return mode === 'cloud'
  return info.state !== 'expired'
}
