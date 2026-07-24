// Marketing campaign workflow (doc 05, FR-3.1–3.20).
// Status flow with HARD GATES (doc 05 state diagram):
//   brief → planning      : brief exists + internal sign-off approved (FR-3.3)
//   planning → creative   : strategy + plan + approved budget (FR-3.4–3.6)
//   creative → approval   : ≥1 internally-approved asset (FR-3.8/3.9)
//   approval → launched   : final client sign-off + full checklist (FR-3.12/3.13)
//   launched → monitoring : free (go-live confirmed, FR-3.15)
//   monitoring → reporting: free
//   reporting → closed    : compiled report + closure learnings (FR-3.18–3.20)
import { Prisma } from '@/generated/prisma/client'
import { audit } from '@/lib/audit'
import { requireTenantContext } from '@/lib/db/context'
import { prisma, scoped } from '@/lib/db/prisma'
import { notify } from '@/lib/notify'

type GateResult = { ok: true } | { ok: false; error: string }

const ORDER = ['brief', 'planning', 'creative', 'approval', 'launched', 'monitoring', 'reporting', 'closed'] as const
export type CampaignStatusName = (typeof ORDER)[number]

export async function createCampaign(input: {
  name: string
  clientId?: string | null
}): Promise<string> {
  const ctx = requireTenantContext()
  const settings = await prisma.tenantSettings.findFirstOrThrow()
  const campaign = await prisma.campaign.create({
    data: scoped({
      name: input.name,
      clientId: input.clientId ?? null,
      managerId: ctx.userId ?? null,
      accountOwnerId: ctx.userId ?? null,
      revisionLimit: settings.revisionRoundDefault,
    }),
  })
  // Seeded pre-launch checklist (FR-3.13) — editable per campaign.
  for (const title of ['Tracking / pixels verified', 'Content scheduled', 'Channel accounts ready']) {
    await prisma.launchChecklistItem.create({ data: scoped({ campaignId: campaign.id, title }) })
  }
  await audit('campaign.create', 'campaign', campaign.id, null, { name: input.name })
  return campaign.id
}

/** Requests internal brief sign-off from the Marketing Manager (FR-3.3). */
export async function requestBriefApproval(campaignId: string): Promise<GateResult> {
  const ctx = requireTenantContext()
  const brief = await prisma.brief.findUnique({ where: { campaignId } })
  if (!brief) return { ok: false, error: 'Fill the brief first (FR-3.1)' }
  const pending = await prisma.approvalRequest.findFirst({
    where: { type: 'brief', entityId: campaignId, state: 'pending' },
  })
  if (pending) return { ok: false, error: 'Brief sign-off already requested' }
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } })
  const request = await prisma.approvalRequest.create({
    data: scoped({
      type: 'brief',
      entityType: 'campaign',
      entityId: campaignId,
      summary: `Brief sign-off: "${campaign.name}"`,
      requestedBy: ctx.userId!,
    }),
  })
  await notifyApprovers('campaigns.approve', 'approval.requested', { summary: request.summary })
  return { ok: true }
}

/** Requests budget approval (FR-3.6). */
export async function requestBudgetApproval(campaignId: string): Promise<GateResult> {
  const ctx = requireTenantContext()
  const budget = await prisma.budget.findUnique({ where: { campaignId } })
  if (!budget) return { ok: false, error: 'Set the budget first (FR-3.5)' }
  const pending = await prisma.approvalRequest.findFirst({
    where: { type: 'budget', entityId: campaignId, state: 'pending' },
  })
  if (pending) return { ok: false, error: 'Budget approval already requested' }
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } })
  const request = await prisma.approvalRequest.create({
    data: scoped({
      type: 'budget',
      entityType: 'campaign',
      entityId: campaignId,
      summary: `Budget ₹${Number(budget.amount).toLocaleString('en-IN')} for "${campaign.name}"`,
      requestedBy: ctx.userId!,
    }),
  })
  await notifyApprovers('campaigns.approve', 'approval.requested', { summary: request.summary })
  return { ok: true }
}

