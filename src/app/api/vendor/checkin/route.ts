// Client updater check-in (master only): records the version each provisioned
// install is running, shown per client in the vendor console.
import { NextRequest, NextResponse } from 'next/server'
import { prismaUnscoped } from '@/lib/db/prisma'
import { vendorModeEnabled } from '@/modules/vendor/config'

export async function GET(req: NextRequest) {
  if (!vendorModeEnabled()) return new NextResponse('not found', { status: 404 })
  const domain = req.nextUrl.searchParams.get('domain')?.toLowerCase() ?? ''
  const version = (req.nextUrl.searchParams.get('version') ?? '').slice(0, 64)
  // Authenticate with the install's license key (a signed bearer secret held
  // only by that client). Matching domain + key scopes the write to exactly the
  // one row, closing the previously unauthenticated cross-client write.
  const key = req.nextUrl.searchParams.get('key') ?? ''
  if (!domain) return new NextResponse('domain required', { status: 400 })
  if (!key) return new NextResponse('key required', { status: 401 })
  const updated = await prismaUnscoped.vendorClient.updateMany({
    where: { domain, licenseKey: key },
    data: { lastSeenVersion: version || null, lastCheckinAt: new Date() },
  })
  if (updated.count === 0) return new NextResponse('unauthorized', { status: 401 })
  return new NextResponse('ok', { headers: { 'cache-control': 'no-store' } })
}
