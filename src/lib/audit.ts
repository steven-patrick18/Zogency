// Audit write path (doc 02 §4.2 / NFR "audit trail on all changes").
// Call from every domain mutation, inside tenant context. Append-only.
import type { Prisma } from '@/generated/prisma/client'
import { prisma, scoped } from '@/lib/db/prisma'
import { requireTenantContext } from '@/lib/db/context'

type Auditable = Record<string, unknown> | null

export async function audit(
  action: string,
  entityType: string,
  entityId: string | null,
  before: Auditable = null,
  after: Auditable = null,
) {
  const ctx = requireTenantContext()
  await prisma.auditLog.create({
    data: scoped({
      actorId: ctx.userId ?? null,
      action,
      entityType,
      entityId,
      before: (before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (after ?? undefined) as Prisma.InputJsonValue | undefined,
    }),
  })
}

const SENSITIVE_FIELDS = ['passwordHash', 'totpSecret', 'configEncrypted']

/** Strips fields that must never land in the audit log. */
export function redact<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...obj }
  for (const field of SENSITIVE_FIELDS) delete clone[field]
  return clone
}
