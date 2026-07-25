// Server-side authorization + tenant-context helpers (doc 02 §4.2).
// Every server action / page loader goes through one of these.
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { runWithTenant, type TenantContext } from '@/lib/db/context'

export async function requireSession() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  return session
}

export async function requirePermission(key: string) {
  const session = await requireSession()
  if (!session.user.permissions.includes(key)) {
    // Clean bounce to a friendly page rather than an unhandled 500. The menu
    // already hides links the user lacks — this covers direct-URL access.
    redirect(`/forbidden?need=${encodeURIComponent(key)}`)
  }
  return session
}

/** Runs `fn` inside the caller's tenant context so guarded Prisma queries work. */
export async function withTenant<T>(fn: () => Promise<T>): Promise<T> {
  const session = await requireSession()
  const ctx: TenantContext = {
    tenantId: session.user.tenantId,
    userId: session.user.id,
    roles: session.user.roles,
    permissions: session.user.permissions,
  }
  // Await INSIDE the ALS scope: Prisma promises are lazy — they execute on
  // .then(), so the promise must be subscribed while the context is active.
  return runWithTenant(ctx, async () => await fn()) as Promise<T>
}
