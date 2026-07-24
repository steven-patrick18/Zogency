'use client'

import { useActionState } from 'react'
import {
  addAssetAction,
  addConceptAction,
  addKpiAction,
  addOptimizationAction,
  approveAssetAction,
  closeCampaignAction,
  compileReportAction,
  decideCampaignApprovalAction,
  logRevisionAction,
  moveCampaignAction,
  recordSignoffAction,
  recordSnapshotAction,
  requestBriefApprovalAction,
  requestBudgetApprovalAction,
  saveBriefAction,
  saveBudgetAction,
  savePlanAction,
  saveStrategyAction,
  toggleChecklistAction,
  type CampaignActionState,
} from '@/modules/campaigns/actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'
const primaryBtn =
  'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50'
const secondaryBtn =
  'rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50'

function Feedback({ state }: { state: CampaignActionState }) {
  if (state.error) return <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>
  if (state.success) return <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">{state.success}</p>
  return null
}

// ── Stage progress + move-to-next-stage (gates surface here) ────────────────

const STAGES = ['brief', 'planning', 'creative', 'approval', 'launched', 'monitoring', 'reporting', 'closed'] as const

export function StageProgress({ campaignId, status }: { campaignId: string; status: string }) {
  const [state, formAction, pending] = useActionState<CampaignActionState, FormData>(moveCampaignAction, {})
  const idx = STAGES.indexOf(status as (typeof STAGES)[number])
  const next = idx >= 0 && idx < STAGES.length - 1 ? STAGES[idx + 1] : null

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <ol className="flex flex-wrap items-center gap-1">
        {STAGES.map((s, i) => (
          <li key={s} className="flex items-center gap-1">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                i === idx
                  ? 'bg-indigo-600 text-white'
                  : i < idx
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {s}
            </span>
            {i < STAGES.length - 1 && <span className="text-slate-300">→</span>}
          </li>
        ))}
      </ol>
      {next && (
        <form action={formAction} className="mt-3 flex items-center gap-3">
          <input type="hidden" name="campaignId" value={campaignId} />
          <input type="hidden" name="to" value={next} />
          <button disabled={pending} className={primaryBtn}>
            {pending ? 'Moving…' : `Move to ${next}`}
          </button>
          {state.success && <p className="text-sm font-medium text-green-700">{state.success}</p>}
        </form>
      )}
      {state.error && (
        <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          Stage gate: {state.error}
        </p>
      )}
    </div>
  )
}

// ── Brief (FR-3.1–3.3) ──────────────────────────────────────────────────────

export type BriefData = {
  objectives: string
  targetAudience: string
  deliverables: string
  timeline: string
  budgetEstimate: string | null
  kickoffCallAt: string | null // datetime-local value
}

