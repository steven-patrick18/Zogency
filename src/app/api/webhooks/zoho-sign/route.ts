// Zoho Sign webhook (doc 09). Zoho calls this when a signing request changes
// state; on completion we flip the matching contract to signed. The request id
// is the shared key — we resolve the tenant from the stored contract, so no
// separate tenant routing is needed.
import { NextRequest, NextResponse } from 'next/server'
import { runWithTenant } from '@/lib/db/context'
import { prismaUnscoped } from '@/lib/db/prisma'
import { applyZohoSignCallback } from '@/modules/deals/esign'

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  // Zoho nests the request under `requests`; be tolerant of shape drift.
  const requests = (body.requests ?? body) as Record<string, unknown>
  const requestId = String(requests.request_id ?? requests.requestId ?? '')
  const status = String(requests.request_status ?? requests.status ?? body.status ?? '')
  if (!requestId) return NextResponse.json({ error: 'no request id' }, { status: 400 })

  // Resolve the tenant from the contract that owns this request id.
  const contract = await prismaUnscoped.contract.findFirst({
    where: { envelopeId: requestId, provider: 'zoho_sign' },
    select: { tenantId: true },
  })
  if (!contract) return NextResponse.json({ ok: true }) // unknown request — ack and ignore

  const updated = await runWithTenant({ tenantId: contract.tenantId }, () =>
    applyZohoSignCallback(requestId, status),
  )
  return NextResponse.json({ ok: true, updated })
}
