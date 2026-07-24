import { afterEach, describe, expect, it, vi } from 'vitest'
import { requireSecret } from './secret-guard'

describe('requireSecret', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('returns the configured value when present', () => {
    expect(requireSecret('real-secret', 'AUTH_SECRET', 'dev')).toBe('real-secret')
  })

  it('falls back to the dev value outside production', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(requireSecret(undefined, 'AUTH_SECRET', 'dev-fallback')).toBe('dev-fallback')
  })

  it('THROWS in production when the secret is missing (fail closed)', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => requireSecret(undefined, 'AUTH_SECRET', 'dev-fallback')).toThrow(/AUTH_SECRET/)
    expect(() => requireSecret('   ', 'AUTH_SECRET', 'dev-fallback')).toThrow()
  })
})
