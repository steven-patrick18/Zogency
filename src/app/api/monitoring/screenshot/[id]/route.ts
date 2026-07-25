// Serve a captured screenshot full-size (deep monitoring). Session-gated by
// monitoring.deep and tenant-scoped — the browser opens this in a new tab from
// the productivity drill-down gallery.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { runWithTenant } from '@/lib/db/context'
import { prisma } from '@/lib/db/prisma'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!session.user.permissions.includes('monitoring.deep')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const { id } = await ctx.params

  const capture = await runWithTenant({ tenantId: session.user.tenantId }, async () => {
    return prisma.screenCapture.findUnique({ where: { id }, select: { image: true } })
  })
  if (!capture) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const match = capture.image.match(/^data:(image\/(?:jpeg|png));base64,(.+)$/)
  if (!match) return NextResponse.json({ error: 'corrupt image' }, { status: 500 })
  return new NextResponse(Buffer.from(match[2], 'base64'), {
    headers: { 'content-type': match[1], 'cache-control': 'private, max-age=300' },
  })
}
