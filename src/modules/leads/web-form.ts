// Normalising website-form submissions.
//
// The intake endpoint originally required JSON with the exact keys name /
// phone / email. Real WordPress sites do not send that: Contact Form 7 posts
// `your-name`, `your-email`; Elementor posts the field labels; most plugin
// webhook integrations send form-encoded rather than JSON. Rather than make
// every agency write glue code, the endpoint now accepts what these plugins
// actually send.

/** Keys compared loosely: "Your Name", "your-name" and "your_name" all match. */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

const ALIASES: Record<'name' | 'email' | 'phone' | 'company' | 'city' | 'industry', string[]> = {
  name: ['name', 'fullname', 'yourname', 'leadname', 'customername', 'contactname', 'nameofperson'],
  email: ['email', 'youremail', 'emailaddress', 'mail', 'emailid'],
  phone: [
    'phone', 'yourphone', 'phonenumber', 'mobile', 'mobilenumber', 'contact',
    'contactnumber', 'tel', 'telephone', 'whatsapp', 'whatsappnumber',
  ],
  company: ['company', 'companyname', 'organisation', 'organization', 'business', 'businessname', 'brand'],
  city: ['city', 'town', 'location'],
  industry: ['industry', 'sector', 'category', 'service', 'serviceinterested', 'servicerequired'],
}

/** Builds a lookup of normalised key → first non-empty string value. */
function index(raw: Record<string, unknown>): Map<string, string> {
  const out = new Map<string, string>()
  for (const [k, v] of Object.entries(raw)) {
    if (v === null || v === undefined) continue
    const value = Array.isArray(v) ? v.find((x) => typeof x === 'string' && x.trim()) : v
    if (typeof value !== 'string' && typeof value !== 'number') continue
    const s = String(value).trim()
    if (!s) continue
    const key = normalizeKey(k)
    if (!out.has(key)) out.set(key, s)
  }
  return out
}

export type WebFormFields = {
  name: string
  email: string | null
  phone: string | null
  company: string | null
  city: string | null
  industry: string | null
}

/**
 * Pulls lead fields out of whatever shape the site posted.
 * Falls back to first name + last name when there is no single name field,
 * which is how WPForms and Gravity Forms split it by default.
 */
export function readWebFormFields(raw: Record<string, unknown>): WebFormFields {
  const idx = index(raw)
  const pick = (field: keyof typeof ALIASES): string | null => {
    for (const alias of ALIASES[field]) {
      const hit = idx.get(alias)
      if (hit) return hit
    }
    return null
  }

  let name = pick('name')
  if (!name) {
    const first = idx.get('firstname') ?? idx.get('fname') ?? idx.get('yourfirstname')
    const last = idx.get('lastname') ?? idx.get('lname') ?? idx.get('yourlastname')
    const joined = [first, last].filter(Boolean).join(' ').trim()
    if (joined) name = joined
  }

  return {
    name: name ?? '',
    email: pick('email'),
    phone: pick('phone'),
    company: pick('company'),
    city: pick('city'),
    industry: pick('industry'),
  }
}

/** True when a hidden honeypot field was filled — a bot, drop it silently. */
export function isHoneypotFilled(raw: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(raw)) {
    const key = normalizeKey(k)
    if ((key === 'hp' || key === 'honeypot') && typeof v === 'string' && v.trim()) return true
  }
  return false
}
