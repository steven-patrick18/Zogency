// Prisma clients (doc 02 §3.2).
//  - `prisma`        : tenant-guarded — injects tenant_id from AsyncLocalStorage
//                      context on every query against a TENANT_SCOPED model.
//  - `prismaUnscoped`: no guard. Import allowed ONLY in platform-admin code,
//                      auth bootstrap (login precedes tenant context), seeds,
//                      and worker bootstrap.
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'
import { requireTenantContext } from './context'
import { TENANT_SCOPED_MODELS } from './registry'

const globalForPrisma = globalThis as unknown as { prismaBase?: PrismaClient }

const base =
  globalForPrisma.prismaBase ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  })
if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaBase = base

type AnyArgs = Record<string, unknown> & {
  where?: Record<string, unknown>
  data?: unknown
  create?: Record<string, unknown>
  update?: Record<string, unknown>
}

const READ_MANY_OPS = new Set([
  'findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy',
  'updateMany', 'deleteMany',
])
// findUnique/update/delete/upsert take WhereUniqueInput, which since Prisma 5
// accepts additional non-unique filters — merging tenantId is valid and makes
// cross-tenant primary-key probing return "not found".
const UNIQUE_OPS = new Set([
  'findUnique', 'findUniqueOrThrow', 'update', 'delete', 'upsert',
])

function guardArgs(operation: string, args: AnyArgs, tenantId: string): AnyArgs {
  if (READ_MANY_OPS.has(operation)) {
    args.where = { AND: [{ tenantId }, args.where ?? {}] }
  } else if (UNIQUE_OPS.has(operation)) {
    args.where = { ...(args.where ?? {}), tenantId }
    if (operation === 'upsert' && args.create) args.create = { ...args.create, tenantId }
  } else if (operation === 'create') {
    args.data = { ...(args.data as Record<string, unknown>), tenantId }
  } else if (operation === 'createMany' || operation === 'createManyAndReturn') {
    const data = args.data
    args.data = Array.isArray(data)
      ? data.map((d: Record<string, unknown>) => ({ ...d, tenantId }))
      : { ...(data as Record<string, unknown>), tenantId }
  }
  return args
}

export const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!model || !TENANT_SCOPED_MODELS.has(model)) return query(args)
        const { tenantId } = requireTenantContext()
        return query(guardArgs(operation, args as AnyArgs, tenantId))
      },
    },
  },
})

export const prismaUnscoped = base

/**
 * Attaches the context tenantId to create data. The guard also injects it at
 * runtime as a backstop, but the generated types require it — this keeps call
 * sites type-safe without threading tenantId manually.
 */
export function scoped<T extends object>(data: T): T & { tenantId: string } {
  return { ...data, tenantId: requireTenantContext().tenantId }
}
