// HR login-hours & attendance — computed from desktop-agent activity. HR sets
// the policy (min productive hours, half-day, agent auto-logout) and reviews each
// employee's active hours + auto-marked attendance; short employees can be
// granted excess-hours credit (Admin approves → attendance auto-marks).
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { getLoginHours } from '@/modules/hr/attendance'
import { decideAttendanceCreditAction, recomputeAttendanceAction } from '@/modules/hr/actions'
import { AttendancePolicyForm, CreditRequestForm } from './login-hours-panels'

const STATUS_STYLES: Record<string, string> = {
  present: 'bg-green-100 text-green-700',
  half_day: 'bg-amber-100 text-amber-700',
  absent: 'bg-red-100 text-red-700',
}
const fmtH = (min: number) => `${Math.floor(min / 60)}h ${min % 60}m`
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default async function LoginHoursPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const session = await requirePermission('hr.view')
  const canManage = session.user.permissions.includes('hr.manage')
  const canApprove = session.user.permissions.includes('approvals.act')

  const { date } = await searchParams
  const parsed = date ? new Date(date) : new Date()
  const day = Number.isNaN(parsed.getTime()) ? new Date() : parsed
  day.setHours(0, 0, 0, 0)
  const dayStr = iso(day)
  const prev = iso(new Date(day.getTime() - 86_400_000))
  const next = iso(new Date(day.getTime() + 86_400_000))
  const isToday = dayStr === iso(new Date())

  const { rows, settings } = await withTenant(async () => ({
    rows: await getLoginHours(day),
    settings: await prisma.tenantSettings.findFirst(),
  }))
  const minMin = settings?.minProductiveMinutes ?? 480
  const minHours = minMin / 60
  const halfHours = (settings?.halfDayMinutes ?? 240) / 60
  const idleMin = settings?.agentIdleLogoutMin ?? 10

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Login hours &amp; attendance</h1>
        <p className="text-sm text-slate-500">
          Productive hours are the active time reported by the desktop agent. Attendance is marked
          automatically against the policy below.
        </p>
      </div>

      {canManage && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Attendance policy</h2>
          <p className="mb-3 text-xs text-slate-400">
            Full attendance needs at least the productive hours below; between half-day and full is a half day.
            The agent auto-pauses (stops counting) after the idle minutes set here.
          </p>
          <AttendancePolicyForm minHours={minHours} halfHours={halfHours} idleMin={idleMin} />
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900">{day.toDateString()}</h2>
          <div className="flex items-center gap-2 text-sm">
            <a href={`/hr/login-hours?date=${prev}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-100">← {prev}</a>
            {!isToday && <a href={`/hr/login-hours?date=${next}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-100">{next} →</a>}
            {canManage && (
              <form action={recomputeAttendanceAction}>
                <input type="hidden" name="date" value={dayStr} />
                <button className="rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">Recompute</button>
              </form>
            )}
          </div>
        </div>

        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-2">Member</th>
              <th>Department</th>
              <th>Punch in/out</th>
              <th>Productive</th>
              <th>Credit</th>
              <th>Attendance</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const effective = r.productiveMinutes + r.creditMinutes
              const shortHours = Math.max(0, (minMin - effective) / 60)
              const isShort = r.status !== 'present'
              return (
                <tr key={r.employeeId}>
                  <td className="py-2 font-medium text-slate-900">{r.name}</td>
                  <td className="text-slate-600">{r.department ?? '—'}</td>
                  <td className="text-xs text-slate-500">
                    {r.inAt ? r.inAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    {r.outAt ? ` – ${r.outAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                  </td>
                  <td className="text-slate-700">{fmtH(r.productiveMinutes)}</td>
                  <td className="text-slate-500">{r.creditMinutes ? fmtH(r.creditMinutes) : '—'}</td>
                  <td>
                    {r.status ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[r.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">no activity</span>
                    )}
                  </td>
                  <td className="text-right">
                    {r.pendingCredit ? (
                      canApprove ? (
                        <span className="flex items-center justify-end gap-1">
                          <span className="text-xs text-amber-600">+{fmtH(r.pendingCredit.minutes)}?</span>
                          <form action={decideAttendanceCreditAction} className="inline">
                            <input type="hidden" name="id" value={r.pendingCredit.id} />
                            <input type="hidden" name="decision" value="approve" />
                            <button className="rounded bg-green-600 px-2 py-0.5 text-xs font-semibold text-white">Approve</button>
                          </form>
                          <form action={decideAttendanceCreditAction} className="inline">
                            <input type="hidden" name="id" value={r.pendingCredit.id} />
                            <input type="hidden" name="decision" value="reject" />
                            <button className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600">Reject</button>
                          </form>
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600">credit pending approval</span>
                      )
                    ) : (
                      canManage && isShort && r.status && (
                        <CreditRequestForm employeeId={r.employeeId} date={dayStr} shortHours={shortHours} />
                      )
                    )}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-slate-400">No employees.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
