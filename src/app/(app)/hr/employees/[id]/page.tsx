import { notFound } from 'next/navigation'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { AgentTokenPanel, DocumentsPanel, JobDetailsForm } from './profile-panels'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  notice: 'bg-amber-100 text-amber-700',
  exited: 'bg-slate-200 text-slate-600',
}

const TYPE_STYLES: Record<string, string> = {
  permanent: 'bg-indigo-100 text-indigo-700',
  contract: 'bg-blue-100 text-blue-700',
  intern: 'bg-purple-100 text-purple-700',
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('hr.view')
  const canManage = session.user.permissions.includes('hr.manage')
  const { id } = await params
  const year = new Date().getFullYear()

  const data = await withTenant(async () => {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        onboardingItems: true,
        documents: { orderBy: { createdAt: 'desc' } },
        exit: true,
        attendance: { orderBy: { date: 'desc' }, take: 14 },
        leaveBalances: { where: { year }, include: { type: true } },
        reviews: { include: { cycle: true }, orderBy: { createdAt: 'desc' } },
      },
    })
    if (!employee) return null
    const [user, departments, users] = await Promise.all([
      prisma.user.findUnique({ where: { id: employee.userId } }),
      prisma.department.findMany({ orderBy: { sort: 'asc' } }),
      prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ])
    return { employee, user, departments, users }
  })
  if (!data || !data.user) notFound()
  const { employee, user, departments, users } = data
  const departmentName = new Map(departments.map((d) => [d.id, d.name]))
  const userName = new Map(users.map((u) => [u.id, u.name]))
  const managerName = employee.managerId ? (userName.get(employee.managerId) ?? '—') : '—'

  return (
    <div className="max-w-5xl">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-4">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt={user.name} className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-lg font-semibold text-indigo-700">
              {initials(user.name)}
            </div>
          )}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{user.name}</h1>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TYPE_STYLES[employee.employmentType] ?? 'bg-slate-100 text-slate-600'}`}>
                {employee.employmentType}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[employee.status] ?? 'bg-slate-100 text-slate-600'}`}>
                {employee.status}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              {employee.designation} ·{' '}
              {employee.departmentId ? (departmentName.get(employee.departmentId) ?? '—') : 'No department'} ·
              reports to {managerName}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {user.email}
              {user.phone ? ` · ${user.phone}` : ''} · joined {employee.joinedOn.toDateString()}
              {employee.probationEndsOn ? ` · probation ends ${employee.probationEndsOn.toDateString()}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* LEFT */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Job details</h2>
            {canManage ? (
              <JobDetailsForm
                employeeId={employee.id}
                designation={employee.designation}
                departmentId={employee.departmentId}
                managerId={employee.managerId}
                employmentType={employee.employmentType}
                departments={departments.map((d) => ({ id: d.id, name: d.name }))}
                users={users}
              />
            ) : (
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-slate-400">Designation</dt>
                <dd className="text-slate-700">{employee.designation}</dd>
                <dt className="text-slate-400">Department</dt>
                <dd className="text-slate-700">
                  {employee.departmentId ? (departmentName.get(employee.departmentId) ?? '—') : '—'}
                </dd>
                <dt className="text-slate-400">Manager</dt>
                <dd className="text-slate-700">{managerName}</dd>
                <dt className="text-slate-400">Employment type</dt>
                <dd className="text-slate-700">{employee.employmentType}</dd>
              </dl>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Onboarding checklist</h2>
            <p className="text-xs text-slate-400">(managed at hire)</p>
            {employee.onboardingItems.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No onboarding items.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {employee.onboardingItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.doneAt ? 'bg-green-500' : 'bg-slate-300'}`} />
                    <span className={item.doneAt ? 'text-slate-500 line-through' : 'text-slate-700'}>
                      {item.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Documents</h2>
            <DocumentsPanel
              employeeId={employee.id}
              canManage={canManage}
              docs={employee.documents.map((doc) => ({
                id: doc.id,
                title: doc.title,
                size: doc.size,
                createdAt: doc.createdAt.toDateString(),
                dataUri: doc.dataUri,
              }))}
            />
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          {canManage && <AgentTokenPanel userId={user.id} hasToken={!!user.agentToken} />}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Leave balances ({year})</h2>
            {employee.leaveBalances.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No leave balances for this year.</p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-1.5">Type</th>
                    <th className="py-1.5">Used</th>
                    <th className="py-1.5">Available</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employee.leaveBalances.map((b) => (
                    <tr key={b.id}>
                      <td className="py-1.5 text-slate-700">{b.type.name}</td>
                      <td className="py-1.5 text-slate-600">{b.used}</td>
                      <td className="py-1.5 text-slate-600">{b.available}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Recent attendance</h2>
            {employee.attendance.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No attendance records yet.</p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-1.5">Date</th>
                    <th className="py-1.5">In</th>
                    <th className="py-1.5">Out</th>
                    <th className="py-1.5">Mode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employee.attendance.map((a) => (
                    <tr key={a.id}>
                      <td className="py-1.5 text-slate-700">{a.date.toISOString().slice(0, 10)}</td>
                      <td className="py-1.5 text-slate-600">
                        {a.inAt ? a.inAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="py-1.5 text-slate-600">
                        {a.outAt ? a.outAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="py-1.5 text-slate-600">{a.mode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Performance</h2>
            {employee.reviews.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No reviews yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {employee.reviews.map((r) => (
                  <li key={r.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-slate-800">{r.cycle.name}</p>
                      <span className="text-xs font-medium text-slate-500">
                        {r.finalRating ? `${r.finalRating}/5` : 'unrated'}
                      </span>
                    </div>
                    {r.managerReview && (
                      <p className="mt-1 text-xs text-slate-500">
                        {r.managerReview.length > 160 ? `${r.managerReview.slice(0, 160)}…` : r.managerReview}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {employee.exit && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5">
              <h2 className="font-semibold text-slate-900">Exit</h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-slate-400">Type</dt>
                <dd className="text-slate-700">{employee.exit.type}</dd>
                <dt className="text-slate-400">Notice start</dt>
                <dd className="text-slate-700">{employee.exit.noticeStartOn.toDateString()}</dd>
                <dt className="text-slate-400">Last day</dt>
                <dd className="text-slate-700">{employee.exit.lastDayOn.toDateString()}</dd>
                <dt className="text-slate-400">Assets recovered</dt>
                <dd className="text-slate-700">{employee.exit.assetsRecovered ? 'Yes' : 'No'}</dd>
                <dt className="text-slate-400">Access revoked</dt>
                <dd className="text-slate-700">
                  {employee.exit.accessRevokedAt ? employee.exit.accessRevokedAt.toLocaleString() : 'Not yet'}
                </dd>
              </dl>
              {employee.exit.exitInterviewNotes && (
                <p className="mt-2 text-xs text-slate-500">{employee.exit.exitInterviewNotes}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
