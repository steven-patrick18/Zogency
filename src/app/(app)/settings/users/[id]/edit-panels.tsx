'use client'

import { useActionState } from 'react'
import {
  removeAvatarAction,
  resetPasswordAction,
  updateUserAction,
  uploadAvatarAction,
} from '@/modules/users/actions'

type State = { error?: string; success?: string }
const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'

function Feedback({ state }: { state: State }) {
  if (state.error) return <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>
  if (state.success) return <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">{state.success}</p>
  return null
}

export function AvatarPanel({ userId, avatar, name }: { userId: string; avatar: string | null; name: string }) {
  const [state, formAction, pending] = useActionState<State, FormData>(uploadAvatarAction, {})
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="flex items-center gap-5 rounded-xl border border-slate-200 bg-white p-5">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt={name} className="h-20 w-20 rounded-full object-cover" />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 text-2xl font-bold text-indigo-600">
          {initials}
        </div>
      )}
      <div className="flex-1 space-y-2">
        <h3 className="font-semibold text-slate-900">Profile photo</h3>
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="userId" value={userId} />
          <input
            type="file"
            name="avatar"
            accept="image/png,image/jpeg,image/webp"
            required
            className="text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-indigo-500"
          />
          <button
            disabled={pending}
            className="rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          >
            {pending ? 'Uploading…' : 'Upload'}
          </button>
          {avatar && (
            <button formAction={removeAvatarAction} className="text-xs text-red-500 hover:underline">
              Remove photo
            </button>
          )}
        </form>
        <p className="text-xs text-slate-400">PNG/JPEG/WebP, max 300 KB.</p>
        <Feedback state={state} />
      </div>
    </div>
  )
}

export function ProfilePanel({
  userId,
  name,
  email,
  phone,
}: {
  userId: string
  name: string
  email: string
  phone: string
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(updateUserAction, {})

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="font-semibold text-slate-900">Profile</h3>
      <input type="hidden" name="userId" value={userId} />
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Full name *</span>
          <input name="name" defaultValue={name} required className={field} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Email *</span>
          <input name="email" type="email" defaultValue={email} required className={field} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Phone</span>
          <input name="phone" defaultValue={phone} className={field} />
        </label>
      </div>
      <Feedback state={state} />
      <button
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  )
}

export function PasswordPanel({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState<State, FormData>(resetPasswordAction, {})

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="font-semibold text-slate-900">Reset password</h3>
      <input type="hidden" name="userId" value={userId} />
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">New password (min 8 characters)</span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={field} />
      </label>
      <Feedback state={state} />
      <button
        disabled={pending}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? 'Updating…' : 'Set new password'}
      </button>
    </form>
  )
}
