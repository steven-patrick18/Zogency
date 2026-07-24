// Leave policy & company calendar (admin): leave types with quotas, holiday
// calendar, and upcoming approved leaves.
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { removeHolidayAction } from '@/modules/hr/actions'
import { HolidayForm, LeaveTypeForm } from './policy-panels'

export default async function PolicyPage() {
  const session = await requirePermission('hr.view')
  const canManage = session.user.permissions.includes('hr.manage')

  const data = await withTenant(async () => {
    const [leaveTypes, holidays, upcomingLeaves, users] = await Promise.all([
      prisma.leaveType.findMany({ orderBy: { name: 'asc' }, include: { balances: true } }),
      prisma.holiday.findMany({ orderBy: { date: 'asc' } }),
      prisma.leaveRequest.findMany({
        where: { state: 'approved', toOn: { gte: new Date() } },
        include: { type: true, employee: true },
        orderBy: { fromOn: 'asc' },
        take: 20,
      }),
      prisma.user.findMany({ select: { id: true, name: true } }),
    ])
    return { leaveTypes, holidays, upcomingLeaves, users }
  })
  const userName = new Map(data.users.map((u) => [u.id, u.name]))
  const today = new Date()

  return (
    <div className="grid max-w-5xl grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Leave policy</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Quotas apply per calendar year; new types provision balances for all active employees.
          </p>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr><th className="py-1">Type</th><th>Annual quota</th><th>Carry forward</th><th>Employees covered</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.leaveTypes.map((t) => (
                <tr key={t.id}>
                  <td className="py-1.5 font-medium text-slate-900">{t.name}</td>
                  <td>{t.annualQuota} days</td>
                  <td>{t.carryForward ? 'Yes' : 'No'}</td>
                  <td className="text-slate-500">{t.balances.filter((b) => b.year === today.getFullYear()).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {canManage && <LeaveTypeForm />}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Upcoming approved leaves</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.upcomingLeaves.length === 0 && <li className="text-slate-400">None scheduled.</li>}
            {data.upcomingLeaves.map((l) => (
              <li key={l.id} className="flex items-center justify-between">
                <span className="text-slate-800">{userName.get(l.employee.userId) ?? '—'}</span>
                <span className="text-xs text-slate-500">
                  {l.type.name} · {l.fromOn.toDateString()} → {l.toOn.toDateString()} ({l.days}d)
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Company holiday calendar</h2>
        <p className="mt-0.5 text-xs text-slate-400">Applies to attendance and leave planning.</p>
        {canManage && <HolidayForm />}
        <ul className="mt-4 space-y-2 text-sm">
          {data.holidays.length === 0 && <li className="text-slate-400">No holidays added yet.</li>}
          {data.holidays.map((h) => {
            const past = h.date < today
            return (
              <li key={h.id} className="flex items-center justify-between">
                <span className={past ? 'text-slate-400 line-through' : 'text-slate-800'}>
                  {h.date.toDateString()} — {h.name}
                </span>
                {canManage && (
                  <form action={removeHolidayAction}>
                    <input type="hidden" name="id" value={h.id} />
                    <button className="text-xs text-red-500 hover:underline">Remove</button>
                  </form>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
