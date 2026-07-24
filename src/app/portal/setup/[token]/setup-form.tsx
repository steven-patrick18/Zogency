'use client'

import { useActionState } from 'react'
import { portalSetPasswordAction, type PortalLoginState } from '@/modules/portal/actions'

export default function SetupForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<PortalLoginState, FormData>(portalSetPasswordAction, {})

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">Set your password</h1>
          <p className="mt-1 text-sm text-slate-400">Create a password to access your client portal</p>
        </div>
        <form
          action={formAction}
          className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl"
        >
          <input type="hidden" name="token" value={token} />
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-300">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              placeholder="At least 8 characters"
            />
          </div>
          {state.error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Set password & continue'}
          </button>
        </form>
      </div>
    </main>
  )
}
