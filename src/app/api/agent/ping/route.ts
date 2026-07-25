// Desktop monitoring agent ingest. The Electron agent posts activity pings
// authenticated by the per-user agent token (issued on the employee profile).
// Requires signed employee consent — surfaced in the Productivity UI.
//   POST /api/agent/ping   Authorization: Bearer <agentToken>
//   body: { appName?: string, idleSec?: number }
import { NextRequest, NextResponse } from 'next/server'
import { runWithTenant } from '@/lib/db/context'
import { prisma, prismaUnscoped } from '@/lib/db/prisma'

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 401 })

  const user = await prismaUnscoped.user.findUnique({
    where: { agentToken: token },
    select: { id: true, tenantId: true, status: true },
  })
  if (!user || user.status !== 'active') return NextResponse.json({ error: 'invalid token' }, { status: 401 })

  let body: { appName?: string; windowTitle?: string; idleSec?: number } = {}
  try {
    body = await req.json()
  } catch {
    // pings may be empty heartbeats
  }

  // await INSIDE the ALS scope — Prisma promises are lazy, so the tenant guard
  // must see the context when the query actually runs.
  await runWithTenant({ tenantId: user.tenantId }, async () => {
    await prisma.activityPing.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        appName: body.appName ? String(body.appName).slice(0, 120) : null,
        windowTitle: body.windowTitle ? String(body.windowTitle).slice(0, 300) : null,
        idleSec: Math.max(0, Math.min(3600, Number(body.idleSec) || 0)),
      },
    })
  })
  return NextResponse.json({ ok: true })
}
