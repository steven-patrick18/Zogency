// Public release channel (master server only): client updaters poll this and
// self-update to the returned git ref. Plain text: "<ref>".
import { NextResponse } from 'next/server'
import { prismaUnscoped } from '@/lib/db/prisma'
import { vendorModeEnabled } from '@/modules/vendor/config'

export async function GET() {
  if (!vendorModeEnabled()) return new NextResponse('not found', { status: 404 })
  const latest = await prismaUnscoped.vendorRelease.findFirst({
    orderBy: { publishedAt: 'desc' },
  })
  if (!latest) return new NextResponse('none', { status: 404 })
  return new NextResponse(latest.ref, {
    status: 200,
    headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' },
  })
}
