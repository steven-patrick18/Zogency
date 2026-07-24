import { describe, expect, it } from 'vitest'
import { decodeSession, encodeSession } from './portal-session'

describe('portal session cookie', () => {
  const base = { contactId: 'c1', clientId: 'cl1', tenantId: 't1', name: 'Anita' }

  it('round-trips a valid session', () => {
    const token = encodeSession(base)
    const s = decodeSession(token)
    expect(s?.contactId).toBe('c1')
    expect(s?.clientId).toBe('cl1')
    expect(s?.tenantId).toBe('t1')
  })

  it('rejects a tampered payload', () => {
    const token = encodeSession(base)
    const [prefix, payload, sig] = token.split('.')
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString())
    decoded.clientId = 'ATTACKER'
    const forged = `${prefix}.${Buffer.from(JSON.stringify(decoded)).toString('base64url')}.${sig}`
    expect(decodeSession(forged)).toBeNull()
  })

  it('rejects garbage and empty', () => {
    expect(decodeSession(undefined)).toBeNull()
    expect(decodeSession('nope')).toBeNull()
    expect(decodeSession('zgyp1.aaa.bbb')).toBeNull()
  })
})
