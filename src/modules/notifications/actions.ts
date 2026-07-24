'use server'

import { revalidatePath } from 'next/cache'
import { requireSession, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'

export async function markAllRead() {
  const session = await requireSession()
  await withTenant(async () => {
    // Notifications are append-only for delivery history; read_at is the one
    // mutable pointer field (doc 03 §5.1) — this updateMany is intentional.
    await prisma.notification.updateMany({
      where: { userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    })
  })
  revalidatePath('/notifications')
  revalidatePath('/', 'layout')
}
