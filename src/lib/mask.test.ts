import { describe, expect, it } from 'vitest'
import { maskEmail, maskPhone } from './mask'

describe('maskPhone', () => {
  it('keeps only the last 2 digits and the + prefix', () => {
    const masked = maskPhone('+919876543210')
    expect(masked).toMatch(/^\+91•+10$/)
    expect(masked).not.toContain('98765')
  })
  it('handles bare 10-digit and null', () => {
    expect(maskPhone('9876543210')).toMatch(/•+10$/)
    expect(maskPhone(null)).toBe('—')
    expect(maskPhone('')).toBe('—')
  })
})

describe('maskEmail', () => {
  it('reveals only the first char + domain', () => {
    expect(maskEmail('anita@desaico.in')).toBe('a••••@desaico.in')
  })
  it('handles null / malformed', () => {
    expect(maskEmail(null)).toBe('—')
    expect(maskEmail('nope')).toBe('••••')
  })
})
