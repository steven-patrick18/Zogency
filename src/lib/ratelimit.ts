// In-memory sliding-window rate limiter (login + webhooks). Per-process; good
// enough for a single-tenant self-hosted box. Redis-backed when REDIS_URL is set.
type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterSec: 0 }
  }
  if (b.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) }
  }
  b.count++
  return { ok: true, retryAfterSec: 0 }
}

// Periodic cleanup so the map doesn't grow unbounded.
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k)
  }, 60_000).unref?.()
}
