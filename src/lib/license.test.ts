import { createPrivateKey, sign as edSign } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { verifyLicense, isWritable, type LicenseClaims } from './license'

const PRIV = 'MC4CAQAwBQYDK2VwBCIEIO+qlB8A/BsALTE+bBABlYnhWdUoWCt7GMikimBNa8WM'

function issue(overrides: Partial<LicenseClaims> = {}): string {
  const now = new Date()
  const claims: LicenseClaims = {
    licenseId: 'test-1',
    customer: 'Test Co',
    plan: 'pro',
    seats: 5,
    features: ['all'],
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 365 * 86_400_000).toISOString(),
    graceDays: 14,
    ...overrides,
  }
  const payload = Buffer.from(JSON.stringify(claims))
  const key = createPrivateKey({ key: Buffer.from(PRIV, 'base64'), format: 'der', type: 'pkcs8' })
  const sig = edSign(null, payload, key)
  return `zgy1.${payload.toString('base64url')}.${sig.toString('base64url')}`
}

const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()

describe('verifyLicense', () => {
  it('accepts a valid signed key', () => {
    const info = verifyLicense(issue())
    expect(info.state).toBe('valid')
    expect(info.claims?.customer).toBe('Test Co')
  })

  it('rejects a tampered payload', () => {
    const key = issue()
    const [prefix, payload, sig] = key.split('.')
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString())
    claims.seats = 9999
    const tampered = `${prefix}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${sig}`
    expect(verifyLicense(tampered).state).toBe('invalid')
  })

  it('rejects garbage and missing keys', () => {
    expect(verifyLicense('not-a-key').state).toBe('invalid')
    expect(verifyLicense(null).state).toBe('invalid')
    expect(verifyLicense('zgy1.aaaa.bbbb').state).toBe('invalid')
  })

  it('flags expiring within 15 days', () => {
    expect(verifyLicense(issue({ expiresAt: days(10) })).state).toBe('expiring')
    expect(verifyLicense(issue({ expiresAt: days(20) })).state).toBe('valid')
  })

  it('enters grace after expiry, expired after grace', () => {
    expect(verifyLicense(issue({ expiresAt: days(-5), graceDays: 14 })).state).toBe('grace')
    expect(verifyLicense(issue({ expiresAt: days(-20), graceDays: 14 })).state).toBe('expired')
  })
})

describe('isWritable', () => {
  it('expired license is read-only in both modes', () => {
    const expired = verifyLicense(issue({ expiresAt: days(-30), graceDays: 1 }))
    expect(isWritable(expired, 'cloud')).toBe(false)
    expect(isWritable(expired, 'self_hosted')).toBe(false)
  })

  it('grace stays writable; cloud without key stays writable', () => {
    expect(isWritable(verifyLicense(issue({ expiresAt: days(-2) })), 'self_hosted')).toBe(true)
    expect(isWritable(verifyLicense(null), 'cloud')).toBe(true)
    expect(isWritable(verifyLicense(null), 'self_hosted')).toBe(false)
  })
})
