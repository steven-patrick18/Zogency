import { withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { updateGeneralSettings } from '@/modules/settings/actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'

export default async function GeneralSettingsPage() {
  const settings = await withTenant(() => prisma.tenantSettings.findFirstOrThrow())

  return (
    <form action={updateGeneralSettings} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="font-semibold text-slate-900">Workspace configuration</h2>
      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Brand color</span>
          <input name="primaryColor" type="text" defaultValue={settings.primaryColor} className={field} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Lead first-contact SLA (hours)</span>
          <input name="slaHours" type="number" defaultValue={settings.slaHours} className={field} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Default revision rounds</span>
          <input
            name="revisionRoundDefault"
            type="number"
            defaultValue={settings.revisionRoundDefault}
            className={field}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Email sender name</span>
          <input name="emailSenderName" defaultValue={settings.emailSenderName ?? ''} className={field} />
        </label>
        <label className="col-span-2 block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Email sender address</span>
          <input
            name="emailSenderAddress"
            type="email"
            defaultValue={settings.emailSenderAddress ?? ''}
            className={field}
          />
        </label>
      </div>
      <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
        Save changes
      </button>
    </form>
  )
}
