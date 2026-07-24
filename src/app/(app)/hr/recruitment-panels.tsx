'use client'

import { useActionState } from 'react'
import {
  addCandidateAction,
  addInterviewFeedbackAction,
  createRequisitionAction,
  hireCandidateAction,
  makeOfferAction,
  moveCandidateAction,
  offerStatusAction,
  type HrActionState,
} from '@/modules/hr/actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'
const primaryBtn =
  'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50'

function Feedback({ state }: { state: HrActionState }) {
  if (state.error) return <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>
  if (state.success) return <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">{state.success}</p>
  return null
}

export type Option = { id: string; name: string }

export function RequisitionForm({ departments }: { departments: Option[] }) {
  const [state, formAction, pending] = useActionState<HrActionState, FormData>(createRequisitionAction, {})
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Raise a requisition</h2>
      <p className="mt-0.5 text-xs text-slate-400">Role, headcount, budget and justification (FR-4.1).</p>
      <form action={formAction} className="mt-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <select name="departmentId" required className={field} defaultValue="">
            <option value="" disabled>Department *</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <input name="roleTitle" required placeholder="Role title *" className={field} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input name="headcount" type="number" min="1" defaultValue={1} className={field} title="Headcount" />
          <input name="budgetRange" placeholder="Budget range (optional)" className={field} />
        </div>
        <textarea name="justification" rows={2} required placeholder="Justification *" className={field} />
        <Feedback state={state} />
        <button disabled={pending} className={primaryBtn}>{pending ? 'Raising…' : 'Raise requisition'}</button>
      </form>
    </div>
  )
}

export function AddCandidateForm({ requisitions }: { requisitions: Option[] }) {
  const [state, formAction, pending] = useActionState<HrActionState, FormData>(addCandidateAction, {})
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Add candidate</h2>
      <p className="mt-0.5 text-xs text-slate-400">Enters the pipeline at the applied stage (FR-4.2).</p>
      <form action={formAction} className="mt-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <select name="requisitionId" required className={field} defaultValue="">
            <option value="" disabled>Requisition *</option>
            {requisitions.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <input name="name" required placeholder="Candidate name *" className={field} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input name="email" type="email" placeholder="Email (needed to hire)" className={field} />
          <input name="phone" placeholder="Phone" className={field} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input name="noticePeriod" placeholder="Notice period" className={field} />
          <input name="expectedCtc" placeholder="Expected CTC" className={field} />
        </div>
        <Feedback state={state} />
        <button disabled={pending} className={primaryBtn}>{pending ? 'Adding…' : 'Add candidate'}</button>
      </form>
    </div>
  )
}

export type CandidateView = {
  id: string
  name: string
  role: string
  noticePeriod: string | null
  expectedCtc: string | null
  stage: string
  rejectionReason: string | null
  lastMovedAt: string | null
  interviews: Array<{
    id: string
    round: string
    interviewer: string
    feedback: string | null
    recommendation: string | null
    at: string
  }>
  offer: { status: string; compensation: string | null; joiningOn: string | null } | null
}

const NEXT_STAGE: Record<string, string> = { applied: 'screening', screening: 'interview', interview: 'offer' }

