'use client'

import { useActionState } from 'react'
import { completeSetupAction, type SetupState } from './actions'

const field =
  'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none'

export function SetupForm({
  token,
  email,
  defaultName,
}: {
  token: string
  email: string
  defaultName: string
}) {
  const [state, formAction, pending] = useActionState<SetupState, FormData>(completeSetupAction, {})

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
      <input type="hidden" name="token" value={token} />
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-300">Email</span>
        <p className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-400">{email}</p>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-300">Your name</span>
        <input name="name" defaultValue={defaultName} required className={field} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-300">Create password (min 8 chars)</span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={field} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-300">Confirm password</span>
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={field} />
      </label>
      {state.error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{state.error}</p>
      )}
      <button
        disabled={pending}
        className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? 'Setting up…' : 'Create my account'}
      </button>
    </form>
  )
}