export function BriefPanel({
  campaignId,
  brief,
  briefApproval,
}: {
  campaignId: string
  brief: BriefData | null
  briefApproval: { state: string; decisionNote: string | null } | null
}) {
  const [state, formAction, pending] = useActionState<CampaignActionState, FormData>(saveBriefAction, {})
  const [reqState, reqAction, reqPending] = useActionState<CampaignActionState, FormData>(requestBriefApprovalAction, {})

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Brief</h2>
        {briefApproval && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              briefApproval.state === 'approved'
                ? 'bg-green-100 text-green-700'
                : briefApproval.state === 'rejected'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700'
            }`}
          >
            sign-off {briefApproval.state}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-slate-400">Structured intake (FR-3.1) — internal sign-off gates planning (FR-3.3).</p>
      <form action={formAction} className="mt-3 space-y-2">
        <input type="hidden" name="campaignId" value={campaignId} />
        <textarea name="objectives" rows={2} required placeholder="Objectives *" defaultValue={brief?.objectives ?? ''} className={field} />
        <textarea name="targetAudience" rows={2} required placeholder="Target audience *" defaultValue={brief?.targetAudience ?? ''} className={field} />
        <textarea name="deliverables" rows={2} required placeholder="Deliverables *" defaultValue={brief?.deliverables ?? ''} className={field} />
        <input name="timeline" required placeholder="Timeline *" defaultValue={brief?.timeline ?? ''} className={field} />
        <div className="grid grid-cols-2 gap-2">
          <input name="budgetEstimate" placeholder="Budget estimate" defaultValue={brief?.budgetEstimate ?? ''} className={field} />
          <input
            name="kickoffCallAt"
            type="datetime-local"
            defaultValue={brief?.kickoffCallAt ?? ''}
            className={field}
            title="Kickoff call (FR-3.2)"
          />
        </div>
        <Feedback state={state} />
        <button disabled={pending} className={primaryBtn}>{pending ? 'Saving…' : 'Save brief'}</button>
      </form>
      <form action={reqAction} className="mt-3 space-y-2">
        <input type="hidden" name="campaignId" value={campaignId} />
        <Feedback state={reqState} />
        <button disabled={reqPending} className={secondaryBtn}>
          {reqPending ? 'Requesting…' : 'Request internal sign-off'}
        </button>
        {briefApproval?.decisionNote && (
          <p className="text-xs text-slate-500">Decision note: {briefApproval.decisionNote}</p>
        )}
      </form>
    </div>
  )
}

// ── Approvals inbox (brief + budget requests) ───────────────────────────────

export type ApprovalItem = {
  id: string
  type: string
  summary: string
  state: string
  requestedBy: string
  decisionNote: string | null
  at: string
}

export function ApprovalsListPanel({
  campaignId,
  approvals,
  canApprove,
}: {
  campaignId: string
  approvals: ApprovalItem[]
  canApprove: boolean
}) {
  const [state, formAction, pending] = useActionState<CampaignActionState, FormData>(decideCampaignApprovalAction, {})

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Approvals</h2>
      <p className="mt-0.5 text-xs text-slate-400">Brief sign-off (FR-3.3) and budget approval (FR-3.6).</p>
      <Feedback state={state} />
      <ul className="mt-3 space-y-3">
        {approvals.map((a) => (
          <li key={a.id} className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="text-slate-800">
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-medium uppercase text-slate-600">{a.type}</span>{' '}
              {a.summary}
            </p>
            <p className="mt-1 text-xs text-slate-400">{a.at} · requested by {a.requestedBy}</p>
            {a.state === 'pending' && canApprove ? (
              <form action={formAction} className="mt-2 flex items-center gap-2">
                <input type="hidden" name="approvalId" value={a.id} />
                <input type="hidden" name="campaignId" value={campaignId} />
                <input name="note" placeholder="Decision note" className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs" />
                <button name="decision" value="approved" disabled={pending} className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-500">
                  Approve
                </button>
                <button name="decision" value="rejected" disabled={pending} className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500">
                  Reject
                </button>
              </form>
            ) : (
              <p
                className={`mt-1 text-xs font-semibold ${
                  a.state === 'approved' ? 'text-green-600' : a.state === 'rejected' ? 'text-red-600' : 'text-amber-600'
                }`}
              >
                {a.state}
                {a.decisionNote ? ` — ${a.decisionNote}` : ''}
              </p>
            )}
          </li>
        ))}
        {approvals.length === 0 && <p className="text-sm text-slate-400">No approval requests yet.</p>}
      </ul>
    </div>
  )
}

// ── Strategy, plan & budget (FR-3.4–3.6) ────────────────────────────────────

export type StrategyData = { approach: string; audienceSegments: string; keyMessages: string; channelMix: string }
export type PlanData = { timelineStart: string; timelineEnd: string; resourceAllocation: string }
export type BudgetData = { amount: number; breakdown: string }

export function StrategyPlanPanel({
  campaignId,
  strategy,
  plan,
  budget,
  budgetApprovalState,
}: {
  campaignId: string
  strategy: StrategyData | null
  plan: PlanData | null
  budget: BudgetData | null
  budgetApprovalState: string | null
}) {
  const [stratState, stratAction, stratPending] = useActionState<CampaignActionState, FormData>(saveStrategyAction, {})
  const [planState, planAction, planPending] = useActionState<CampaignActionState, FormData>(savePlanAction, {})
  const [budgetState, budgetAction, budgetPending] = useActionState<CampaignActionState, FormData>(saveBudgetAction, {})
  const [reqState, reqAction, reqPending] = useActionState<CampaignActionState, FormData>(requestBudgetApprovalAction, {})

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Strategy, plan & budget</h2>
      <p className="mt-0.5 text-xs text-slate-400">All three gate planning → creative (FR-3.4–3.6).</p>

      <form action={stratAction} className="mt-3 space-y-2">
        <input type="hidden" name="campaignId" value={campaignId} />
        <textarea name="approach" rows={2} required placeholder="Approach *" defaultValue={strategy?.approach ?? ''} className={field} />
        <div className="grid grid-cols-2 gap-2">
          <input name="audienceSegments" required placeholder="Audience segments *" defaultValue={strategy?.audienceSegments ?? ''} className={field} />
          <input name="channelMix" required placeholder="Channel mix *" defaultValue={strategy?.channelMix ?? ''} className={field} />
        </div>
        <input name="keyMessages" required placeholder="Key messages *" defaultValue={strategy?.keyMessages ?? ''} className={field} />
        <Feedback state={stratState} />
        <button disabled={stratPending} className={primaryBtn}>{stratPending ? 'Saving…' : 'Save strategy'}</button>
      </form>

      <hr className="my-4 border-slate-100" />

      <form action={planAction} className="space-y-2">
        <input type="hidden" name="campaignId" value={campaignId} />
        <div className="grid grid-cols-2 gap-2">
          <input name="timelineStart" type="date" required defaultValue={plan?.timelineStart ?? ''} className={field} title="Timeline start" />
          <input name="timelineEnd" type="date" required defaultValue={plan?.timelineEnd ?? ''} className={field} title="Timeline end" />
        </div>
        <textarea name="resourceAllocation" rows={2} required placeholder="Resource allocation *" defaultValue={plan?.resourceAllocation ?? ''} className={field} />
        <Feedback state={planState} />
        <button disabled={planPending} className={primaryBtn}>{planPending ? 'Saving…' : 'Save plan'}</button>
      </form>

      <hr className="my-4 border-slate-100" />

      <form action={budgetAction} className="space-y-2">
        <input type="hidden" name="campaignId" value={campaignId} />
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Budget</p>
          {budgetApprovalState && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                budgetApprovalState === 'approved'
                  ? 'bg-green-100 text-green-700'
                  : budgetApprovalState === 'rejected'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
              }`}
            >
              approval {budgetApprovalState}
            </span>
          )}
        </div>
        <input name="amount" type="number" step="0.01" min="0" required placeholder="Amount ₹ *" defaultValue={budget?.amount ?? ''} className={field} />
        <textarea name="breakdown" rows={2} required placeholder="Breakdown *" defaultValue={budget?.breakdown ?? ''} className={field} />
        <Feedback state={budgetState} />
        <button disabled={budgetPending} className={primaryBtn}>{budgetPending ? 'Saving…' : 'Save budget'}</button>
      </form>
      <form action={reqAction} className="mt-3 space-y-2">
        <input type="hidden" name="campaignId" value={campaignId} />
        <Feedback state={reqState} />
        <button disabled={reqPending} className={secondaryBtn}>
          {reqPending ? 'Requesting…' : 'Request budget approval'}
        </button>
      </form>
    </div>
  )
}

