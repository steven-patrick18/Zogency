// Auth.js v5 — credentials login with JWT sessions carrying tenant + RBAC claims.
// Login precedes tenant context, so lookups here use prismaUnscoped (doc 02 §3.2).
// Includes login rate limiting and TOTP 2FA (doc 02 §4.1).
import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prismaUnscoped } from '@/lib/db/prisma'
import { rateLimit } from '@/lib/ratelimit'
import { verifyTotp } from '@/lib/totp'

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp: z.string().optional(),
})

// Distinct error so the login form can prompt for the 2FA code.
class TwoFactorRequired extends CredentialsSignin {
  code = 'totp_required'
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt', maxAge: 12 * 60 * 60 },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, totp: {} },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null
        const { email, password, totp } = parsed.data

        // Rate limit: 8 attempts / 5 min per email (brute-force protection).
        const rl = rateLimit(`login:${email.toLowerCase()}`, 8, 5 * 60_000)
        if (!rl.ok) return null

        // MVP: single-tenant lookup by email. Multi-tenant login resolves the
        // tenant from the subdomain first (doc 02 §3.1) — wired in Phase 3.
        const user = await prismaUnscoped.user.findFirst({
          where: { email: email.toLowerCase(), status: 'active' },
          include: {
            userRoles: {
              include: {
                role: { include: { rolePermissions: { include: { permission: true } } } },
              },
            },
          },
        })
        if (!user) return null
        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) return null

        // 2FA challenge.
        if (user.totpEnabled && user.totpSecret) {
          if (!totp) throw new TwoFactorRequired()
          if (!verifyTotp(user.totpSecret, user.email, totp)) throw new TwoFactorRequired()
        }

        prismaUnscoped.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch(() => {})

        const roles = user.userRoles.map((ur) => ur.role.name)
        const permissions = [
          ...new Set(
            user.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.key)),
          ),
        ]
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          tenantId: user.tenantId,
          roles,
          permissions,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id
        token.tenantId = user.tenantId
        token.roles = user.roles
        token.permissions = user.permissions
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.userId as string
      session.user.tenantId = token.tenantId as string
      session.user.roles = (token.roles as string[]) ?? []
      session.user.permissions = (token.permissions as string[]) ?? []
      return session
    },
  },
})
