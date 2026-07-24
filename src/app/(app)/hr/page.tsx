import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import {
  AddCandidateForm,
  CandidateCard,
  RequisitionForm,
  type CandidateView,
} from './recruitment-panels'

const STAGES = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'] as const

const REQ_STATUS_STYLES: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  on_hold: 'bg-amber-100 text-amber-700',
  filled: 'bg-indigo-100 text-indigo-700',
  cancelled: 'bg-slate-200 text-slate-600',
}

export default async function RecruitmentPage() {
  const session = await requirePermission('hr.view')
  const canManage = session.user.permissions.includes('hr.manage')
  const canSeeSalaries = session.user.permissions.includes('hr.view_salaries')

  const [requisitions, candidates, departments, users] = await withTenant(() =>
    Promise.all([
      prisma.jobRequisition.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { candidates: true } } },
      }),
      prisma.candidate.findMany({
        orderBy: { createdAt: 'asc' },
        include: {
          requisition: { select: { roleTitle: true } },
          interviews: { orderBy: { createdAt: 'asc' } },
          offer: true,
          stageHistory: { orderBy: { at: 'desc' }, take: 1 },
        },
      }),
      prisma.department.findMany({ orderBy: { sort: 'asc' } }),
      prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]),
  )
  const departmentName = new Map(departments.map((d) => [d.id, d.name]))
  const userName = new Map(users.map((u) => [u.id, u.name]))

  const views: CandidateView[] = candidates.map((c) => ({
    id: c.id,
    name: c.name,
    role: c.requisition.roleTitle,
    noticePeriod: c.noticePeriod,
    expectedCtc: c.expectedCtc,
    stage: c.currentStage,
    rejectionReason: c.rejectionReason,
    lastMovedAt: c.stageHistory[0] ? c.stageHistory[0].at.toLocaleDateString() : null,
    interviews: c.interviews.map((i) => ({
      id: i.id,
      round: i.round,
      interviewer: userName.get(i.interviewerId) ?? '—',
      feedback: i.feedback,
      recommendation: i.recommendation,
      at: i.createdAt.toLocaleDateString(),
    })),
    offer: c.offer
      ? {
          status: c.offer.status,
          // Compensation is visible only with hr.view_salaries.
          compensation: canSeeSalaries ? c.offer.compensation : null,
          joiningOn: c.offer.joiningOn ? c.offer.joiningOn.toISOString().slice(0, 10) : null,
        }
      : null,
  }))

  const deptOptions = departments.map((d) => ({ id: d.id, name: d.name }))
  const openRequisitions = requisitions
    .filter((r) => r.status === 'open')
    .map((r) => ({ id: r.id, name: `${r.roleTitle} — ${departmentName.get(r.departmentId) ?? '?'}` }))

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="grid grid-cols-2 gap-6">
          <RequisitionForm departments={deptOptions} />
          <AddCandidateForm requisitions={openRequisitions} />
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Headcount</th>
              <th className="px-4 py-3">Budget</th>
              <th className="px-4 py-3">Candidates</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requisitions.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{r.roleTitle}</td>
                <td className="px-4 py-3 text-slate-600">{departmentName.get(r.departmentId) ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{r.headcount}</td>
                <td className="px-4 py-3 text-slate-600">{r.budgetRange ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{r._count.candidates}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${REQ_STATUS_STYLES[r.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {r.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
            {requisitions.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No requisitions yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="font-semibold text-slate-900">Candidate pipeline</h2>
        <p className="mt-0.5 text-xs text-slate-400">Stage machine with append-only history (FR-4.2).</p>
        <div className="mt-3 overflow-x-auto pb-2">
          <div className="grid min-w-[1300px] grid-cols-6 gap-3">
            {STAGES.map((stage) => {
              const inStage = views.filter((v) => v.stage === stage)
              return (
                <div key={stage} className="rounded-xl bg-slate-50 p-2">
                  <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {stage} <span className="font-normal text-slate-400">({inStage.length})</span>
                  </p>
                  <div className="space-y-2">
                    {inStage.map((c) => (
                      <CandidateCard
                        key={c.id}
                        candidate={c}
                        departments={deptOptions}
                        users={users}
                        canManage={canManage}
                        canSeeSalaries={canSeeSalaries}
                      />
                    ))}
                    {inStage.length === 0 && <p className="px-1 text-xs text-slate-400">Empty</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
