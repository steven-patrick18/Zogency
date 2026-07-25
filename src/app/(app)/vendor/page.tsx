// Vendor console (master server only): issue licenses + one-click client
// installs. Enabled via ZOGENCY_VENDOR_MODE=1.
import { notFound } from 'next/navigation'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { issuerConfigured } from '@/lib/license-issuer'
import { vendorModeEnabled } from '@/modules/vendor/config'
import { sweepExpiredDemoUsers } from '@/modules/vendor/demo-actions'
import { DemoAccessCard, NewClientForm, PublishReleaseForm, ResetDemoDataCard, RetryForm } from './vendor-panels'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-slate-200 text-slate-600',
  installing: 'bg-blue-100 text-blue-700',
  installed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

export default async function VendorPage() {
  if (!vendorModeEnabled()) notFound()
  await requirePermission('vendor.manage')
  const [clients, latestRelease, demoUsers] = await withTenant(async () => {
    await sweepExpiredDemoUsers()
    return Promise.all([
      prisma.vendorClient.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.vendorRelease.findFirst({ orderBy: { publishedAt: 'desc' } }),
      prisma.user.findMany({
        where: { demoExpiresAt: { not: null } },
        orderBy: { createdAt: 'desc' },
      }),
    ])
  })

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

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Updates</h2>
            <p className="text-xs text-slate-500">
              This master updates from git. Client installs poll this panel&apos;s release channel
              every 30 minutes and update themselves to the published version.
            </p>
          </div>
          {latestRelease && (
            <div className="text-right text-xs text-slate-500">
              <p>
                Published: <span className="font-mono font-medium text-slate-800">{latestRelease.ref}</span>
              </p>
              <p>{latestRelease.publishedAt.toLocaleString()}</p>
            </div>
          )}
        </div>
        <PublishReleaseForm />
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Demo access</h2>
        <p className="text-xs text-slate-500">
          Disposable demo logins — full product access, no vendor console, auto-disabled at expiry.
        </p>
        <DemoAccessCard
          demoUsers={demoUsers.map((u) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            status: u.status,
            expiresAt: u.demoExpiresAt?.toLocaleString() ?? '—',
          }))}
        />
      </div>

      <div className="mt-6 rounded-xl border border-red-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Reset demo data</h2>
        <ResetDemoDataCard />
      </div>

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
                {c.lastCheckinAt && (
                  <p className="text-xs text-slate-400">
                    version <span className="font-mono">{c.lastSeenVersion?.slice(0, 8) ?? '?'}</span> ·
                    last check-in {c.lastCheckinAt.toLocaleString()}
                  </p>
                )}
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
