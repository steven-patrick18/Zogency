import { withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { updateGeneralSettings } from '@/modules/settings/actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'
const labelCls = 'mb-1 block font-medium text-slate-700'

// IANA time zones for the picker (falls back to a small list on old runtimes).
function timeZones(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
    if (fn) return fn('timeZone')
  } catch {
    /* not supported */
  }
  return ['Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'UTC']
}

export default async function GeneralSettingsPage() {
  const settings = await withTenant(() => prisma.tenantSettings.findFirstOrThrow())
  const zones = timeZones()

  return (
    <form action={updateGeneralSettings} className="space-y-8">
      {/* Branding & workflow */}
      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">Workspace configuration</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className={labelCls}>Brand color</span>
            <input name="primaryColor" type="text" defaultValue={settings.primaryColor} className={field} />
          </label>
          <label className="block text-sm">
            <span className={labelCls}>Lead first-contact SLA (hours)</span>
            <input name="slaHours" type="number" defaultValue={settings.slaHours} className={field} />
          </label>
          <label className="block text-sm">
            <span className={labelCls}>Default revision rounds</span>
            <input name="revisionRoundDefault" type="number" defaultValue={settings.revisionRoundDefault} className={field} />
          </label>
          <label className="block text-sm">
            <span className={labelCls}>Email sender name</span>
            <input name="emailSenderName" defaultValue={settings.emailSenderName ?? ''} className={field} />
          </label>
          <label className="col-span-2 block text-sm">
            <span className={labelCls}>Email sender address</span>
            <input name="emailSenderAddress" type="email" defaultValue={settings.emailSenderAddress ?? ''} className={field} />
          </label>
        </div>
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
            <select name="timezone" defaultValue={settings.timezone} className={field}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className={labelCls}>Phone</span>
            <input name="phone" defaultValue={settings.phone ?? ''} placeholder="+91 …" className={field} />
          </label>
          <label className="col-span-2 block text-sm">
            <span className={labelCls}>Address</span>
            <input name="addressLine" defaultValue={settings.addressLine ?? ''} placeholder="Street, building, area" className={field} />
          </label>
          <label className="block text-sm">
            <span className={labelCls}>City</span>
            <input name="city" defaultValue={settings.city ?? ''} className={field} />
          </label>
          <label className="block text-sm">
            <span className={labelCls}>State / region</span>
            <input name="stateRegion" defaultValue={settings.stateRegion ?? ''} className={field} />
          </label>
          <label className="block text-sm">
            <span className={labelCls}>Postal code</span>
            <input name="postalCode" defaultValue={settings.postalCode ?? ''} className={field} />
          </label>
          <label className="block text-sm">
            <span className={labelCls}>Country</span>
            <input name="country" defaultValue={settings.country ?? ''} placeholder="India" className={field} />
          </label>
          <label className="block text-sm">
            <span className={labelCls}>Website</span>
            <input name="websiteUrl" type="url" defaultValue={settings.websiteUrl ?? ''} placeholder="https://…" className={field} />
          </label>
          <label className="block text-sm">
            <span className={labelCls}>Tax ID (GSTIN / VAT)</span>
            <input name="taxId" defaultValue={settings.taxId ?? ''} className={field} />
          </label>
        </div>
      </section>

      <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
        Save changes
      </button>
    </form>
  )
}
