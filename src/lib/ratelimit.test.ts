import { describe, expect, it } from 'vitest'
import { rateLimit } from './ratelimit'

describe('rateLimit', () => {
  it('allows up to the limit then blocks within the window', () => {
    const key = `test:${Math.random()}`
    let allowed = 0
    let blocked = 0
    for (let i = 0; i < 10; i++) {
      if (rateLimit(key, 5, 60_000).ok) allowed++
      else blocked++
    }
    expect(allowed).toBe(5)
    expect(blocked).toBe(5)
  })
  it('reports a retry-after when blocked', () => {
    const key = `test:${Math.random()}`
    rateLimit(key, 1, 60_000)
    const r = rateLimit(key, 1, 60_000)
    expect(r.ok).toBe(false)
    expect(r.retryAfterSec).toBeGreaterThan(0)
  })
})
