// Settings → Server: host status (CPU/memory/disk/uptime) plus the deep-
// monitoring screen-capture footprint, with admin controls to set the capture
// retention window and free storage by deleting images.
import { requirePermission, withTenant } from '@/lib/authz'
import { getCaptureStorage, getServerStatus } from '@/modules/system/service'
import { PurgeButtons, RetentionForm } from './server-panels'

const fmtBytes = (n: number) => {
  if (n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
const fmtUptime = (s: number) => {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ')
}

function Bar({ used, total, warn }: { used: number; total: number; warn?: boolean }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const color = pct >= 90 ? 'bg-red-500' : pct >= 75 || warn ? 'bg-amber-500' : 'bg-indigo-500'
  return (
    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

export default async function ServerStatusPage() {
  await requirePermission('system.manage')
  const status = await getServerStatus()
  const storage = await withTenant(() => getCaptureStorage())
  const memPct = Math.round((status.memUsed / status.memTotal) * 100)

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="font-semibold text-slate-900">Server status</h2>
        <p className="text-sm text-slate-500">Live host metrics and monitoring-storage controls.</p>
      </div>

      {/* Host metrics */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
          <span className="text-sm font-medium text-slate-700">Online</span>
          <span className="text-xs text-slate-400">· up {fmtUptime(status.uptimeSec)}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Host" value={status.hostname} sub={status.platform} />
          <Stat label="Runtime" value={`Node ${status.nodeVersion}`} sub={`${status.cpuCount} CPU · load ${status.loadAvg1.toFixed(2)}`} />
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Memory</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{memPct}%</p>
            <p className="text-xs text-slate-500">{fmtBytes(status.memUsed)} / {fmtBytes(status.memTotal)}</p>
            <Bar used={status.memUsed} total={status.memTotal} />
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Disk</p>
            {status.disk ? (
              <>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {Math.round((status.disk.used / status.disk.total) * 100)}%
                </p>
                <p className="text-xs text-slate-500">{fmtBytes(status.disk.free)} free / {fmtBytes(status.disk.total)}</p>
                <Bar used={status.disk.used} total={status.disk.total} />
              </>
            ) : (
              <p className="mt-1 text-sm text-slate-400">unavailable</p>
            )}
          </div>
        </div>
      </div>

      {/* Screen-capture storage */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900">Monitoring storage — screen captures</h3>
        <p className="mb-4 text-xs text-slate-400">
          Deep-monitoring screenshots for this workspace. Captures auto-purge past the retention window below;
          you can also delete them manually to free space.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Captures" value={storage.count.toLocaleString('en-IN')} />
          <Stat label="Storage used" value={fmtBytes(storage.bytes)} />
          <Stat
            label="Oldest"
            value={storage.oldest ? storage.oldest.toLocaleDateString('en-IN') : '—'}
            sub={`retention ${storage.retentionHours >= 24 && storage.retentionHours % 24 === 0 ? `${storage.retentionHours / 24}d` : `${storage.retentionHours}h`}`}
          />
        </div>

        {storage.perUser.length > 0 && (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-1.5">Employee</th>
                <th>Captures</th>
                <th>Storage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {storage.perUser.map((u) => (
                <tr key={u.userId}>
                  <td className="py-1.5 font-medium text-slate-800">{u.name}</td>
                  <td className="text-slate-600">{u.count.toLocaleString('en-IN')}</td>
                  <td className="text-slate-600">{fmtBytes(u.bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Retention</p>
            <RetentionForm retentionHours={storage.retentionHours} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Free storage</p>
            <PurgeButtons hasCaptures={storage.count > 0} />
          </div>
        </div>
      </div>
    </div>
  )
}
