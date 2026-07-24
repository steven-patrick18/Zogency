// Notification service (doc 08 §4). Phase 1 S1: in-app rows; email/WhatsApp
// adapters attach in S4 via ports — this call-site contract stays stable.
import type { Prisma } from '@/generated/prisma/client'
import { prisma, scoped } from '@/lib/db/prisma'

export async function notify(
  userId: string,
  templateKey: string,
  payload: Record<string, unknown> = {},
) {
  await prisma.notification.create({
    data: scoped({
      userId,
      channel: 'in_app' as const,
      templateKey,
      payload: payload as Prisma.InputJsonValue,
      status: 'sent' as const,
      deliveredAt: new Date(),
    }),
  })
}

/** Renders a template key + payload into display text (in-app center). */
export function renderNotification(templateKey: string, payload: Record<string, unknown>): string {
  const templates: Record<string, (p: Record<string, unknown>) => string> = {
    'user.created': (p) => `Your Zogency account was created — welcome, ${p.name ?? ''}!`,
    'user.roles_changed': (p) => `Your roles were updated to: ${(p.roles as string[])?.join(', ') ?? ''}`,
    'license.expiring': (p) => `The workspace license expires on ${p.expiresAt} — renew soon.`,
  }
  return templates[templateKey]?.(payload) ?? templateKey
}