export function CandidateCard({
  candidate,
  departments,
  users,
  canManage,
  canSeeSalaries,
}: {
  candidate: CandidateView
  departments: Option[]
  users: Option[]
  canManage: boolean
  canSeeSalaries: boolean
}) {
  const [moveState, moveAction, movePending] = useActionState<HrActionState, FormData>(moveCandidateAction, {})
  const [rejectState, rejectAction, rejectPending] = useActionState<HrActionState, FormData>(moveCandidateAction, {})
  const [feedbackState, feedbackAction, feedbackPending] = useActionState<HrActionState, FormData>(addInterviewFeedbackAction, {})
  const [offerState, offerAction, offerPending] = useActionState<HrActionState, FormData>(makeOfferAction, {})
  const [statusState, statusAction, statusPending] = useActionState<HrActionState, FormData>(offerStatusAction, {})
  const [hireState, hireAction, hirePending] = useActionState<HrActionState, FormData>(hireCandidateAction, {})

  const next = NEXT_STAGE[candidate.stage]
  const terminal = candidate.stage === 'hired' || candidate.stage === 'rejected'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
      <p className="font-semibold text-slate-900">{candidate.name}</p>
      <p className="text-xs text-slate-500">{candidate.role}</p>
      <p className="mt-0.5 text-xs text-slate-400">
        {candidate.noticePeriod ? `Notice: ${candidate.noticePeriod}` : 'No notice info'}
        {candidate.expectedCtc ? ` · CTC: ${candidate.expectedCtc}` : ''}
      </p>
      {candidate.lastMovedAt && <p className="text-[11px] text-slate-400">In stage since {candidate.lastMovedAt}</p>}
      {candidate.stage === 'rejected' && candidate.rejectionReason && (
        <p className="mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700">Reason: {candidate.rejectionReason}</p>
      )}

      {candidate.interviews.length > 0 && (
        <ul className="mt-2 space-y-1">
          {candidate.interviews.map((i) => (
            <li key={i.id} className="rounded bg-slate-50 px-2 py-1 text-xs">
              <span className="font-medium text-slate-700">{i.round}</span>
              {i.recommendation && (
                <span className={i.recommendation === 'hire' ? 'ml-1 font-semibold text-green-600' : 'ml-1 font-semibold text-red-600'}>
                  {i.recommendation.replace('_', ' ')}
                </span>
              )}
              {i.feedback && <p className="text-slate-600">{i.feedback}</p>}
              <p className="text-slate-400">{i.at} · {i.interviewer}</p>
            </li>
          ))}
        </ul>
      )}

      {candidate.offer && (
        <div className="mt-2 rounded bg-indigo-50 px-2 py-1 text-xs text-indigo-900">
          <p>
            Offer <span className="font-semibold">{candidate.offer.status}</span>
            {candidate.offer.joiningOn ? ` · joining ${candidate.offer.joiningOn}` : ''}
          </p>
          {candidate.offer.compensation && <p>Compensation: {candidate.offer.compensation}</p>}
        </div>
      )}

      {canManage && !terminal && (
        <div className="mt-2 space-y-2">
          {next && (
            <form action={moveAction}>
              <input type="hidden" name="candidateId" value={candidate.id} />
              <input type="hidden" name="to" value={next} />
              <Feedback state={moveState} />
              <button disabled={movePending} className="w-full rounded-lg border border-indigo-300 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">
                {movePending ? 'Moving…' : `Move to ${next}`}
              </button>
            </form>
          )}

          {candidate.stage === 'interview' && (
            <form action={feedbackAction} className="space-y-1 rounded-lg bg-slate-50 p-2">
              <input type="hidden" name="candidateId" value={candidate.id} />
              <select name="round" className={field} defaultValue="technical">
                <option value="technical">Technical round</option>
                <option value="hr">HR round</option>
                <option value="assessment">Assessment</option>
              </select>
              <textarea name="feedback" rows={2} required placeholder="Interview feedback *" className={field} />
              <select name="recommendation" className={field} defaultValue="hire">
                <option value="hire">Recommend: hire</option>
                <option value="no_hire">Recommend: no hire</option>
              </select>
              <Feedback state={feedbackState} />
              <button disabled={feedbackPending} className="w-full rounded-lg bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                {feedbackPending ? 'Saving…' : 'Record feedback'}
              </button>
            </form>
          )}

          {candidate.stage === 'offer' && canSeeSalaries && candidate.offer?.status !== 'accepted' && (
            <form action={offerAction} className="space-y-1 rounded-lg bg-slate-50 p-2">
              <input type="hidden" name="candidateId" value={candidate.id} />
              <input name="compensation" required placeholder="Compensation *" className={field} />
              <input name="joiningOn" type="date" className={field} title="Joining date" />
              <Feedback state={offerState} />
              <button disabled={offerPending} className="w-full rounded-lg bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                {offerPending ? 'Sending…' : candidate.offer ? 'Re-send offer' : 'Send offer'}
              </button>
            </form>
          )}

          {candidate.stage === 'offer' && candidate.offer?.status === 'sent' && (
            <form action={statusAction} className="flex gap-2">
              <input type="hidden" name="candidateId" value={candidate.id} />
              <button name="status" value="accepted" disabled={statusPending} className="flex-1 rounded bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-50">
                Offer accepted
              </button>
              <button name="status" value="declined" disabled={statusPending} className="flex-1 rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50">
                Declined
              </button>
            </form>
          )}
          {candidate.stage === 'offer' && <Feedback state={statusState} />}

          {candidate.stage === 'offer' && candidate.offer?.status === 'accepted' && (
            <form action={hireAction} className="space-y-1 rounded-lg bg-green-50 p-2">
              <p className="text-xs font-semibold text-green-800">Hire — Day-1 auto-link (FR-4.6)</p>
              <input type="hidden" name="candidateId" value={candidate.id} />
              <select name="departmentId" required className={field} defaultValue="">
                <option value="" disabled>Department *</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <select name="managerId" required className={field} defaultValue="">
                <option value="" disabled>Reporting manager *</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <input name="designation" required placeholder="Designation *" className={field} />
              <input name="tempPassword" type="password" required minLength={8} placeholder="Temp password (min 8) *" className={field} />
              <Feedback state={hireState} />
              <button disabled={hirePending} className="w-full rounded-lg bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-50">
                {hirePending ? 'Hiring…' : 'Hire candidate'}
              </button>
            </form>
          )}

          <form action={rejectAction} className="flex items-center gap-1">
            <input type="hidden" name="candidateId" value={candidate.id} />
            <input type="hidden" name="to" value="rejected" />
            <input name="rejectionReason" placeholder="Rejection reason" className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs" />
            <button disabled={rejectPending} className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
              Reject
            </button>
          </form>
          <Feedback state={rejectState} />
        </div>
      )}
    </div>
  )
}