/**
 * A gate passes only with an approval that is still CURRENT: the approved
 * content must not have changed since the decision. `contentUpdatedAt` is the
 * entity's updatedAt; if it is newer than the approval's decidedAt the approval
 * is stale (content edited after sign-off) and the gate must fail.
 */
async function approvedRequest(
  type: string,
  campaignId: string,
  contentUpdatedAt?: Date | null,
): Promise<boolean> {
  const approved = await prisma.approvalRequest.findFirst({
    where: { type, entityId: campaignId, state: 'approved' },
    orderBy: { decidedAt: 'desc' },
  })
  if (!approved) return false
  if (contentUpdatedAt && approved.decidedAt && contentUpdatedAt > approved.decidedAt) {
    return false // approved content was edited afterwards — sign-off no longer valid
  }
  return true
}

async function notifyApprovers(permissionKey: string, template: string, payload: Record<string, unknown>) {
  const roles = await prisma.role.findMany({
    where: { rolePermissions: { some: { permission: { key: permissionKey } } } },
    include: { userRoles: true },
  })
  for (const userId of new Set(roles.flatMap((r) => r.userRoles.map((ur) => ur.userId)))) {
    await notify(userId, template, payload)
  }
}

/** Gate checks per target status (doc 05). */
async function checkGate(campaignId: string, to: CampaignStatusName): Promise<GateResult> {
  if (to === 'planning') {
    const brief = await prisma.brief.findUnique({ where: { campaignId } })
    if (!(await approvedRequest('brief', campaignId, brief?.updatedAt))) {
      return { ok: false, error: 'The brief needs internal sign-off before planning starts — re-request approval if it was edited (FR-3.3).' }
    }
  }
  if (to === 'creative') {
    const [strategy, plan, budget] = await Promise.all([
      prisma.campaignStrategy.findUnique({ where: { campaignId } }),
      prisma.campaignPlan.findUnique({ where: { campaignId } }),
      prisma.budget.findUnique({ where: { campaignId } }),
    ])
    if (!strategy) return { ok: false, error: 'Define the strategy first (FR-3.4).' }
    if (!plan) return { ok: false, error: 'Build the project plan first (FR-3.5).' }
    if (!(await approvedRequest('budget', campaignId, budget?.updatedAt))) {
      return { ok: false, error: 'The budget must be approved before execution begins — re-request approval if it was changed (FR-3.6).' }
    }
  }
  if (to === 'approval') {
    const approvedAssets = await prisma.creativeAsset.count({
      where: { campaignId, status: 'approved' },
    })
    if (approvedAssets === 0) {
      return { ok: false, error: 'At least one internally-approved asset is required before client review (FR-3.8).' }
    }
  }
  if (to === 'launched') {
    const signoff = await prisma.clientSignoff.findFirst({ where: { campaignId, scope: 'final' } })
    if (!signoff) return { ok: false, error: 'Final client sign-off must be captured before launch (FR-3.12).' }
    const unchecked = await prisma.launchChecklistItem.count({
      where: { campaignId, checkedAt: null },
    })
    if (unchecked > 0) {
      return { ok: false, error: `${unchecked} pre-launch checklist item(s) unchecked (FR-3.13).` }
    }
  }
  if (to === 'closed') {
    const [report, closure] = await Promise.all([
      prisma.campaignReport.findUnique({ where: { campaignId } }),
      prisma.projectClosure.findUnique({ where: { campaignId } }),
    ])
    if (!report) return { ok: false, error: 'Compile the performance report first (FR-3.18).' }
    if (!closure) return { ok: false, error: 'Log closure learnings first (FR-3.20).' }
  }
  return { ok: true }
}

