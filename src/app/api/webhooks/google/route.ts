// Google Ads Lead Form webhook (doc 09 §2.2).
// POST /api/webhooks/google  body: { google_key, lead_id, user_column_data: [...] }
import { NextRequest, NextResponse } from 'next/server'
import { acceptWebhook, resolveTenantByCredential } from '@/modules/leads/intake'

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const key = String(body.google_key ?? req.nextUrl.searchParams.get('key') ?? '')
  const tenantId = await resolveTenantByCredential('google', key)
  if (!tenantId) return NextResponse.json({ error: 'invalid key' }, { status: 401 })

  const result = await acceptWebhook(tenantId, 'google', body.lead_id ? String(body.lead_id) : null, body)
  return NextResponse.json({ ok: result.accepted })
}
