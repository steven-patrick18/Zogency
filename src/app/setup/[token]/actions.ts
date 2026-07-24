'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prismaUnscoped } from '@/lib/db/prisma'

export type SetupState = { error?: string }

const schema = z.object({
  token: z.string().min(10),
  name: z.string().min(1).max(100),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm: z.string(),
})

export async function completeSetupAction(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const { token, name, password, confirm } = parsed.data
  if (password !== confirm) return { error: 'Passwords do not match' }

  // Pre-auth by design: the one-time token IS the credential (vendor flow).
  const user = await prismaUnscoped.user.findUnique({ where: { setupToken: token } })
  if (!user) return { error: 'This setup link has already been used or is invalid.' }

  await prismaUnscoped.user.update({
    where: { id: user.id },
    data: {
      name,
      passwordHash: await bcrypt.hash(password, 12),
      setupToken: null, // single use
    },
  })
  redirect('/login')
}
