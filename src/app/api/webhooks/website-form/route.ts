// Website form / generic intake endpoint (doc 09 §2.3).
// POST /api/webhooks/website-form?key=<tenant-key>  body: { name, phone, email, ... }
import { NextRequest, NextResponse } from 'next/server'
import { acceptWebhook, resolveTenantByCredential } from '@/modules/leads/intake'

export async function POST(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key') ?? req.headers.get('x-webhook-key') ?? ''
  const tenantId = await resolveTenantByCredential('website_form', key)
  if (!tenantId) return NextResponse.json({ error: 'invalid key' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  // Honeypot: bots filling the hidden field are dropped silently (doc 09 §2.3).
  if ((body as Record<string, unknown>)._hp) return NextResponse.json({ ok: true })

  const result = await acceptWebhook(tenantId, 'website', null, body)
  return NextResponse.json({ ok: result.accepted })
}
