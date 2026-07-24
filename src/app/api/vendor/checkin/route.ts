// Client updater check-in (master only): records the version each provisioned
// install is running, shown per client in the vendor console.
import { NextRequest, NextResponse } from 'next/server'
import { prismaUnscoped } from '@/lib/db/prisma'
import { vendorModeEnabled } from '@/modules/vendor/config'

export async function GET(req: NextRequest) {
  if (!vendorModeEnabled()) return new NextResponse('not found', { status: 404 })
  const domain = req.nextUrl.searchParams.get('domain')?.toLowerCase() ?? ''
  const version = (req.nextUrl.searchParams.get('version') ?? '').slice(0, 64)
  if (!domain) return new NextResponse('domain required', { status: 400 })
  await prismaUnscoped.vendorClient.updateMany({
    where: { domain },
    data: { lastSeenVersion: version || null, lastCheckinAt: new Date() },
  })
  return new NextResponse('ok', { headers: { 'cache-control': 'no-store' } })
}
