// Website form / generic intake endpoint (doc 09 §2.3).
//   POST /api/webhooks/website-form?key=<tenant-key>
//
// Accepts JSON **or** form-encoded bodies, because that is what WordPress
// plugins actually send (Contact Form 7, Elementor and most webhook add-ons
// post application/x-www-form-urlencoded or multipart/form-data, not JSON).
// Field names are matched loosely — see readWebFormFields.
import { NextRequest, NextResponse } from 'next/server'
import { acceptWebhook, resolveTenantByCredential } from '@/modules/leads/intake'
import { isHoneypotFilled } from '@/modules/leads/web-form'

/** JSON, urlencoded or multipart → a flat object. */
async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  const type = req.headers.get('content-type') ?? ''
  if (type.includes('application/json')) {
    try {
      const parsed = await req.json()
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
  if (type.includes('form-data') || type.includes('x-www-form-urlencoded')) {
    try {
      const form = await req.formData()
      const out: Record<string, unknown> = {}
      for (const [k, v] of form.entries()) if (typeof v === 'string') out[k] = v
      return out
    } catch {
      return null
    }
  }
  // No usable content-type (some plugins send none) — try JSON, then query-string.
  const text = await req.text()
  if (!text) return null
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    const params = new URLSearchParams(text)
    const out: Record<string, unknown> = {}
    for (const [k, v] of params.entries()) out[k] = v
    return Object.keys(out).length > 0 ? out : null
  }
}

export async function POST(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key') ?? req.headers.get('x-webhook-key') ?? ''
  const tenantId = await resolveTenantByCredential('website_form', key)
  if (!tenantId) return NextResponse.json({ error: 'invalid key' }, { status: 401 })

  const body = await readBody(req)
  if (!body) {
    return NextResponse.json(
      { error: 'Could not read the submission — send JSON or form-encoded fields' },
      { status: 400 },
    )
  }
  // Honeypot: bots filling the hidden field are dropped silently (doc 09 §2.3).
  if (isHoneypotFilled(body)) return NextResponse.json({ ok: true })

  const result = await acceptWebhook(tenantId, 'website', null, body)
  return NextResponse.json({ ok: result.accepted })
}
