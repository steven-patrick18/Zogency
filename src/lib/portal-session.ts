// Client-portal session — separate auth surface from staff (NextAuth).
// HMAC-signed cookie: zgyp1.<base64url(payload)>.<base64url(hmac)>.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

const COOKIE = 'zgy_portal'
const MAX_AGE = 12 * 60 * 60 // 12h

export type PortalSession = {
  contactId: string
  clientId: string
  tenantId: string
  name: string
  exp: number
}

function secret(): string {
  return process.env.AUTH_SECRET ?? 'dev-portal-secret'
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function encodeSession(s: Omit<PortalSession, 'exp'>): string {
  const payload = Buffer.from(JSON.stringify({ ...s, exp: Math.floor(Date.now() / 1000) + MAX_AGE })).toString('base64url')
  return `zgyp1.${payload}.${sign(payload)}`
}

export function decodeSession(token: string | undefined): PortalSession | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== 'zgyp1') return null
  const [, payload, sig] = parts
  const expected = sign(payload)
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString()) as PortalSession
    if (s.exp < Math.floor(Date.now() / 1000)) return null
    return s
  } catch {
    return null
  }
}

export async function getPortalSession(): Promise<PortalSession | null> {
  const store = await cookies()
  return decodeSession(store.get(COOKIE)?.value)
}

export async function setPortalCookie(s: Omit<PortalSession, 'exp'>): Promise<void> {
  const store = await cookies()
  store.set(COOKIE, encodeSession(s), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  })
}

export async function clearPortalCookie(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE)
}
