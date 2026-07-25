// Agent runtime config. The Electron agent polls this on start and periodically
// to honour HR's policy — currently the auto-logout idle threshold (minutes),
// set on the HR → Login hours page (TenantSettings.agentIdleLogoutMin).
//   GET /api/agent/config   Authorization: Bearer <agentToken>
//   -> { idleLogoutMin: number }
import { NextRequest, NextResponse } from 'next/server'
import { runWithTenant } from '@/lib/db/context'
import { prisma, prismaUnscoped } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 401 })

  const user = await prismaUnscoped.user.findUnique({
    where: { agentToken: token },
    select: { id: true, tenantId: true, status: true },
  })
  if (!user || user.status !== 'active') return NextResponse.json({ error: 'invalid token' }, { status: 401 })

  const settings = await runWithTenant({ tenantId: user.tenantId }, async () =>
    prisma.tenantSettings.findFirst({ select: { agentIdleLogoutMin: true } }),
  )
  return NextResponse.json({ idleLogoutMin: settings?.agentIdleLogoutMin ?? 10 })
}
