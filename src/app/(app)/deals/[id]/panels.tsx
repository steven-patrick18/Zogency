'use client'

import { useActionState } from 'react'
import {
  addDiscoveryNoteAction,
  addSowAction,
  createVersionAction,
  decideApprovalAction,
  markLostAction,
  recordContractAction,
  removeSowAction,
  sendForSignatureAction,
  sendProposalAction,
  verbalCommitAction,
  type DealActionState,
} from '@/modules/deals/actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'
const primaryBtn =
  'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50'

function Feedback({ state }: { state: DealActionState }) {
  if (state.error) return <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>
  if (state.success) return <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">{state.success}</p>
  return null
}

export function DealStageActions({ dealId, stage }: { dealId: string; stage: string }) {
  const [commitState, commitAction, commitPending] = useActionState<DealActionState, FormData>(verbalCommitAction, {})
  const [lostState, lostAction, lostPending] = useActionState<DealActionState, FormData>(markLostAction, {})

  if (stage === 'won' || stage === 'lost') return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
      {stage === 'open' && (
        <form action={commitAction}>
          <input type="hidden" name="dealId" value={dealId} />
          <button disabled={commitPending} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-50">
            Record verbal commitment
          </button>
        </form>
      )}
      <form action={lostAction} className="flex items-center gap-2">
        <input type="hidden" name="dealId" value={dealId} />
        <input name="reason" placeholder="Lost reason (required)" className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <button disabled={lostPending} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
          Mark lost
        </button>
      </form>
      <Feedback state={commitState.error || commitState.success ? commitState : lostState} />
    </div>
  )
}

type Note = {
  id: string
  businessChallenges: string
  requirements: string
  budgetNotes: string | null
  decisionTimeline: string | null
  author: string
  at: string
}

export function DiscoveryPanel({ dealId, notes, readOnly }: { dealId: string; notes: Note[]; readOnly: boolean }) {
  const [state, formAction, pending] = useActionState<DealActionState, FormData>(addDiscoveryNoteAction, {})

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Discovery notes</h2>
      <p className="mt-0.5 text-xs text-slate-400">Append-only (FR-2.11) — SOP-SLS-01 step 6.</p>
      {!readOnly && (
        <form action={formAction} className="mt-3 space-y-2">
          <input type="hidden" name="dealId" value={dealId} />
          <textarea name="businessChallenges" rows={2} required placeholder="Business challenges *" className={field} />
          <textarea name="requirements" rows={2} required placeholder="Requirements *" className={field} />
          <div className="grid grid-cols-2 gap-2">
            <input name="budgetNotes" placeholder="Budget notes" className={field} />
            <input name="decisionTimeline" placeholder="Decision timeline" className={field} />
          </div>
          <Feedback state={state} />
          <button disabled={pending} className={primaryBtn}>{pending ? 'Adding…' : 'Add note'}</button>
        </form>
      )}
      <ul className="mt-4 space-y-3">
        {notes.map((n) => (
          <li key={n.id} className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="text-slate-800"><span className="font-medium">Challenges:</span> {n.businessChallenges}</p>
            <p className="text-slate-800"><span className="font-medium">Requirements:</span> {n.requirements}</p>
            {n.budgetNotes && <p className="text-slate-600"><span className="font-medium">Budget:</span> {n.budgetNotes}</p>}
            {n.decisionTimeline && <p className="text-slate-600"><span className="font-medium">Timeline:</span> {n.decisionTimeline}</p>}
            <p className="mt-1 text-xs text-slate-400">{n.at} · {n.author}</p>
          </li>
        ))}
        {notes.length === 0 && <p className="text-sm text-slate-400">No discovery notes yet.</p>}
      </ul>
    </div>
  )
}

type Version = { versionNo: number; amount: number; listAmount: number | null; changeNote: string; sentAt: string | null }

