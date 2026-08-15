// Streams a task attachment (stored as a data-URI) as a file download.
// Tenant-scoped + requires tasks.view.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission('tasks.view')
  const { id } = await params
  const att = await withTenant(() => prisma.taskAttachment.findUnique({ where: { id } }))
  if (!att) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const base64 = att.data.split(',')[1] ?? ''
  const buf = Buffer.from(base64, 'base64')
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': att.mimeType,
      'content-disposition': `inline; filename="${encodeURIComponent(att.name)}"`,
      'content-length': String(buf.length),
    },
  })
}
