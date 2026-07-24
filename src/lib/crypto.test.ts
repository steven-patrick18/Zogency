import { describe, expect, it } from 'vitest'
import { decryptJson, encryptJson } from './crypto'

describe('credential crypto', () => {
  it('round-trips JSON', () => {
    const config = { vendor: 'exotel', apiKey: 'sk_test_12345', virtualNumber: '+918033445566' }
    const stored = encryptJson(config)
    expect(stored.startsWith('zgyenc1.')).toBe(true)
    expect(stored).not.toContain('sk_test_12345')
    expect(decryptJson(stored)).toEqual(config)
  })

  it('produces unique ciphertexts (random IV)', () => {
    expect(encryptJson({ a: 1 })).not.toEqual(encryptJson({ a: 1 }))
  })

  it('rejects tampered ciphertext', () => {
    const stored = encryptJson({ secret: 'x' })
    const parts = stored.split('.')
    parts[3] = parts[3].slice(0, -2) + 'zz'
    expect(() => decryptJson(parts.join('.'))).toThrow()
  })

  it('accepts legacy plain-JSON rows', () => {
    expect(decryptJson('{"key":"legacy-dev-key"}')).toEqual({ key: 'legacy-dev-key' })
  })
})
