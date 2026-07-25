import { requireSession, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { maybeRunLeaveAccrual } from '@/modules/hr/service'
import { LeaveDecisionsPanel, LeaveRequestForm, PunchPanel } from './attendance-panels'

const LEAVE_STATE_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export default async function AttendancePage() {
  const session = await requireSession()
  const canManage = session.user.permissions.includes('hr.manage')
  const year = new Date().getFullYear()

  const data = await withTenant(async () => {
    await maybeRunLeaveAccrual() // top up monthly accrual opportunistically
    const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } })
    const [attendance, balances, myRequests, leaveTypes] = await Promise.all([
      employee
        ? prisma.attendanceRecord.findMany({
            where: { employeeId: employee.id },
            orderBy: { date: 'desc' },
            take: 14,
          })
        : Promise.resolve([]),
      employee
        ? prisma.leaveBalance.findMany({
            where: { employeeId: employee.id, year },
            include: { type: true },
          })
        : Promise.resolve([]),
      employee
        ? prisma.leaveRequest.findMany({
            where: { employeeId: employee.id },
            include: { type: true },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
      prisma.leaveType.findMany({ orderBy: { name: 'asc' } }),
    ])
    const pendingAll = canManage
      ? await prisma.leaveRequest.findMany({
          where: { state: 'pending' },
          include: { type: true, employee: true },
          orderBy: { createdAt: 'asc' },
        })
      : []
    const users = await prisma.user.findMany({ select: { id: true, name: true } })
    return { employee, attendance, balances, myRequests, leaveTypes, pendingAll, users }
  })
  const { employee, attendance, balances, myRequests, leaveTypes, pendingAll, users } = data
  const userName = new Map(users.map((u) => [u.id, u.name]))

  return (
    <div className="space-y-6">
      {!employee && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You have no employee record yet — ask HR to link one. Attendance punch and leave requests
          need an employee record.
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">My day</h2>
          {employee ? (
            <div className="mt-3 space-y-4">
              <PunchPanel />
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr><th className="py-1">Date</th><th>In</th><th>Out</th><th>Mode</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendance.map((a) => (
                    <tr key={a.id}>
                      <td className="py-1.5 text-slate-900">{a.date.toISOString().slice(0, 10)}</td>
                      <td className="text-slate-600">{a.inAt ? a.inAt.toLocaleTimeString() : '—'}</td>
                      <td className="text-slate-600">{a.outAt ? a.outAt.toLocaleTimeString() : '—'}</td>
                      <td className="text-xs text-slate-500">{a.mode}</td>
                    </tr>
                  ))}
                  {attendance.length === 0 && (
                    <tr><td colSpan={4} className="py-3 text-center text-slate-400">No attendance yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">Punch is unavailable without an employee record.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">My leave</h2>
          {employee ? (
            <div className="mt-3 space-y-4">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr><th className="py-1">Type</th><th>Left</th><th>Quota</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {balances.map((b) => (
                    <tr key={b.id}>
                      <td className="py-1.5 text-slate-900">{b.type.name}</td>
                      <td className="font-medium text-slate-900">{b.available - b.used}</td>
                      <td className="text-slate-500">{b.used} used of {b.available}</td>
                    </tr>
                  ))}
                  {balances.length === 0 && (
                    <tr><td colSpan={3} className="py-3 text-center text-slate-400">No balances for {year}.</td></tr>
                  )}
                </tbody>
              </table>
              <LeaveRequestForm types={leaveTypes.map((t) => ({ id: t.id, name: t.name }))} />
              <ul className="space-y-2">
                {myRequests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-sm">
                    <span className="text-slate-700">
                      {r.type.name} · {r.fromOn.toISOString().slice(0, 10)} → {r.toOn.toISOString().slice(0, 10)} · {r.days} day(s)
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LEAVE_STATE_STYLES[r.state] ?? 'bg-slate-100 text-slate-600'}`}>
                      {r.state}
                    </span>
                  </li>
                ))}
                {myRequests.length === 0 && <p className="text-sm text-slate-400">No leave requests yet.</p>}
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">Leave is unavailable without an employee record.</p>
          )}
        </div>
      </div>

      {canManage && (
        <LeaveDecisionsPanel
          pending={pendingAll.map((r) => ({
            id: r.id,
            employee: userName.get(r.employee.userId) ?? '—',
            type: r.type.name,
            fromOn: r.fromOn.toISOString().slice(0, 10),
            toOn: r.toOn.toISOString().slice(0, 10),
            days: r.days,
            reason: r.reason,
          }))}
        />
      )}
    </div>
  )
}