export async function moveCampaignStatus(
  campaignId: string,
  to: CampaignStatusName,
): Promise<GateResult> {
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } })
  const fromIdx = ORDER.indexOf(campaign.status as CampaignStatusName)
  const toIdx = ORDER.indexOf(to)
  if (campaign.status === 'closed') return { ok: false, error: 'Campaign is closed.' }
  if (toIdx !== fromIdx + 1 && toIdx >= fromIdx) {
    return { ok: false, error: 'Move one stage at a time.' }
  }
  if (toIdx < fromIdx) {
    // Backward moves allowed (rework), except out of closed.
  } else {
    const gate = await checkGate(campaignId, to)
    if (!gate.ok) return gate
  }

  await prisma.campaign.update({ where: { id: campaignId }, data: { status: to } })
  await audit('campaign.status_change', 'campaign', campaignId, { status: campaign.status }, { status: to })

  if (to === 'launched') {
    // FR-3.14/3.15: channels go live; Account Servicing confirms to the client.
    await prisma.campaignChannel.updateMany({
      where: { campaignId, status: 'scheduled' },
      data: { status: 'live', goLiveAt: new Date() },
    })
    if (campaign.accountOwnerId) {
      await notify(campaign.accountOwnerId, 'campaign.launched', { name: campaign.name })
    }
  }
  return { ok: true }
}

/**
 * Logs a client feedback round (FR-3.10/3.11). Rounds beyond the limit need
 * the manager's campaigns.approve permission and are flagged over_limit
 * (billable-change note per doc 05 §5).
 */
export async function logRevisionRound(
  campaignId: string,
  input: { feedback: string; source?: 'client' | 'internal' },
  hasOverridePermission: boolean,
): Promise<GateResult & { roundNo?: number }> {
  const ctx = requireTenantContext()
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } })
  const roundNo = (await prisma.revisionRound.count({ where: { campaignId, source: 'client' } })) + 1
  const overLimit = roundNo > campaign.revisionLimit
  if (overLimit && !hasOverridePermission) {
    return {
      ok: false,
      error: `Revision round ${roundNo} exceeds the agreed limit of ${campaign.revisionLimit} — a Marketing Manager must log it (billable change, FR-3.11).`,
    }
  }
  await prisma.revisionRound.create({
    data: scoped({
      campaignId,
      roundNo,
      feedback: input.feedback,
      source: input.source ?? 'client',
      overLimit,
      loggedBy: ctx.userId ?? null,
    }),
  })
  await audit('campaign.revision_round', 'campaign', campaignId, null, { roundNo, overLimit })
  return { ok: true, roundNo }
}

/** Compiles the performance report from KPI snapshots (FR-3.18). */
export async function compileReport(campaignId: string, summary: string): Promise<GateResult> {
  const kpis = await prisma.campaignKpi.findMany({
    where: { campaignId },
    include: { snapshots: { orderBy: { capturedAt: 'desc' }, take: 1 } },
  })
  const kpiResults = kpis.map((k) => ({
    name: k.name,
    target: Number(k.target),
    actual: k.snapshots[0] ? Number(k.snapshots[0].value) : null,
    achievedPct: k.snapshots[0] ? Math.round((Number(k.snapshots[0].value) / Number(k.target)) * 100) : null,
  }))
  await prisma.campaignReport.upsert({
    where: { campaignId },
    update: { summary, kpiResults: kpiResults as Prisma.InputJsonValue },
    create: scoped({ campaignId, summary, kpiResults: kpiResults as Prisma.InputJsonValue }),
  })
  await audit('campaign.report_compiled', 'campaign', campaignId, null, { kpis: kpiResults.length })
  return { ok: true }
}

export async function closeCampaign(campaignId: string, learnings: string): Promise<GateResult> {
  const ctx = requireTenantContext()
  await prisma.projectClosure.upsert({
    where: { campaignId },
    update: { learnings },
    create: scoped({ campaignId, learnings, closedBy: ctx.userId ?? null }),
  })
  return moveCampaignStatus(campaignId, 'closed')
}
