import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'
import { normalizePhone } from './service'

describe('parseCsv', () => {
  it('parses headers and rows', () => {
    const { headers, rows } = parseCsv('Name,Phone,Email\nRavi,9876543210,ravi@x.com\n')
    expect(headers).toEqual(['name', 'phone', 'email'])
    expect(rows).toEqual([['Ravi', '9876543210', 'ravi@x.com']])
  })

  it('handles quoted fields with commas and escaped quotes', () => {
    const { rows } = parseCsv('name,company\n"Shah, Amit","Acme ""India"" Pvt"\n')
    expect(rows).toEqual([['Shah, Amit', 'Acme "India" Pvt']])
  })

  it('handles CRLF and skips blank lines', () => {
    const { rows } = parseCsv('name\r\nA\r\n\r\nB\r\n')
    expect(rows).toEqual([['A'], ['B']])
  })
})

describe('normalizePhone', () => {
  it('normalizes Indian formats to E.164', () => {
    expect(normalizePhone('98765 43210')).toBe('+919876543210')
    expect(normalizePhone('09876543210')).toBe('+919876543210')
    expect(normalizePhone('919876543210')).toBe('+919876543210')
    expect(normalizePhone('+14155550123')).toBe('+14155550123')
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
  })
})
