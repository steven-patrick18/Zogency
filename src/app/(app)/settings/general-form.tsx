'use client'

import { useActionState } from 'react'
import { updateGeneralSettings, type GeneralSettingsState } from '@/modules/settings/actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'
const labelCls = 'mb-1 block font-medium text-slate-700'

export type GeneralSettingsValues = {
  primaryColor: string
  slaHours: number
  revisionRoundDefault: number
  emailSenderName: string
  emailSenderAddress: string
  timezone: string
  country: string
  addressLine: string
  city: string
  stateRegion: string
  postalCode: string
  phone: string
  websiteUrl: string
  taxId: string
  requireTaskApproval: boolean
}

export function GeneralSettingsForm({ values, zones }: { values: GeneralSettingsValues; zones: string[] }) {
  const [state, formAction, pending] = useActionState<GeneralSettingsState, FormData>(updateGeneralSettings, {})

  return (
    <form action={formAction} className="space-y-8">
      {/* Branding & workflow */}
      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">Workspace configuration</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className={labelCls}>Brand color</span>
            <input name="primaryColor" type="text" defaultValue={values.primaryColor} className={field} />
          </label>
          <label className="block text-sm">
            <span className={labelCls}>Lead first-contact SLA (hours)</span>
            <input name="slaHours" type="number" defaultValue={values.slaHours} className={field} />
          </label>
          <label className="block text-sm">
            <span className={labelCls}>Default revision rounds</span>
            <input name="revisionRoundDefault" type="number" defaultValue={values.revisionRoundDefault} className={field} />
          </label>
          <label className="block text-sm">
            <span className={labelCls}>Email sender name</span>
            <input name="emailSenderName" defaultValue={values.emailSenderName} className={field} />
          </label>
          <label className="col-span-2 block text-sm">
            <span className={labelCls}>Email sender address</span>
            <input name="emailSenderAddress" type="email" defaultValue={values.emailSenderAddress} className={field} />
          </label>
        </div>
        <label className="flex items-start gap-2 border-t border-slate-100 pt-4 text-sm">
          <input type="checkbox" name="requireTaskApproval" defaultChecked={values.requireTaskApproval} className="mt-0.5" />
          <span>
            <span className="font-medium text-slate-700">Require review approval before tasks can be completed</span>
            <span className="block text-xs text-slate-400">
              Tasks must pass through “Review”, and only an approver (a role with Approvals) can mark them Done.
            </span>
          </span>
        </label>
      </section>

      {/* Agency profile */}
      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h2 className="font-semibold text-slate-900">Agency profile</h2>
          <p className="text-xs text-slate-400">
            Used on documents and for locale-correct dates &amp; times across the workspace.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className={labelCls}>Time zone</span>
            <select name="timezone" defaultValue={values.timezone} className={field}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className={labelCls}>Phone</span>
            <input name="phone" defaultValue={values.phone} placeholder="+91 …" className={field} />
          </label>
          <label className="col-span-2 block text-sm">
            <span className={labelCls}>Address</span>
            <input name="addressLine" defaultValue={values.addressLine} placeholder="Street, building, area" className={field} />
          </label>
          <label className="block text-sm">
            <span className={labelCls}>City</span>
            <input name="city" defaultValue={values.city} className={field} />
          </label>
          <label className="block text-sm">
            <span className={labelCls}>State / region</span>
            <input name="stateRegion" defaultValue={values.stateRegion} className={field} />
          </label>
          <label className="block text-sm">
            <span className={labelCls}>Postal code</span>
            <input name="postalCode" defaultValue={values.postalCode} className={field} />
          </label>
          <label className="block text-sm">
            <span className={labelCls}>Country</span>
            <input name="country" defaultValue={values.country} placeholder="India" className={field} />
          </label>
          <label className="block text-sm">
            <span className={labelCls}>Website</span>
            <input name="websiteUrl" defaultValue={values.websiteUrl} placeholder="brb.digital" className={field} />
          </label>
          <label className="block text-sm">
            <span className={labelCls}>Tax ID (GSTIN / VAT)</span>
            <input name="taxId" defaultValue={values.taxId} className={field} />
          </label>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
        {state.success && <span className="text-sm font-medium text-green-700">{state.success}</span>}
        {state.error && <span className="text-sm font-medium text-red-600">{state.error}</span>}
      </div>
    </form>
  )
}
