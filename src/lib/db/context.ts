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

// Singleton on globalThis: Next.js dev (Turbopack/HMR) can instantiate this
// module once per server chunk — separate ALS instances would make the guard
// lose the context set by runWithTenant.
const globalForALS = globalThis as unknown as { zgyTenantALS?: AsyncLocalStorage<TenantContext> }
const storage = globalForALS.zgyTenantALS ?? new AsyncLocalStorage<TenantContext>()
globalForALS.zgyTenantALS = storage

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