export function ProposalPanel({
  dealId,
  templates,
  versions,
  proposalStatus,
  readOnly,
}: {
  dealId: string
  templates: Array<{ id: string; name: string }>
  versions: Version[]
  proposalStatus: string | null
  readOnly: boolean
}) {
  const [state, formAction, pending] = useActionState<DealActionState, FormData>(createVersionAction, {})
  const [sendState, sendAction, sendPending] = useActionState<DealActionState, FormData>(sendProposalAction, {})

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Proposal</h2>
        {proposalStatus && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{proposalStatus}</span>
        )}
      </div>
      {!readOnly && (
        <form action={formAction} className="mt-3 space-y-2">
          <input type="hidden" name="dealId" value={dealId} />
          <select name="templateId" className={field} defaultValue="">
            <option value="">Template (optional)…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input name="listAmount" type="number" step="0.01" placeholder="List price ₹ (for discount check)" className={field} />
            <input name="amount" type="number" step="0.01" required placeholder="Proposed price ₹ *" className={field} />
          </div>
          <input name="changeNote" required placeholder="What changed / version note *" className={field} />
          <Feedback state={state} />
          <div className="flex gap-2">
            <button disabled={pending} className={primaryBtn}>{pending ? 'Saving…' : 'Save new version'}</button>
          </div>
        </form>
      )}
      {versions.length > 0 && !readOnly && (
        <form action={sendAction} className="mt-2">
          <input type="hidden" name="dealId" value={dealId} />
          <Feedback state={sendState} />
          <button disabled={sendPending} className="mt-1 rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">
            {sendPending ? 'Sending…' : `Mark v${versions[0]?.versionNo} sent to client`}
          </button>
        </form>
      )}
      <table className="mt-4 w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
          <tr><th className="py-1">v</th><th>Amount</th><th>List</th><th>Note</th><th>Sent</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {versions.map((v) => (
            <tr key={v.versionNo}>
              <td className="py-1.5 font-medium text-slate-900">v{v.versionNo}</td>
              <td>₹{v.amount.toLocaleString('en-IN')}</td>
              <td className="text-slate-500">{v.listAmount ? `₹${v.listAmount.toLocaleString('en-IN')}` : '—'}</td>
              <td className="max-w-40 truncate text-slate-600" title={v.changeNote}>{v.changeNote}</td>
              <td className="text-xs text-slate-500">{v.sentAt ?? 'draft'}</td>
            </tr>
          ))}
          {versions.length === 0 && (
            <tr><td colSpan={5} className="py-3 text-center text-slate-400">No versions yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

type Approval = { id: string; summary: string; state: string; requestedBy: string; decisionNote: string | null; at: string }

export function ApprovalsPanel({ dealId, approvals, canApprove }: { dealId: string; approvals: Approval[]; canApprove: boolean }) {
  const [state, formAction, pending] = useActionState<DealActionState, FormData>(decideApprovalAction, {})
  if (approvals.length === 0) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Discount approvals</h2>
      <Feedback state={state} />
      <ul className="mt-3 space-y-3">
        {approvals.map((a) => (
          <li key={a.id} className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="text-slate-800">{a.summary}</p>
            <p className="mt-1 text-xs text-slate-400">{a.at} · requested by {a.requestedBy}</p>
            {a.state === 'pending' && canApprove ? (
              <form action={formAction} className="mt-2 flex items-center gap-2">
                <input type="hidden" name="approvalId" value={a.id} />
                <input type="hidden" name="dealId" value={dealId} />
                <input name="note" placeholder="Decision note" className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs" />
                <button name="decision" value="approved" disabled={pending} className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-500">
                  Approve
                </button>
                <button name="decision" value="rejected" disabled={pending} className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500">
                  Reject
                </button>
              </form>
            ) : (
              <p className={`mt-1 text-xs font-semibold ${a.state === 'approved' ? 'text-green-600' : a.state === 'rejected' ? 'text-red-600' : 'text-amber-600'}`}>
                {a.state}{a.decisionNote ? ` — ${a.decisionNote}` : ''}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

type Sow = { id: string; serviceName: string; description: string; quantity: number; frequency: string; deadline: string | null; status: string }

export function SowPanel({ dealId, deliverables, readOnly }: { dealId: string; deliverables: Sow[]; readOnly: boolean }) {
  const [state, formAction, pending] = useActionState<DealActionState, FormData>(addSowAction, {})

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Scope of Work</h2>
      <p className="mt-0.5 text-xs text-slate-400">
        Every deliverable as a trackable line item (FR-5.3) — <span className="font-medium text-amber-600">required before Won</span>.
      </p>
      {!readOnly && (
        <form action={formAction} className="mt-3 space-y-2">
          <input type="hidden" name="dealId" value={dealId} />
          <div className="grid grid-cols-2 gap-2">
            <input name="serviceName" required placeholder="Service (e.g. Web Development) *" className={field} />
            <input name="description" required placeholder="Deliverable description *" className={field} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input name="quantity" type="number" min="1" defaultValue={1} className={field} title="Quantity" />
            <select name="frequency" defaultValue="one_time" className={field}>
              <option value="one_time">One-time</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
            <input name="deadline" type="date" className={field} />
          </div>
          <Feedback state={state} />
          <button disabled={pending} className={primaryBtn}>{pending ? 'Adding…' : 'Add deliverable'}</button>
        </form>
      )}
      <ul className="mt-4 space-y-2">
        {deliverables.map((d) => (
          <li key={d.id} className="flex items-start justify-between rounded-lg bg-slate-50 p-3 text-sm">
            <div>
              <p className="font-medium text-slate-900">{d.serviceName} <span className="font-normal text-slate-500">×{d.quantity} · {d.frequency.replace('_', '-')}</span></p>
              <p className="text-slate-600">{d.description}</p>
              <p className="text-xs text-slate-400">{d.deadline ? `Due ${d.deadline}` : 'No deadline'} · {d.status}</p>
            </div>
            {!readOnly && (
              <form action={removeSowAction}>
                <input type="hidden" name="dealId" value={dealId} />
                <input type="hidden" name="deliverableId" value={d.id} />
                <button className="text-xs text-red-500 hover:underline">Remove</button>
              </form>
            )}
          </li>
        ))}
        {deliverables.length === 0 && <p className="text-sm text-slate-400">No deliverables yet — Won is blocked.</p>}
      </ul>
    </div>
  )
}

export function ContractPanel({
  dealId,
  contract,
  stage,
  esignEnabled,
}: {
  dealId: string
  contract: { status: string; signedAt: string | null; evidenceNote: string | null } | null
  stage: string
  esignEnabled: boolean
}) {
  const [state, formAction, pending] = useActionState<DealActionState, FormData>(recordContractAction, {})
  const [signState, signAction, signing] = useActionState<DealActionState, FormData>(sendForSignatureAction, {})

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Contract & closing</h2>
        <span className="text-[11px] text-slate-400">
          {esignEnabled ? 'Zoho Sign connected' : 'logged-approval fallback'}
        </span>
      </div>
      {contract?.status === 'signed' ? (
        <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          <p className="font-semibold">Signed {contract.signedAt}</p>
          {contract.evidenceNote && <p className="mt-1">{contract.evidenceNote}</p>}
        </div>
      ) : stage === 'lost' ? (
        <p className="mt-3 text-sm text-slate-400">Deal is lost.</p>
      ) : (
        <>
          {/* E-signature (Zoho Sign) — the preferred path when connected. */}
          {esignEnabled && (
            <form action={signAction} className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
              <input type="hidden" name="dealId" value={dealId} />
              {contract?.status === 'sent' ? (
                <p className="text-sm text-indigo-800">Sent for e-signature — awaiting the client. Zoho will notify us on signing.</p>
              ) : (
                <p className="text-sm text-slate-600">Send the contract to the client to sign electronically.</p>
              )}
              <Feedback state={signState} />
              <button disabled={signing} className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                {signing ? 'Sending…' : contract?.status === 'sent' ? 'Resend for e-signature' : 'Send for e-signature (Zoho Sign)'}
              </button>
            </form>
          )}

          {/* Logged signature — manual evidence, always available as a fallback. */}
          <form action={formAction} className="mt-3 space-y-2">
            <input type="hidden" name="dealId" value={dealId} />
            <p className="text-xs font-medium text-slate-500">Or record a manually-executed signature:</p>
            <textarea
              name="evidenceNote"
              rows={2}
              required
              placeholder="How was the contract executed? (e-sign envelope ref, or written-approval evidence) *"
              className={field}
            />
            <input name="finalValue" type="number" step="0.01" placeholder="Final deal value ₹ (defaults to sent proposal)" className={field} />
            <Feedback state={state} />
            <button disabled={pending} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50">
              {pending ? 'Recording…' : 'Record signed contract → Close Won'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
