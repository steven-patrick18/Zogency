import { withTenant } from '@/lib/authz'
import { activateLicense } from '@/modules/settings/actions'
import { deployMode, getWorkspaceLicense } from '@/modules/settings/service'

const STATE_STYLES: Record<string, string> = {
  valid: 'bg-green-100 text-green-700',
  expiring: 'bg-amber-100 text-amber-700',
  grace: 'bg-amber-100 text-amber-700',
  expired: 'bg-red-100 text-red-700',
  invalid: 'bg-slate-200 text-slate-600',
}

export default async function LicensePage() {
  const info = await withTenant(() => getWorkspaceLicense())
  const mode = deployMode()

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-slate-900">Workspace license</h2>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE_STYLES[info.state]}`}>
            {info.state}
          </span>
          <span className="text-xs text-slate-400">deployment: {mode}</span>
        </div>
        {info.claims ? (
          <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div><dt className="text-slate-500">Customer</dt><dd className="font-medium text-slate-900">{info.claims.customer}</dd></div>
            <div><dt className="text-slate-500">Plan</dt><dd className="font-medium text-slate-900">{info.claims.plan}</dd></div>
            <div><dt className="text-slate-500">Seats</dt><dd className="font-medium text-slate-900">{info.claims.seats}</dd></div>
            <div><dt className="text-slate-500">Expires</dt><dd className="font-medium text-slate-900">{new Date(info.claims.expiresAt).toDateString()} ({info.daysLeft} days)</dd></div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            {mode === 'cloud'
              ? 'No license key installed — cloud workspaces are entitled by subscription.'
              : 'No license key installed — this self-hosted workspace is read-only until activated.'}
          </p>
        )}
      </div>

      <form action={activateLicense} className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">Install / renew license key</h2>
        <textarea
          name="key"
          rows={4}
          required
          placeholder="zgy1.…"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs focus:border-indigo-500 focus:outline-none"
        />
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
          Activate
        </button>
      </form>
    </div>
  )
}
