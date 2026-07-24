// Meta Lead Ads webhook (doc 09 §2.1).
// GET  — subscription verification (hub.challenge echo)
// POST — leadgen events; signature verified when an app secret is configured.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { decryptJson } from '@/lib/crypto'
import { prismaUnscoped } from '@/lib/db/prisma'
import { acceptWebhook, resolveTenantByCredential } from '@/modules/leads/intake'

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const token = params.get('hub.verify_token') ?? ''
  const tenantId = await resolveTenantByCredential('meta', token)
  if (params.get('hub.mode') === 'subscribe' && (tenantId || token === process.env.META_VERIFY_TOKEN)) {
    return new NextResponse(params.get('hub.challenge') ?? '', { status: 200 })
  }
  return NextResponse.json({ error: 'verification failed' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Single-app model: one Meta app serves all tenants; page id → tenant routing.
  const credentials = await prismaUnscoped.integrationCredential.findMany({
    where: { provider: 'meta', status: 'connected' },
  })

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const entry = (body.entry as Array<Record<string, unknown>>) ?? []
  const pageId = String(entry[0]?.id ?? '')
  const leadgenId = String(
    (entry[0]?.changes as Array<{ value?: { leadgen_id?: string } }>)?.[0]?.value?.leadgen_id ?? '',
  )

  // Route strictly by page id (no "sole tenant" bypass — that would accept a
  // POST bearing any page id). The matched tenant MUST have an app secret and a
  // valid X-Hub-Signature-256, otherwise the payload is unauthenticated and
  // rejected — a webhook with no verifiable signature is never trusted.
  let tenantId: string | null = null
  for (const cred of credentials) {
    let config: Record<string, string>
    try {
      config = decryptJson<Record<string, string>>(cred.configEncrypted)
    } catch {
      continue
    }
    if (config.pageId !== pageId) continue

    const appSecret = config.appSecret || process.env.META_APP_SECRET
    if (!appSecret) {
      return NextResponse.json({ error: 'signature verification not configured' }, { status: 401 })
    }
    const sig = req.headers.get('x-hub-signature-256') ?? ''
    const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex')
    const valid =
      sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    if (!valid) return NextResponse.json({ error: 'bad signature' }, { status: 401 })

    tenantId = cred.tenantId
    break
  }
  if (!tenantId) return NextResponse.json({ error: 'unknown page' }, { status: 404 })

  const result = await acceptWebhook(tenantId, 'meta', leadgenId || null, body)
  return NextResponse.json({ ok: result.accepted })
}
