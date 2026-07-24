// Automation rules & run log (FR-10.1–10.4). Rules are seeded/DB-managed for
// now — this page lists them, toggles enablement, and shows recent runs.
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { toggleRuleAction } from '@/modules/retention/actions'

const RUN_STATUS_STYLES: Record<string, string> = {
  success: 'bg-green-100 text-green-700',
  partial: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
}

export default async function AutomationSettingsPage() {
  await requirePermission('automation.manage')

  const { rules, runs } = await withTenant(async () => {
    const [rules, runs] = await Promise.all([
      prisma.automationRule.findMany({ orderBy: [{ runOrder: 'asc' }, { createdAt: 'asc' }] }),
      prisma.automationRun.findMany({
        include: { rule: { select: { name: true } } },
        orderBy: { at: 'desc' },
        take: 20,
      }),
    ])
    return { rules, runs }
  })

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Automation rules</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Rule builder UI lands later — rules are seeded/DB-managed.
        </p>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="py-1">Rule</th>
              <th>Trigger</th>
              <th>Entity</th>
              <th>Conditions / actions</th>
              <th className="text-right">Enabled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="py-2 font-medium text-slate-900">{r.name}</td>
                <td className="py-2 text-slate-600">{r.triggerType}</td>
                <td className="py-2 text-slate-600">{r.entityType}</td>
                <td className="py-2">
                  <pre className="max-w-xs overflow-x-auto rounded bg-slate-50 p-2 text-[11px] leading-4 text-slate-600">
                    {JSON.stringify({ conditions: r.conditions, actions: r.actions }, null, 1)}
                  </pre>
                </td>
                <td className="py-2 text-right">
                  <form action={toggleRuleAction}>
                    <input type="hidden" name="ruleId" value={r.id} />
                    <button
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        r.enabled
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                      title={r.enabled ? 'Click to disable' : 'Click to enable'}
                    >
                      {r.enabled ? 'enabled' : 'disabled'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-slate-400">No automation rules seeded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Recent runs</h2>
        <p className="mt-0.5 text-xs text-slate-400">Last 20 executions — idempotent per rule + event key.</p>
        <ul className="mt-3 space-y-2">
          {runs.map((run) => {
            const executed = (run.actionsExecuted as unknown[] | null) ?? []
            return (
              <li key={run.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-900">{run.rule.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RUN_STATUS_STYLES[run.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {run.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {run.at.toLocaleString()} · {run.triggerEntityType} · {executed.length} action{executed.length === 1 ? '' : 's'} executed
                </p>
                {run.error && <p className="mt-1 text-xs text-red-600">{run.error}</p>}
              </li>
            )
          })}
          {runs.length === 0 && <p className="text-sm text-slate-400">No automation runs yet.</p>}
        </ul>
      </div>
    </div>
  )
}
