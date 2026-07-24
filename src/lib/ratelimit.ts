// In-memory fixed-window rate limiter (login + webhooks). Per-PROCESS state:
// each web instance keeps its own buckets, so behind N replicas the effective
// limit is up to N× the configured value. This is adequate for single-instance
// self-hosted boxes; multi-instance cloud deployments should front this with a
// shared store (Redis INCR + EXPIRE) to enforce a global limit. Not yet wired.
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
