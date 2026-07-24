// IVR / telephony call-event webhook (doc 04 §5.2, doc 09 §2.5).
// Vendor-agnostic shape (Exotel-style field names accepted); the concrete
// TelephonyPort adapter maps its provider's payload when the vendor is chosen
// (doc 11 Q1). POST /api/webhooks/ivr?key=<tenant-ivr-key>
import { NextRequest, NextResponse } from 'next/server'
import { runWithTenant } from '@/lib/db/context'
import { prisma } from '@/lib/db/prisma'
import { normalizePhone } from '@/modules/leads/service'
import { logCall } from '@/modules/calls/service'
import { resolveTenantByCredential } from '@/modules/leads/intake'

export async function POST(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key') ?? req.headers.get('x-webhook-key') ?? ''
  const tenantId = await resolveTenantByCredential('ivr', key)
  if (!tenantId) return NextResponse.json({ error: 'invalid key' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const phone = normalizePhone(String(body.To ?? body.to ?? body.customer_number ?? ''))
  if (!phone) return NextResponse.json({ error: 'no customer number' }, { status: 400 })

  const result = await runWithTenant({ tenantId }, async () => {
    const lead = await prisma.lead.findFirst({ where: { phone } })
    if (!lead) return { matched: false }
    await logCall({
      leadId: lead.id,
      direction: String(body.Direction ?? 'outbound') === 'inbound' ? 'inbound' : 'outbound',
      durationSec: body.Duration ? Number(body.Duration) : null,
      disposition: String(body.Status ?? 'connected') === 'completed' ? 'connected' : String(body.Status ?? 'connected'),
      provider: String(body.provider ?? 'ivr'),
      providerCallId: body.CallSid ? String(body.CallSid) : null,
      startedAt: body.StartTime ? new Date(String(body.StartTime)) : new Date(),
      isManualLog: false,
    })
    return { matched: true }
  })
  return NextResponse.json({ ok: true, ...result })
}
