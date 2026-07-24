// Fail-closed secret resolution. In production, a missing secret is a hard
// error rather than a silent fall-back to a public dev constant (audit:
// forgeable portal cookies / license / credential encryption).
export function requireSecret(value: string | undefined, name: string, devFallback: string): string {
  if (value && value.trim()) return value
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be set in production — refusing to use the insecure dev fallback.`)
  }
  return devFallback
}
