// Desktop-agent screen-capture ingest (deep monitoring, consented — the agent's
// setup screen discloses screenshot capture and the tray allows pausing).
//   POST /api/agent/screenshot   Authorization: Bearer <agentToken>
//   body: { image: 'data:image/jpeg;base64,…', appName?: string }
// Captures are pruned after RETENTION_DAYS on each ingest, so the table stays
// bounded without a separate cron.
import { NextRequest, NextResponse } from 'next/server'
import { runWithTenant } from '@/lib/db/context'
import { prisma, prismaUnscoped } from '@/lib/db/prisma'

const MAX_IMAGE_BYTES = 400_000 // downscaled JPEG data-URI cap
const DEFAULT_RETENTION_HOURS = 336 // 14 days — used if settings are missing

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 401 })

  const user = await prismaUnscoped.user.findUnique({
    where: { agentToken: token },
    select: { id: true, tenantId: true, status: true },
  })
  if (!user || user.status !== 'active') return NextResponse.json({ error: 'invalid token' }, { status: 401 })

  let body: { image?: string; appName?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  const image = String(body.image ?? '')
  if (!image.startsWith('data:image/jpeg;base64,') && !image.startsWith('data:image/png;base64,')) {
    return NextResponse.json({ error: 'image must be a JPEG/PNG data URI' }, { status: 400 })
  }
  if (image.length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: `image too large (max ${MAX_IMAGE_BYTES} bytes)` }, { status: 413 })
  }

  await runWithTenant({ tenantId: user.tenantId }, async () => {
    await prisma.screenCapture.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        appName: body.appName ? String(body.appName).slice(0, 120) : null,
        image,
      },
    })
    // Retention prune — window is admin-set (Settings → Server). Cheap with the
    // (tenant,user,at) index.
    const settings = await prisma.tenantSettings.findFirst({ select: { captureRetentionHours: true } })
    const hours = settings?.captureRetentionHours ?? DEFAULT_RETENTION_HOURS
    await prisma.screenCapture.deleteMany({
      where: { at: { lt: new Date(Date.now() - hours * 3_600_000) } },
    })
  })
  return NextResponse.json({ ok: true })
}
