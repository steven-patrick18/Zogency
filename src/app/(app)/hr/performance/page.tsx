import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { CycleForm, ReviewForm } from './performance-panels'

export default async function PerformancePage() {
  const session = await requirePermission('hr.view')
  const canManage = session.user.permissions.includes('hr.manage')

  const [cycles, employees, users, reviews] = await withTenant(() =>
    Promise.all([
      prisma.performanceCycle.findMany({ orderBy: { periodStart: 'desc' } }),
      prisma.employee.findMany({ where: { status: { not: 'exited' } }, orderBy: { joinedOn: 'asc' } }),
      prisma.user.findMany({ select: { id: true, name: true } }),
      prisma.performanceReview.findMany(),
    ]),
  )
  const userName = new Map(users.map((u) => [u.id, u.name]))
  const reviewFor = (cycleId: string, employeeId: string) =>
    reviews.find((r) => r.cycleId === cycleId && r.employeeId === employeeId) ?? null

  return (
    <div className="space-y-6">
      {canManage && <CycleForm />}

      {cycles.map((cycle) => (
        <div key={cycle.id} className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">{cycle.name}</h2>
              <p className="text-xs text-slate-400">
                {cycle.periodStart.toISOString().slice(0, 10)} → {cycle.periodEnd.toISOString().slice(0, 10)}
              </p>
            </div>
            <span
              className={
                cycle.status === 'open'
                  ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700'
                  : 'rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600'
              }
            >
              {cycle.status}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {employees.map((e) => {
              const review = reviewFor(cycle.id, e.id)
              const name = userName.get(e.userId) ?? '—'
              if (cycle.status === 'open' && canManage) {
                return (
                  <ReviewForm
                    key={e.id}
                    cycleId={cycle.id}
                    employeeId={e.id}
                    employeeName={name}
                    review={
                      review
                        ? {
                            selfAssessment: review.selfAssessment,
                            managerReview: review.managerReview,
                            finalRating: review.finalRating,
                          }
                        : null
                    }
                  />
                )
              }
              return (
                <div key={e.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-900">{name}</p>
                    <span className="text-xs font-semibold text-indigo-700">
                      {review?.finalRating ? `Rating ${review.finalRating}/5` : 'Not rated'}
                    </span>
                  </div>
                  {review?.selfAssessment && (
                    <p className="mt-1 text-slate-600"><span className="font-medium">Self:</span> {review.selfAssessment}</p>
                  )}
                  {review?.managerReview && (
                    <p className="mt-1 text-slate-600"><span className="font-medium">Manager:</span> {review.managerReview}</p>
                  )}
                  {!review && <p className="mt-1 text-slate-400">No review recorded.</p>}
                </div>
              )
            })}
            {employees.length === 0 && (
              <p className="text-sm text-slate-400">No active employees to review.</p>
            )}
          </div>
        </div>
      ))}
      {cycles.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-400">
          No review cycles yet{canManage ? ' — create one above.' : '.'}
        </p>
      )}
    </div>
  )
}
