import { requirePermission, withTenant } from '@/lib/authz'
import { getCapacityByDepartment } from '@/modules/hr/service'

export default async function CapacityPage() {
  await requirePermission('hr.view')
  const capacity = await withTenant(() => getCapacityByDepartment())

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-400">
        Same task data as Delivery (FR-4.11 ↔ FR-6.7) — open (non-done) tasks per member.
      </p>
      {capacity.map((dept) => (
        <div key={dept.department} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="font-semibold text-slate-900">{dept.department}</h2>
            {dept.unassignedDeptTasks > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                {dept.unassignedDeptTasks} unassigned task(s)
              </span>
            )}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Member</th>
                <th className="px-4 py-2">Open tasks</th>
                <th className="px-4 py-2">Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dept.members.map((m) => (
                <tr key={m.name}>
                  <td className="px-4 py-2 font-medium text-slate-900">{m.name}</td>
                  <td className="px-4 py-2 text-slate-600">{m.openTasks}</td>
                  <td className={m.overdue > 0 ? 'px-4 py-2 font-semibold text-red-600' : 'px-4 py-2 text-slate-600'}>
                    {m.overdue}
                  </td>
                </tr>
              ))}
              {dept.members.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-3 text-center text-slate-400">No members.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
      {capacity.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-400">
          No departments configured.
        </p>
      )}
    </div>
  )
}
