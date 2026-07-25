// Leave policy & company calendar (admin): strict-policy leave types with rules,
// tenant-level caps, holiday calendar, upcoming leaves, and the rendered policy.
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { removeHolidayAction } from '@/modules/hr/actions'
import { HolidayForm, LeaveCapsForm, LeaveTypeForm, LeaveTypeRow } from './policy-panels'
import { LeavePolicyDocument } from './policy-document'

export default async function PolicyPage() {
  const session = await requirePermission('hr.view')
  const canManage = session.user.permissions.includes('hr.manage')
  const year = new Date().getFullYear()

  const data = await withTenant(async () => {
    const [leaveTypes, holidays, upcomingLeaves, users, settings] = await Promise.all([
      prisma.leaveType.findMany({ orderBy: { name: 'asc' }, include: { balances: true } }),
      prisma.holiday.findMany({ orderBy: { date: 'asc' } }),
      prisma.leaveRequest.findMany({
        where: { state: 'approved', toOn: { gte: new Date() } },
        include: { type: true, employee: true },
        orderBy: { fromOn: 'asc' },
        take: 20,
      }),
      prisma.user.findMany({ select: { id: true, name: true } }),
      prisma.tenantSettings.findFirst(),
    ])
    return { leaveTypes, holidays, upcomingLeaves, users, settings }
  })
  const userName = new Map(data.users.map((u) => [u.id, u.name]))
  const today = new Date()
  const cap = data.settings?.maxContinuousAbsenceDays ?? 4
  const notice = data.settings?.plannedLeaveNoticeDays ?? 2

  return (
    <div className="max-w-5xl space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Leave types &amp; rules</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Rules are enforced when employees apply. Quotas apply per calendar year; new types provision
              balances for all active employees.
            </p>
            <div className="mt-3">
              {canManage ? (
                data.leaveTypes.map((t) => (
                  <LeaveTypeRow
                    key={t.id}
                    t={{
                      id: t.id,
                      name: t.name,
                      code: t.code,
                      annualQuota: t.annualQuota,
                      carryForwardMax: t.carryForwardMax,
                      accrualPerMonth: t.accrualPerMonth,
                      maxConsecutive: t.maxConsecutive,
                      woffAdjacency: t.woffAdjacency,
                      standaloneOnly: t.standaloneOnly,
                      clubbableWithLeave: t.clubbableWithLeave,
                      encashable: t.encashable,
                      requiresConfirmation: t.requiresConfirmation,
                      requiresRestrictedHoliday: t.requiresRestrictedHoliday,
                      covered: t.balances.filter((b) => b.year === year).length,
                    }}
                  />
                ))
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                    <tr><th className="py-1">Type</th><th>Quota</th><th>Max at a time</th><th>Carry</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.leaveTypes.map((t) => (
                      <tr key={t.id}>
                        <td className="py-1.5 font-medium text-slate-900">{t.name}</td>
                        <td>{t.annualQuota} days</td>
                        <td>{t.maxConsecutive || '—'}</td>
                        <td>{t.carryForwardMax ? `≤${t.carryForwardMax}` : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {canManage && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="mb-1 text-xs font-medium text-slate-500">Add a new leave type</p>
                <LeaveTypeForm />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Leave caps</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              The absolute limits that sit above every leave type. Continuous absence counts CL, EL, RH,
              public holidays and weekly-offs together.
            </p>
            {canManage ? (
              <LeaveCapsForm maxContinuousAbsenceDays={cap} plannedLeaveNoticeDays={notice} />
            ) : (
              <p className="mt-2 text-sm text-slate-700">
                Max continuous absence: <strong>{cap} days</strong> · Planned-leave notice:{' '}
                <strong>{notice} working days</strong>
              </p>
            )}
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
          <p className="mt-0.5 text-xs text-slate-400">
            <span className="font-medium text-slate-500">Public</span> = mandatory day off for everyone.{' '}
            <span className="font-medium text-slate-500">Restricted</span> = optional; employees pick from these
            via Restricted-Holiday leave (capped by the RH quota).
          </p>
          {canManage && <HolidayForm />}
          <ul className="mt-4 space-y-2 text-sm">
            {data.holidays.length === 0 && <li className="text-slate-400">No holidays added yet.</li>}
            {data.holidays.map((h) => {
              const past = h.date < today
              const restricted = h.kind === 'restricted'
              return (
                <li key={h.id} className="flex items-center justify-between">
                  <span className={past ? 'text-slate-400 line-through' : 'text-slate-800'}>
                    {h.date.toDateString()} — {h.name}
                    <span className={`ml-2 rounded px-1.5 py-0.5 text-[11px] font-medium ${restricted ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                      {restricted ? 'Restricted' : 'Public'}
                    </span>
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

      <LeavePolicyDocument
        types={data.leaveTypes.map((t) => ({
          name: t.name,
          code: t.code,
          annualQuota: t.annualQuota,
          accrualPerMonth: t.accrualPerMonth,
          carryForwardMax: t.carryForwardMax,
          maxConsecutive: t.maxConsecutive,
          woffAdjacency: t.woffAdjacency,
          standaloneOnly: t.standaloneOnly,
          clubbableWithLeave: t.clubbableWithLeave,
          encashable: t.encashable,
          requiresConfirmation: t.requiresConfirmation,
          requiresRestrictedHoliday: t.requiresRestrictedHoliday,
        }))}
        cap={cap}
        notice={notice}
      />
    </div>
  )
}
