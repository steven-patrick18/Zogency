import { requirePermission, withTenant } from '@/lib/authz'
import { INTEGRATION_CATALOG } from '@/modules/integrations/catalog'
import { listConnections } from '@/modules/integrations/service'
import { ConnectForm, DisconnectButton } from './integration-panels'

export default async function IntegrationsPage() {
  await requirePermission('settings.manage')
  const connections = await withTenant(() => listConnections())
  const connectedByProvider = new Map(connections.map((c) => [c.provider, c]))
  const categories = [...new Set(INTEGRATION_CATALOG.map((d) => d.category))]
  const baseUrl = process.env.AUTH_URL ?? 'https://your-domain'

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-500">
        Connect your agency&apos;s own accounts — keys are encrypted at rest and never shown again
        after saving. Webhook URLs below go into the vendor&apos;s console. Go live whenever your
        account is ready (doc 11 Q5).
      </p>
      {categories.map((category) => (
        <section key={category}>
          <h2 className="mb-3 font-semibold text-slate-900">{category}</h2>
          <div className="grid grid-cols-2 gap-4">
            {INTEGRATION_CATALOG.filter((d) => d.category === category).map((def) => {
              const connection =
                connectedByProvider.get(def.provider) ??
                (def.provider === 'custom'
                  ? undefined
                  : [...connectedByProvider.values()].find((c) => c.provider === def.provider))
              const customConnections =
                def.provider === 'custom'
                  ? connections.filter((c) => c.provider.startsWith('custom:'))
                  : []
              return (
                <div key={def.provider} className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-slate-900">{def.name}</h3>
                    {connection?.status === 'connected' && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        connected
                      </span>
                    )}
                  </div>
                  {def.note && <p className="mt-1 text-xs text-slate-500">{def.note}</p>}
                  {def.webhookPath && (
                    <p className="mt-2 rounded bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-600">
                      {baseUrl}
                      {def.webhookPath}
                    </p>
                  )}
                  {connection?.status === 'connected' && (
                    <div className="mt-2 space-y-0.5 text-xs text-slate-500">
                      {Object.entries(connection.display).slice(0, 4).map(([k, v]) => (
                        <p key={k}>
                          <span className="text-slate-400">{k}:</span> {v}
                        </p>
                      ))}
                      <DisconnectButton provider={connection.provider} />
                    </div>
                  )}
                  {customConnections.map((c) => (
                    <div key={c.provider} className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-600">
                      <span className="font-medium">{c.display.name ?? c.provider}</span> — {c.status}
                      {c.status === 'connected' && <DisconnectButton provider={c.provider} />}
                    </div>
                  ))}
                  <ConnectForm def={def} isReconnect={connection?.status === 'connected'} />
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
