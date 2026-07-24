// Auth.js v5 — credentials login with JWT sessions carrying tenant + RBAC claims.
// Login precedes tenant context, so lookups here use prismaUnscoped (doc 02 §3.2).
// TOTP 2FA (doc 02 §4.1) lands later in Sprint 1.
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prismaUnscoped } from '@/lib/db/prisma'

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt', maxAge: 12 * 60 * 60 },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null
        const { email, password } = parsed.data

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
