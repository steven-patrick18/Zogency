import { requirePermission, withTenant } from '@/lib/authz'
import { getProductivity } from '@/modules/productivity/service'

export default async function ProductivityPage() {
  await requirePermission('reports.view')
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const rows = await withTenant(() => getProductivity(startOfToday))
  const anyAgent = rows.some((r) => r.agentConnected)

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Productivity</h1>
      <p className="mt-1 text-sm text-slate-500">
        Today&apos;s activity per team member. CRM signals (actions, calls, tasks) are always
        tracked; active/idle time and top apps appear when the desktop monitoring agent is connected.
      </p>
      {!anyAgent && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No desktop agents connected yet. Issue an agent token on an employee&apos;s HR profile and
          install the Zogency desktop agent (requires signed employee consent) to capture screen-time.
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">CRM actions</th>
              <th className="px-4 py-3">Calls</th>
              <th className="px-4 py-3">Tasks done</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Idle</th>
              <th className="px-4 py-3">Top apps</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.userId} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">
                  {r.name}
                  {r.agentConnected && (
                    <span className="ml-1.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                      agent
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{r.department ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{r.actions}</td>
                <td className="px-4 py-3 text-slate-600">{r.calls}</td>
                <td className="px-4 py-3 text-slate-600">{r.tasksDone}</td>
                <td className="px-4 py-3 text-slate-600">{r.agentConnected ? `${r.activeMin} min` : '—'}</td>
                <td className="px-4 py-3 text-slate-600">{r.agentConnected ? `${r.idleMin} min` : '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{r.topApps.join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
