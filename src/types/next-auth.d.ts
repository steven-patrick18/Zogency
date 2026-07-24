import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface User {
    tenantId: string
    roles: string[]
    permissions: string[]
  }
  interface Session {
    user: {
      id: string
      tenantId: string
      roles: string[]
      permissions: string[]
    } & DefaultSession['user']
  }
}
