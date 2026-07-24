'use client'

import { useActionState, useState } from 'react'
import {
  createClientInstallAction,
  publishReleaseAction,
  retryInstallAction,
  type VendorActionState,
} from '@/modules/vendor/actions'
import {
  createDemoUserAction,
  endDemoUserAction,
  type DemoActionState,
} from '@/modules/vendor/demo-actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'

function Feedback({ state }: { state: VendorActionState }) {
  if (state.error) return <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>
  if (state.success) return <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">{state.success}</p>
  return null
}

export function NewClientForm() {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<VendorActionState, FormData>(
    createClientInstallAction,
    {},
  )

  if (!open) {
    return (
      <div>
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          + New client install
        </button>
        <Feedback state={state} />
      </div>
    )
  }
  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-5">
      <h2 className="font-semibold text-slate-900">New client install</h2>
      <p className="text-xs text-slate-500">
        Before submitting: the client must have pointed their domain&apos;s A-record at their server IP
        and given you root SSH access.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <input name="companyName" required placeholder="Company name *" className={field} />
        <input name="contactEmail" type="email" required placeholder="Client admin email *" className={field} />
        <input name="domain" required placeholder="Domain (crm.client.com) *" className={field} />
        <input name="serverIp" required placeholder="Server IP *" className={field} />
        <input name="sshUser" defaultValue="root" placeholder="SSH user" className={field} />
        <input name="sshPassword" type="password" required placeholder="SSH password *" className={field} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <select name="plan" defaultValue="pro" className={field}>
          <option value="pro">Pro plan</option>
          <option value="starter">Starter plan</option>
        </select>
        <input name="seats" type="number" defaultValue={15} min={1} className={field} title="Seats" />
        <input name="days" type="number" defaultValue={365} min={7} className={field} title="License days" />
      </div>
      <Feedback state={state} />
      <div className="flex gap-2">
        <button
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {pending ? 'Starting…' : 'Issue license & install'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-2 text-sm text-slate-500 hover:underline">
          Cancel
        </button>
      </div>
    </form>
  )
}

export function PublishReleaseForm() {
  const [state, formAction, pending] = useActionState<VendorActionState, FormData>(publishReleaseAction, {})
  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
      <input name="ref" defaultValue="main" placeholder="git ref (main or commit sha)" className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <input name="notes" placeholder="Release notes (optional)" className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <button
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? 'Publishing…' : 'Publish update to clients'}
      </button>
      <Feedback state={state} />
    </form>
  )
}

type DemoUser = { id: string; email: string; name: string; status: string; expiresAt: string }

export function DemoAccessCard({ demoUsers }: { demoUsers: DemoUser[] }) {
  const [state, formAction, pending] = useActionState<DemoActionState, FormData>(createDemoUserAction, {})
  return (
    <div className="mt-3 space-y-3">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-slate-500">
          Valid for (hours)
          <input
            name="hours"
            type="number"
            defaultValue={24}
            min={1}
            max={720}
            className="mt-1 block w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </label>
        <button
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create demo login'}
        </button>
      </form>
      {!state.credentials && <Feedback state={state} />}

      {state.credentials && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
          <p className="font-medium text-green-800">
            {state.success ?? 'Demo login created — copy the credentials now.'}
          </p>
          <p className="mt-2 font-mono text-green-900">
            {state.credentials.email} / {state.credentials.password}
          </p>
          <p className="mt-1 text-xs text-green-700">Expires: {state.credentials.expiresAt}</p>
          <p className="mt-2 text-xs text-green-600">
            Share: https://demo.zogency.com → login with these
          </p>
        </div>
      )}

      {demoUsers.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {demoUsers.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-slate-800">{u.email}</p>
                <p className="text-xs text-slate-400">
                  {u.name} · expires {u.expiresAt}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {u.status}
                </span>
                {u.status === 'active' && (
                  <form action={endDemoUserAction}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button className="rounded-lg border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                      End demo
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function RetryForm({ clientId, needsPassword }: { clientId: string; needsPassword: boolean }) {
  const [state, formAction, pending] = useActionState<VendorActionState, FormData>(retryInstallAction, {})
  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="clientId" value={clientId} />
      {needsPassword && (
        <input name="sshPassword" type="password" required placeholder="SSH password (re-enter)" className="w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
      )}
      <button
        disabled={pending}
        className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-400 disabled:opacity-50"
      >
        {pending ? 'Retrying…' : 'Retry install'}
      </button>
      <Feedback state={state} />
    </form>
  )
}
