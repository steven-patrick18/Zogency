// TOTP 2FA helpers (RFC 6238) via otpauth.
import { Secret, TOTP } from 'otpauth'

export function newSecret(): string {
  return new Secret({ size: 20 }).base32
}

function totp(secret: string, account: string): TOTP {
  return new TOTP({ issuer: 'Zogency', label: account, algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secret) })
}

export function otpauthUrl(secret: string, account: string): string {
  return totp(secret, account).toString()
}

export function verifyTotp(secret: string, account: string, token: string): boolean {
  const clean = token.replace(/\s/g, '')
  if (!/^\d{6}$/.test(clean)) return false
  // window ±1 period tolerates clock skew.
  return totp(secret, account).validate({ token: clean, window: 1 }) !== null
}
