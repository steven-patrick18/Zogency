'use server'

import { AuthError } from 'next-auth'
import { signIn, signOut } from '@/lib/auth'

export type LoginState = { error?: string; needTotp?: boolean }

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn('credentials', {
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
      totp: String(formData.get('totp') ?? ''),
      redirectTo: '/dashboard',
    })
    return {}
  } catch (error) {
    if (error instanceof AuthError) {
      // 2FA-enabled account: prompt for the code instead of a generic error.
      if ((error as { code?: string }).code === 'totp_required') {
        const enteredCode = String(formData.get('totp') ?? '').trim()
        return {
          needTotp: true,
          error: enteredCode ? 'Invalid 2FA code' : undefined,
        }
      }
      return { error: 'Invalid email or password' }
    }
    throw error // NEXT_REDIRECT on success
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: '/login' })
}
