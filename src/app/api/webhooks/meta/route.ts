// Meta Lead Ads webhook (doc 09 §2.1).
// GET  — subscription verification (hub.challenge echo)
// POST — leadgen events; signature verified when an app secret is configured.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
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

  let tenantId: string | null = null
  for (const cred of credentials) {
    try {
      const config = JSON.parse(cred.configEncrypted)
      if (config.pageId === pageId || credentials.length === 1) {
        // Verify signature when the tenant has an app secret configured.
        if (config.appSecret) {
          const sig = req.headers.get('x-hub-signature-256') ?? ''
          const expected =
            'sha256=' + createHmac('sha256', config.appSecret).update(rawBody).digest('hex')
          const valid =
            sig.length === expected.length &&
            timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
          if (!valid) return NextResponse.json({ error: 'bad signature' }, { status: 401 })
        }
        tenantId = cred.tenantId
        break
      }
    } catch {
      continue
    }
  }
  if (!tenantId) return NextResponse.json({ error: 'unknown page' }, { status: 404 })

  const result = await acceptWebhook(tenantId, 'meta', leadgenId || null, body)
  return NextResponse.json({ ok: result.accepted })
}
