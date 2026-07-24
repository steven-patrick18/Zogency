'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit } from '@/lib/audit'
import { requireSession, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { newSecret, otpauthUrl, verifyTotp } from '@/lib/totp'

export type TotpState = { error?: string; success?: string; secret?: string; otpauth?: string }

// Step 1: generate a secret and return the otpauth URL for the QR / manual entry.
export async function beginTotpAction(): Promise<TotpState> {
  const session = await requireSession()
  const secret = newSecret()
  await withTenant(async () => {
    // Store provisionally (not enabled until confirmed with a valid code).
    await prisma.user.update({ where: { id: session.user.id }, data: { totpSecret: secret } })
  })
  return { secret, otpauth: otpauthUrl(secret, session.user.email ?? 'user') }
}

// Step 2: confirm with a code → enable 2FA.
export async function confirmTotpAction(_p: TotpState, formData: FormData): Promise<TotpState> {
  const session = await requireSession()
  const code = z.string().parse(formData.get('code') ?? '')
  const result = await withTenant(async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } })
    if (!user.totpSecret) return { error: 'Start setup again' }
    if (!verifyTotp(user.totpSecret, user.email, code)) return { error: 'Code did not match — try again' }
    await prisma.user.update({ where: { id: session.user.id }, data: { totpEnabled: true } })
    await audit('security.2fa_enabled', 'user', session.user.id, null, { enabled: true })
    return { success: '2FA is now enabled — you will be asked for a code at login.' }
  })
  revalidatePath('/settings/security')
  return result
}

export async function disableTotpAction(): Promise<TotpState> {
  const session = await requireSession()
  await withTenant(async () => {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { totpEnabled: false, totpSecret: null },
    })
    await audit('security.2fa_disabled', 'user', session.user.id, { enabled: true }, { enabled: false })
  })
  revalidatePath('/settings/security')
  return { success: '2FA disabled.' }
}
