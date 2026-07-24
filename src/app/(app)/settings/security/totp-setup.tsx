'use client'

import { useActionState } from 'react'
import { beginTotpAction, confirmTotpAction, type TotpState } from '@/modules/security/actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'
const primaryBtn =
  'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50'

function Feedback({ state }: { state: TotpState }) {
  if (state.error) return <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>
  if (state.success) return <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">{state.success}</p>
  return null
}

export function TotpSetup() {
  const [beginState, beginAction, beginPending] = useActionState<TotpState, FormData>(
    async () => beginTotpAction(),
    {},
  )
  const [confirmState, confirmAction, confirmPending] = useActionState<TotpState, FormData>(confirmTotpAction, {})

  return (
    <div className="mt-4 space-y-4">
      {!beginState.secret ? (
        <form action={beginAction} className="space-y-3">
          <p className="text-sm text-slate-600">
            Add an authenticator app (Google Authenticator, 1Password, Authy, …) to require a rotating code at login.
          </p>
          <Feedback state={beginState} />
          <button disabled={beginPending} className={primaryBtn}>
            {beginPending ? 'Setting up…' : 'Set up 2FA'}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-4 text-sm">
            <p className="text-slate-600">
              Add this account to your authenticator app. No QR code is rendered here, so enter the secret key manually
              or paste the setup URL.
            </p>
            <div className="mt-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Secret key</p>
              <p className="mt-1 break-all font-mono text-base font-semibold text-slate-900">{beginState.secret}</p>
            </div>
            <div className="mt-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">otpauth URL</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-600">{beginState.otpauth}</p>
            </div>
          </div>
          <form action={confirmAction} className="space-y-2">
            <label htmlFor="totp-code" className="block text-sm font-medium text-slate-700">
              Enter the 6-digit code from your app to confirm
            </label>
            <input
              id="totp-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              required
              className={field}
            />
            <Feedback state={confirmState} />
            <button disabled={confirmPending} className={primaryBtn}>
              {confirmPending ? 'Confirming…' : 'Confirm & enable 2FA'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