// ── Creative development (FR-3.7–3.9) ───────────────────────────────────────

export type ConceptItem = { id: string; title: string; concept: string; direction: string | null; at: string }
export type AssetItem = { id: string; title: string; type: string; status: string }

const ASSET_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  internal_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  client_review: 'bg-blue-100 text-blue-700',
}

export function CreativePanel({
  campaignId,
  concepts,
  assets,
  canApprove,
}: {
  campaignId: string
  concepts: ConceptItem[]
  assets: AssetItem[]
  canApprove: boolean
}) {
  const [conceptState, conceptAction, conceptPending] = useActionState<CampaignActionState, FormData>(addConceptAction, {})
  const [assetState, assetAction, assetPending] = useActionState<CampaignActionState, FormData>(addAssetAction, {})

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Creative development</h2>
      <p className="mt-0.5 text-xs text-slate-400">
        Concepts (FR-3.7) and assets with internal review before client share (FR-3.8/3.9).
      </p>

      <form action={conceptAction} className="mt-3 space-y-2">
        <input type="hidden" name="campaignId" value={campaignId} />
        <div className="grid grid-cols-2 gap-2">
          <input name="title" required placeholder="Concept title *" className={field} />
          <input name="direction" placeholder="Direction" className={field} />
        </div>
        <textarea name="concept" rows={2} required placeholder="Concept *" className={field} />
        <Feedback state={conceptState} />
        <button disabled={conceptPending} className={primaryBtn}>{conceptPending ? 'Adding…' : 'Add concept'}</button>
      </form>
      <ul className="mt-3 space-y-2">
        {concepts.map((c) => (
          <li key={c.id} className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-900">
              {c.title}
              {c.direction && <span className="font-normal text-slate-500"> · {c.direction}</span>}
            </p>
            <p className="text-slate-600">{c.concept}</p>
            <p className="mt-1 text-xs text-slate-400">{c.at}</p>
          </li>
        ))}
        {concepts.length === 0 && <p className="text-sm text-slate-400">No concepts yet.</p>}
      </ul>

      <hr className="my-4 border-slate-100" />

      <form action={assetAction} className="space-y-2">
        <input type="hidden" name="campaignId" value={campaignId} />
        <div className="grid grid-cols-2 gap-2">
          <input name="title" required placeholder="Asset title *" className={field} />
          <select name="type" defaultValue="copy" className={field}>
            <option value="copy">Copy</option>
            <option value="design">Design</option>
            <option value="video">Video</option>
            <option value="digital">Digital</option>
          </select>
        </div>
        <Feedback state={assetState} />
        <button disabled={assetPending} className={primaryBtn}>{assetPending ? 'Submitting…' : 'Submit asset for review'}</button>
      </form>
      <ul className="mt-3 space-y-2">
        {assets.map((a) => (
          <li key={a.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm">
            <div>
              <p className="font-medium text-slate-900">
                {a.title} <span className="font-normal text-slate-500">· {a.type}</span>
              </p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ASSET_STATUS_STYLES[a.status] ?? 'bg-slate-100 text-slate-600'}`}>
                {a.status.replace('_', ' ')}
              </span>
            </div>
            {canApprove && a.status === 'internal_review' && (
              <form action={approveAssetAction}>
                <input type="hidden" name="assetId" value={a.id} />
                <input type="hidden" name="campaignId" value={campaignId} />
                <button className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-500">
                  Approve
                </button>
              </form>
            )}
          </li>
        ))}
        {assets.length === 0 && <p className="text-sm text-slate-400">No assets yet — one approved asset gates client review.</p>}
      </ul>
    </div>
  )
}

// ── Client approval: revision rounds + final sign-off (FR-3.10–3.12) ────────

export type RoundItem = { id: string; roundNo: number; feedback: string; overLimit: boolean; source: string; at: string }
export type SignoffItem = { id: string; signedBy: string; evidence: string; scope: string; at: string }

export function ClientApprovalPanel({
  campaignId,
  rounds,
  signoffs,
  revisionLimit,
}: {
  campaignId: string
  rounds: RoundItem[]
  signoffs: SignoffItem[]
  revisionLimit: number
}) {
  const [roundState, roundAction, roundPending] = useActionState<CampaignActionState, FormData>(logRevisionAction, {})
  const [signState, signAction, signPending] = useActionState<CampaignActionState, FormData>(recordSignoffAction, {})

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Client approval</h2>
      <p className="mt-0.5 text-xs text-slate-400">
        Revision rounds against the limit of {revisionLimit} (FR-3.10/3.11) — final sign-off gates launch (FR-3.12).
      </p>

      <form action={roundAction} className="mt-3 space-y-2">
        <input type="hidden" name="campaignId" value={campaignId} />
        <textarea name="feedback" rows={2} required placeholder="Client feedback for this round *" className={field} />
        <Feedback state={roundState} />
        <button disabled={roundPending} className={primaryBtn}>{roundPending ? 'Logging…' : 'Log revision round'}</button>
      </form>
      <ul className="mt-3 space-y-2">
        {rounds.map((r) => (
          <li key={r.id} className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-900">
              Round {r.roundNo}
              {r.overLimit && (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  over limit — billable
                </span>
              )}
            </p>
            <p className="text-slate-600">{r.feedback}</p>
            <p className="mt-1 text-xs text-slate-400">{r.at} · {r.source}</p>
          </li>
        ))}
        {rounds.length === 0 && <p className="text-sm text-slate-400">No revision rounds logged.</p>}
      </ul>

      <hr className="my-4 border-slate-100" />

      <form action={signAction} className="space-y-2">
        <input type="hidden" name="campaignId" value={campaignId} />
        <input name="signedBy" required placeholder="Signed by (client contact) *" className={field} />
        <textarea name="evidence" rows={2} required placeholder="Sign-off evidence (email ref, written approval) *" className={field} />
        <Feedback state={signState} />
        <button disabled={signPending} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50">
          {signPending ? 'Recording…' : 'Record final sign-off'}
        </button>
      </form>
      <ul className="mt-3 space-y-2">
        {signoffs.map((s) => (
          <li key={s.id} className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
            <p className="font-semibold">{s.scope} sign-off — {s.signedBy}</p>
            <p>{s.evidence}</p>
            <p className="mt-1 text-xs text-green-700">{s.at}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Launch readiness (FR-3.13–3.15) ─────────────────────────────────────────

export type ChecklistItem = { id: string; title: string; checked: boolean }
export type ChannelItem = { id: string; channel: string; status: string; goLiveAt: string | null }

export function LaunchPanel({
  campaignId,
  items,
  channels,
}: {
  campaignId: string
  items: ChecklistItem[]
  channels: ChannelItem[]
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Launch readiness</h2>
      <p className="mt-0.5 text-xs text-slate-400">All checklist items must be checked to launch (FR-3.13).</p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            <form action={toggleChecklistAction}>
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="campaignId" value={campaignId} />
              <button
                className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
                  item.checked ? 'border-green-500 bg-green-500 text-white' : 'border-slate-300 bg-white'
                }`}
              >
                {item.checked ? '✓' : ''}
              </button>
            </form>
            <span className={item.checked ? 'text-slate-400 line-through' : 'text-slate-800'}>{item.title}</span>
          </li>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-400">No checklist items.</p>}
      </ul>
      <hr className="my-4 border-slate-100" />
      <p className="text-sm font-medium text-slate-700">Channels</p>
      <ul className="mt-2 space-y-2">
        {channels.map((ch) => (
          <li key={ch.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm">
            <span className="font-medium text-slate-900">{ch.channel}</span>
            <span className="text-slate-500">
              {ch.status}
              {ch.goLiveAt ? ` · live ${ch.goLiveAt}` : ''}
            </span>
          </li>
        ))}
        {channels.length === 0 && <p className="text-sm text-slate-400">No channels configured.</p>}
      </ul>
    </div>
  )
}

// ── Monitoring & optimization (FR-3.16/3.17) ────────────────────────────────

export type KpiItem = { id: string; name: string; target: number; latest: { value: number; at: string } | null }
export type OptimizationItem = { id: string; changeType: string; description: string; reasoning: string; at: string }

export function MonitoringPanel({
  campaignId,
  kpis,
  optimizations,
}: {
  campaignId: string
  kpis: KpiItem[]
  optimizations: OptimizationItem[]
}) {
  const [kpiState, kpiAction, kpiPending] = useActionState<CampaignActionState, FormData>(addKpiAction, {})
  const [snapState, snapAction, snapPending] = useActionState<CampaignActionState, FormData>(recordSnapshotAction, {})
  const [optState, optAction, optPending] = useActionState<CampaignActionState, FormData>(addOptimizationAction, {})

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Monitoring & optimization</h2>
      <p className="mt-0.5 text-xs text-slate-400">Manual KPI snapshots (FR-3.16) and the optimization log (FR-3.17).</p>

      <form action={kpiAction} className="mt-3 flex items-center gap-2">
        <input type="hidden" name="campaignId" value={campaignId} />
        <input name="name" required placeholder="KPI name (reach, CTR…) *" className={field} />
        <input name="target" type="number" step="0.01" required placeholder="Target *" className={field} />
        <button disabled={kpiPending} className={primaryBtn}>{kpiPending ? 'Adding…' : 'Add'}</button>
      </form>
      <Feedback state={kpiState} />
      <Feedback state={snapState} />
      <ul className="mt-3 space-y-2">
        {kpis.map((k) => (
          <li key={k.id} className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-900">{k.name}</p>
              <p className="text-slate-600">
                {k.latest ? `${k.latest.value.toLocaleString('en-IN')} / ` : '— / '}
                {k.target.toLocaleString('en-IN')} target
              </p>
            </div>
            {k.latest && <p className="text-xs text-slate-400">last snapshot {k.latest.at}</p>}
            <form action={snapAction} className="mt-2 flex items-center gap-2">
              <input type="hidden" name="kpiId" value={k.id} />
              <input type="hidden" name="campaignId" value={campaignId} />
              <input name="value" type="number" step="0.01" required placeholder="New value" className="w-40 rounded-lg border border-slate-300 px-2 py-1 text-xs" />
              <button disabled={snapPending} className="rounded border border-indigo-300 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">
                Record snapshot
              </button>
            </form>
          </li>
        ))}
        {kpis.length === 0 && <p className="text-sm text-slate-400">No KPIs defined yet.</p>}
      </ul>

      <hr className="my-4 border-slate-100" />

      <form action={optAction} className="space-y-2">
        <input type="hidden" name="campaignId" value={campaignId} />
        <div className="grid grid-cols-2 gap-2">
          <select name="changeType" defaultValue="targeting" className={field}>
            <option value="targeting">Targeting</option>
            <option value="budget">Budget</option>
            <option value="creative">Creative</option>
          </select>
          <input name="description" required placeholder="What changed *" className={field} />
        </div>
        <textarea name="reasoning" rows={2} required placeholder="Reasoning *" className={field} />
        <Feedback state={optState} />
        <button disabled={optPending} className={primaryBtn}>{optPending ? 'Logging…' : 'Log optimization'}</button>
      </form>
      <ul className="mt-3 space-y-2">
        {optimizations.map((o) => (
          <li key={o.id} className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-900">
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-medium uppercase text-slate-600">{o.changeType}</span>{' '}
              {o.description}
            </p>
            <p className="text-slate-600">{o.reasoning}</p>
            <p className="mt-1 text-xs text-slate-400">{o.at}</p>
          </li>
        ))}
        {optimizations.length === 0 && <p className="text-sm text-slate-400">No optimizations logged.</p>}
      </ul>
    </div>
  )
}

// ── Reporting & closure (FR-3.18–3.20) ──────────────────────────────────────

export type KpiResult = { name: string; target: number; actual: number | null; achievedPct: number | null }
export type ReportData = { summary: string; kpiResults: KpiResult[] }
export type ClosureData = { learnings: string; at: string }

export function ClosurePanel({
  campaignId,
  report,
  closure,
  canApprove,
}: {
  campaignId: string
  report: ReportData | null
  closure: ClosureData | null
  canApprove: boolean
}) {
  const [reportState, reportAction, reportPending] = useActionState<CampaignActionState, FormData>(compileReportAction, {})
  const [closeState, closeAction, closePending] = useActionState<CampaignActionState, FormData>(closeCampaignAction, {})

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Report & closure</h2>
      <p className="mt-0.5 text-xs text-slate-400">Compiled report + learnings gate reporting → closed (FR-3.18–3.20).</p>

      <form action={reportAction} className="mt-3 space-y-2">
        <input type="hidden" name="campaignId" value={campaignId} />
        <textarea
          name="summary"
          rows={3}
          required
          placeholder="Performance summary *"
          defaultValue={report?.summary ?? ''}
          className={field}
        />
        <Feedback state={reportState} />
        <button disabled={reportPending} className={primaryBtn}>
          {reportPending ? 'Compiling…' : 'Compile report from KPI snapshots'}
        </button>
      </form>

      {report && (
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="py-1">KPI</th>
              <th>Target</th>
              <th>Actual</th>
              <th>Achieved</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {report.kpiResults.map((k) => (
              <tr key={k.name}>
                <td className="py-1.5 font-medium text-slate-900">{k.name}</td>
                <td>{k.target.toLocaleString('en-IN')}</td>
                <td>{k.actual !== null ? k.actual.toLocaleString('en-IN') : '—'}</td>
                <td className={k.achievedPct !== null && k.achievedPct >= 100 ? 'font-semibold text-green-600' : 'text-slate-600'}>
                  {k.achievedPct !== null ? `${k.achievedPct}%` : '—'}
                </td>
              </tr>
            ))}
            {report.kpiResults.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 text-center text-slate-400">No KPI results compiled</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <hr className="my-4 border-slate-100" />

      {closure ? (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          <p className="font-semibold">Closed {closure.at}</p>
          <p className="mt-1">{closure.learnings}</p>
        </div>
      ) : canApprove ? (
        <form action={closeAction} className="space-y-2">
          <input type="hidden" name="campaignId" value={campaignId} />
          <textarea name="learnings" rows={2} required placeholder="Learnings for future campaigns *" className={field} />
          <Feedback state={closeState} />
          <button disabled={closePending} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
            {closePending ? 'Closing…' : 'Close campaign'}
          </button>
        </form>
      ) : (
        <p className="text-sm text-slate-400">A Marketing Manager closes the campaign after the report is compiled.</p>
      )}
    </div>
  )
}
