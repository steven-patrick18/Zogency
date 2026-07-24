import { Secret, TOTP } from 'otpauth'
import { describe, expect, it } from 'vitest'
import { newSecret, otpauthUrl, verifyTotp } from './totp'

describe('TOTP 2FA', () => {
  it('accepts a valid current code and rejects a wrong one', () => {
    const secret = newSecret()
    const code = new TOTP({ issuer: 'Zogency', label: 'a@b.com', digits: 6, period: 30, secret: Secret.fromBase32(secret) }).generate()
    expect(verifyTotp(secret, 'a@b.com', code)).toBe(true)
    expect(verifyTotp(secret, 'a@b.com', '000000')).toBe(false)
    expect(verifyTotp(secret, 'a@b.com', 'abc')).toBe(false)
  })
  it('produces an otpauth url', () => {
    expect(otpauthUrl(newSecret(), 'a@b.com')).toMatch(/^otpauth:\/\/totp\/Zogency/)
  })
})
