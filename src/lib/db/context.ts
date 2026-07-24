// Request-scoped tenant context (doc 02 §3.1). Established per request (from the
// session) and per worker job (from the job payload); read by the Prisma tenant
// guard so queries never need to pass tenantId explicitly.
import { AsyncLocalStorage } from 'node:async_hooks'

export type TenantContext = {
  tenantId: string
  userId?: string
  roles?: string[]
  permissions?: string[]
}

const storage = new AsyncLocalStorage<TenantContext>()

export function runWithTenant<T>(ctx: TenantContext, fn: () => Promise<T> | T): Promise<T> | T {
  return storage.run(ctx, fn)
}

export function getTenantContext(): TenantContext | undefined {
  return storage.getStore()
}

export function requireTenantContext(): TenantContext {
  const ctx = storage.getStore()
  if (!ctx) throw new Error('No tenant context — wrap the call in runWithTenant()')
  return ctx
}
