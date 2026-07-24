'use client'

import { useActionState, useState } from 'react'
import type { ProviderDef } from '@/modules/integrations/catalog'
import {
  connectIntegrationAction,
  disconnectIntegrationAction,
  type IntegrationActionState,
} from '@/modules/integrations/actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'

export function ConnectForm({ def, isReconnect }: { def: ProviderDef; isReconnect?: boolean }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<IntegrationActionState, FormData>(
    connectIntegrationAction,
    {},
  )

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
      >
        {isReconnect ? 'Reconnect / update keys' : def.provider === 'custom' ? 'Add API' : 'Connect'}
      </button>
    )
  }
  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="provider" value={def.provider} />
      {def.fields.map((f) => (
        <label key={f.key} className="block text-xs">
          <span className="mb-0.5 block font-medium text-slate-600">
            {f.label}
            {f.required ? ' *' : ''}
          </span>
          {f.type === 'select' ? (
            <select name={f.key} required={f.required} className={field} defaultValue="">
              <option value="" disabled>
                Select…
              </option>
              {f.options?.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              name={f.key}
              type={f.type === 'password' ? 'password' : 'text'}
              required={f.required}
              className={field}
              autoComplete="off"
            />
          )}
          {f.hint && <span className="mt-0.5 block text-[11px] text-slate-400">{f.hint}</span>}
        </label>
      ))}
      {state.error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-lg bg-green-500/10 px-3 py-2 text-xs text-green-700">{state.success}</p>
      )}
      <div className="flex gap-2">
        <button
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save & connect'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-2 text-xs text-slate-500 hover:underline"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export function DisconnectButton({ provider }: { provider: string }) {
  return (
    <form action={disconnectIntegrationAction} className="mt-1 inline-block">
      <input type="hidden" name="provider" value={provider} />
      <button className="text-[11px] font-medium text-red-500 hover:underline">Disconnect</button>
    </form>
  )
}
