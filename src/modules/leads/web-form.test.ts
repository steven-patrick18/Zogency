import { describe, expect, it } from 'vitest'
import { isHoneypotFilled, readWebFormFields } from './web-form'
import { mapPayload } from './intake'

describe('readWebFormFields', () => {
  it('reads our own documented keys', () => {
    expect(
      readWebFormFields({ name: 'Rahul Verma', email: 'r@v.test', phone: '9812345678', city: 'Pune' }),
    ).toMatchObject({ name: 'Rahul Verma', email: 'r@v.test', phone: '9812345678', city: 'Pune' })
  })

  it('reads Contact Form 7 defaults (your-name / your-email)', () => {
    const f = readWebFormFields({
      'your-name': 'Asha Menon',
      'your-email': 'asha@example.com',
      'your-phone': '+91 98765 43210',
      'your-subject': 'SEO enquiry',
    })
    expect(f.name).toBe('Asha Menon')
    expect(f.email).toBe('asha@example.com')
    expect(f.phone).toBe('+91 98765 43210')
  })

  it('reads human labels with spaces and capitals (Elementor)', () => {
    const f = readWebFormFields({ 'Full Name': 'Imran Sheikh', 'Email Address': 'i@s.test', 'Mobile Number': '9900112233' })
    expect(f).toMatchObject({ name: 'Imran Sheikh', email: 'i@s.test', phone: '9900112233' })
  })

  it('joins first and last name when there is no single name field', () => {
    expect(readWebFormFields({ first_name: 'Deepanshi', last_name: 'Saini', email: 'd@s.test' }).name).toBe(
      'Deepanshi Saini',
    )
  })

  it('tolerates a lone first name', () => {
    expect(readWebFormFields({ fname: 'Ranu', phone: '9000000000' }).name).toBe('Ranu')
  })

  it('ignores empty strings rather than treating them as answers', () => {
    const f = readWebFormFields({ name: 'A', email: '   ', phone: '9812345678' })
    expect(f.email).toBeNull()
    expect(f.phone).toBe('9812345678')
  })

  it('takes the first value when a field repeats (checkbox-style arrays)', () => {
    expect(readWebFormFields({ name: 'X', service: ['SEO', 'Ads'] }).industry).toBe('SEO')
  })

  it('returns an empty name when nothing matches, so createLead rejects it', () => {
    expect(readWebFormFields({ message: 'hello there' }).name).toBe('')
  })

  it('maps whatsapp number onto phone', () => {
    expect(readWebFormFields({ name: 'A', 'WhatsApp Number': '9811122233' }).phone).toBe('9811122233')
  })
})

describe('isHoneypotFilled', () => {
  it('detects the documented _hp field', () => {
    expect(isHoneypotFilled({ name: 'Bot', _hp: 'spam' })).toBe(true)
  })

  it('detects a "honeypot" named field too', () => {
    expect(isHoneypotFilled({ name: 'Bot', Honeypot: 'x' })).toBe(true)
  })

  it('ignores it when left empty by a human', () => {
    expect(isHoneypotFilled({ name: 'Human', _hp: '' })).toBe(false)
  })
})

describe('mapPayload for website submissions', () => {
  it('routes a WordPress-shaped payload into a lead', () => {
    expect(mapPayload('website', { 'your-name': 'Asha', 'your-email': 'a@b.test' })).toEqual({
      name: 'Asha',
      email: 'a@b.test',
      phone: null,
      company: null,
      city: null,
      industry: null,
      sourceName: 'Website Form',
    })
  })
})
