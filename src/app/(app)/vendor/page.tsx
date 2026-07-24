// Vendor console (master server only): issue licenses + one-click client
// installs. Enabled via ZOGENCY_VENDOR_MODE=1.
import { notFound } from 'next/navigation'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { issuerConfigured } from '@/lib/license-issuer'
import { vendorModeEnabled } from '@/modules/vendor/config'
import { NewClientForm, RetryForm } from './vendor-panels'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-slate-200 text-slate-600',
  installing: 'bg-blue-100 text-blue-700',
  installed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

export default async function VendorPage() {
  if (!vendorModeEnabled()) notFound()
  await requirePermission('settings.manage')
  const clients = await withTenant(() =>
    prisma.vendorClient.findMany({ orderBy: { createdAt: 'desc' } }),
  )

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900">Vendor console</h1>
      <p className="mt-1 text-sm text-slate-500">
        One-click client installs: license is issued, their server is provisioned over SSH, and you
        get a setup link to share. SSH credentials are encrypted and deleted after success.
      </p>
      {!issuerConfigured() && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ZOGENCY_LICENSE_PRIVATE_KEY is not set on this server — add it to .env.production to
          enable license issuing.
        </p>
      )}

      <div className="mt-6">
        <NewClientForm />
      </div>

      <div className="mt-8 space-y-4">
        {clients.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            No client installs yet.
          </p>
        )}
        {clients.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">{c.companyName}</h2>
                <p className="text-sm text-slate-500">
                  https://{c.domain} · {c.serverIp} · {c.contactEmail}
                </p>
                <p className="text-xs text-slate-400">
                  {c.plan} · {c.seats} seats · license until {c.licenseExpiresAt.toDateString()}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[c.status]}`}>
                {c.status}
              </span>
            </div>

            {c.status === 'installed' && c.setupLink && (
              <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm">
                <p className="font-medium text-green-800">Share this one-time setup link with the client:</p>
                <p className="mt-1 break-all font-mono text-xs text-green-700">{c.setupLink}</p>
                <p className="mt-1 text-xs text-green-600">
                  They open it, set their own admin password, and log in — license already active.
                </p>
              </div>
            )}

            {c.status === 'failed' && <RetryForm clientId={c.id} needsPassword={!c.sshPasswordEnc} />}

            {c.installLog && (
              <details className="mt-3" open={c.status === 'installing' || c.status === 'failed'}>
                <summary className="cursor-pointer text-xs font-medium text-slate-500">
                  Install log {c.status === 'installing' && '(refresh the page for updates)'}
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-200">
                  {c.installLog}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
