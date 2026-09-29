'use client'

import { useActionState, useState } from 'react'
import {
  updateClientAction,
  updateClientContactAction,
  type ClientActionState,
} from '@/modules/clients/actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'
const label = 'mb-1 block text-xs font-medium text-slate-500'
const primaryBtn =
  'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60'
const ghostBtn =
  'rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50'

export function EditClientForm({
  client,
  owners,
}: {
  client: {
    id: string
    name: string
    legalName: string | null
    gstin: string | null
    status: string
    ownerId: string | null
  }
  owners: Array<{ id: string; name: string }>
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ClientActionState, FormData>(updateClientAction, {})

  if (!open) {
    return <button onClick={() => setOpen(true)} className={ghostBtn}>Edit client</button>
  }

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <input type="hidden" name="clientId" value={client.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="client-name">Client name</label>
          <input id="client-name" name="name" defaultValue={client.name} required className={field} />
        </div>
        <div>
          <label className={label} htmlFor="client-legal">Legal name</label>
          <input id="client-legal" name="legalName" defaultValue={client.legalName ?? ''} className={field} />
        </div>
        <div>
          <label className={label} htmlFor="client-gstin">GSTIN</label>
          <input id="client-gstin" name="gstin" defaultValue={client.gstin ?? ''} className={field} />
        </div>
        <div>
          <label className={label} htmlFor="client-status">Status</label>
          <select id="client-status" name="status" defaultValue={client.status} className={field}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="churned">Churned</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="client-owner">Account owner</label>
          <select id="client-owner" name="ownerId" defaultValue={client.ownerId ?? ''} className={field}>
            <option value="">Unassigned</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={primaryBtn}>
          {pending ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={ghostBtn}>Cancel</button>
      </div>
    </form>
  )
}

export function EditContactForm({
  contact,
  clientId,
}: {
  contact: {
    id: string
    name: string
    role: string | null
    phone: string | null
    email: string | null
    isPrimary: boolean
  }
  clientId: string
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ClientActionState, FormData>(updateClientContactAction, {})

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs font-medium text-indigo-600 hover:underline">
        Edit
      </button>
    )
  }

  return (
    <form action={formAction} className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <input type="hidden" name="contactId" value={contact.id} />
      <input type="hidden" name="clientId" value={clientId} />
      <div className="grid gap-2 sm:grid-cols-2">
        <input name="name" defaultValue={contact.name} required placeholder="Name" className={field} />
        <input name="role" defaultValue={contact.role ?? ''} placeholder="Role" className={field} />
        <input name="phone" defaultValue={contact.phone ?? ''} placeholder="Phone" className={field} />
        <input name="email" type="email" defaultValue={contact.email ?? ''} placeholder="Email" className={field} />
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" name="isPrimary" value="true" defaultChecked={contact.isPrimary} />
        Primary contact
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={primaryBtn}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={ghostBtn}>Cancel</button>
      </div>
    </form>
  )
}
