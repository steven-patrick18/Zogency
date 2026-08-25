import Link from 'next/link'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { visibleRoles } from '@/lib/roles'
import { ExitPanel } from './employee-panels'
import { AddEmployeeForm } from './add-employee-form'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  notice: 'bg-amber-100 text-amber-700',
  exited: 'bg-slate-200 text-slate-600',
}

export default async function EmployeesPage() {
  const session = await requirePermission('hr.view')
  const canManage = session.user.permissions.includes('hr.manage')
  const canVendor = session.user.permissions.includes('vendor.manage')

  const [employees, users, departments, roles] = await withTenant(() =>
    Promise.all([
      prisma.employee.findMany({
        orderBy: { joinedOn: 'asc' },
        include: { onboardingItems: true, exit: true },
      }),
      prisma.user.findMany({ where: { status: 'active' }, select: { id: true, name: true } }),
      prisma.department.findMany({ orderBy: { sort: 'asc' } }),
      prisma.role.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    ]),
  )
  const userName = new Map(users.map((u) => [u.id, u.name]))
  const departmentName = new Map(departments.map((d) => [d.id, d.name]))
  const assignableRoles = visibleRoles(roles, canVendor)

  return (
    <div>
      {canManage && (
        <AddEmployeeForm
          departments={departments.map((d) => ({ id: d.id, name: d.name }))}
          managers={users.map((u) => ({ id: u.id, name: u.name }))}
          roles={assignableRoles.map((r) => ({ id: r.id, name: r.name }))}
        />
      )}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Designation</th>
            <th className="px-4 py-3">Department</th>
            <th className="px-4 py-3">Manager</th>
            <th className="px-4 py-3">Joined</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Onboarding</th>
            <th className="px-4 py-3">Exit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {employees.map((e) => {
            const done = e.onboardingItems.filter((i) => i.doneAt).length
            return (
              <tr key={e.id} className="align-top">
                <td className="px-4 py-3 font-medium text-slate-900">
                  <Link href={`/hr/employees/${e.id}`} className="hover:text-indigo-600 hover:underline">
                    {userName.get(e.userId) ?? '—'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{e.designation}</td>
                <td className="px-4 py-3 text-slate-600">
                  {e.departmentId ? (departmentName.get(e.departmentId) ?? '—') : '—'}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {e.managerId ? (userName.get(e.managerId) ?? '—') : '—'}
                </td>
                <td className="px-4 py-3 text-slate-600">{e.joinedOn.toISOString().slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[e.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {e.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {e.onboardingItems.length > 0 ? `${done}/${e.onboardingItems.length}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <ExitPanel
                    employeeId={e.id}
                    employeeName={userName.get(e.userId) ?? '—'}
                    canManage={canManage}
                    exit={
                      e.exit
                        ? {
                            type: e.exit.type,
                            noticeStartOn: e.exit.noticeStartOn.toISOString().slice(0, 10),
                            lastDayOn: e.exit.lastDayOn.toISOString().slice(0, 10),
                            notes: e.exit.exitInterviewNotes,
                            completed: !!e.exit.accessRevokedAt,
                          }
                        : null
                    }
                  />
                </td>
              </tr>
            )
          })}
          {employees.length === 0 && (
            <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">No employees yet — use “Add employee” above, or hire from Recruitment.</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  )
}
