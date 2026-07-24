'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit } from '@/lib/audit'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma, scoped } from '@/lib/db/prisma'
import { decideApproval } from '@/modules/deals/service'
import {
  closeCampaign,
  compileReport,
  createCampaign,
  logRevisionRound,
  moveCampaignStatus,
  requestBriefApproval,
  requestBudgetApproval,
  type CampaignStatusName,
} from './service'

export type CampaignActionState = { error?: string; success?: string }
type S = CampaignActionState

const uuid = z.string().uuid()

function fail(msg: string): S {
  return { error: msg }
}

export async function createCampaignAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('campaigns.edit')
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return fail('Campaign name is required')
  const clientId = String(formData.get('clientId') ?? '')
  const id = await withTenant(() => createCampaign({ name, clientId: clientId || null }))
  redirect(`/campaigns/${id}`)
}

const briefSchema = z.object({
  campaignId: uuid,
  objectives: z.string().min(1, 'Objectives required'),
  targetAudience: z.string().min(1, 'Target audience required'),
  deliverables: z.string().min(1, 'Deliverables required'),
  timeline: z.string().min(1, 'Timeline required'),
  budgetEstimate: z.string().optional().or(z.literal('')),
  kickoffCallAt: z.string().optional().or(z.literal('')),
})

export async function saveBriefAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('campaigns.edit')
  const parsed = briefSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid input')
  const { campaignId, kickoffCallAt, budgetEstimate, ...fields } = parsed.data
  await withTenant(async () => {
    const data = {
      ...fields,
      budgetEstimate: budgetEstimate || null,
      kickoffCallAt: kickoffCallAt ? new Date(kickoffCallAt) : null,
    }
    await prisma.brief.upsert({
      where: { campaignId },
      update: data,
      create: scoped({ campaignId, ...data }),
    })
    await audit('campaign.brief_saved', 'campaign', campaignId, null, fields)
  })
  revalidatePath(`/campaigns/${campaignId}`)
  return { success: 'Brief saved' }
}

export async function requestBriefApprovalAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('campaigns.edit')
  const campaignId = uuid.parse(formData.get('campaignId'))
  const r = await withTenant(() => requestBriefApproval(campaignId))
  revalidatePath(`/campaigns/${campaignId}`)
  return r.ok ? { success: 'Brief sign-off requested from the Marketing Manager' } : fail(r.error)
}

const strategySchema = z.object({
  campaignId: uuid,
  approach: z.string().min(1),
  audienceSegments: z.string().min(1),
  keyMessages: z.string().min(1),
  channelMix: z.string().min(1),
})

export async function saveStrategyAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('campaigns.edit')
  const parsed = strategySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail('All strategy fields are required (FR-3.4)')
  const { campaignId, ...fields } = parsed.data
  await withTenant(() =>
    prisma.campaignStrategy.upsert({
      where: { campaignId },
      update: fields,
      create: scoped({ campaignId, ...fields }),
    }),
  )
  revalidatePath(`/campaigns/${campaignId}`)
  return { success: 'Strategy saved' }
}

const planSchema = z.object({
  campaignId: uuid,
  timelineStart: z.string().min(1),
  timelineEnd: z.string().min(1),
  resourceAllocation: z.string().min(1),
})

export async function savePlanAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('campaigns.edit')
  const parsed = planSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail('Timeline and resource allocation are required (FR-3.5)')
  const { campaignId, timelineStart, timelineEnd, resourceAllocation } = parsed.data
  await withTenant(() =>
    prisma.campaignPlan.upsert({
      where: { campaignId },
      update: { timelineStart: new Date(timelineStart), timelineEnd: new Date(timelineEnd), resourceAllocation },
      create: scoped({
        campaignId,
        timelineStart: new Date(timelineStart),
        timelineEnd: new Date(timelineEnd),
        resourceAllocation,
      }),
    }),
  )
  revalidatePath(`/campaigns/${campaignId}`)
  return { success: 'Plan saved' }
}

export async function saveBudgetAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('campaigns.edit')
  const campaignId = uuid.parse(formData.get('campaignId'))
  const amount = Number(formData.get('amount'))
  const breakdown = String(formData.get('breakdown') ?? '').trim()
  if (!amount || amount <= 0 || !breakdown) return fail('Amount and breakdown are required (FR-3.5)')
  await withTenant(async () => {
    const { Prisma } = await import('@/generated/prisma/client')
    await prisma.budget.upsert({
      where: { campaignId },
      update: { amount: new Prisma.Decimal(amount), breakdown },
      create: scoped({ campaignId, amount: new Prisma.Decimal(amount), breakdown }),
    })
  })
  revalidatePath(`/campaigns/${campaignId}`)
  return { success: 'Budget saved — request approval to proceed' }
}

export async function requestBudgetApprovalAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('campaigns.edit')
  const campaignId = uuid.parse(formData.get('campaignId'))
  const r = await withTenant(() => requestBudgetApproval(campaignId))
  revalidatePath(`/campaigns/${campaignId}`)
  return r.ok ? { success: 'Budget approval requested' } : fail(r.error)
}

export async function decideCampaignApprovalAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('campaigns.approve')
  const approvalId = uuid.parse(formData.get('approvalId'))
  const campaignId = uuid.parse(formData.get('campaignId'))
  const decision = z.enum(['approved', 'rejected']).parse(formData.get('decision'))
  await withTenant(() => decideApproval(approvalId, decision, String(formData.get('note') ?? '') || undefined))
  revalidatePath(`/campaigns/${campaignId}`)
  return { success: `Request ${decision}` }
}

export async function addConceptAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('campaigns.edit')
  const campaignId = uuid.parse(formData.get('campaignId'))
  const title = String(formData.get('title') ?? '').trim()
  const concept = String(formData.get('concept') ?? '').trim()
  if (!title || !concept) return fail('Title and concept are required (FR-3.7)')
  await withTenant(async () => {
    await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } })
    await prisma.creativeConcept.create({
      data: scoped({ campaignId, title, concept, direction: String(formData.get('direction') ?? '') || null }),
    })
  })
  revalidatePath(`/campaigns/${campaignId}`)
  return { success: 'Concept added' }
}

export async function addAssetAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('campaigns.edit')
  const campaignId = uuid.parse(formData.get('campaignId'))
  const title = String(formData.get('title') ?? '').trim()
  const type = z.enum(['copy', 'design', 'video', 'digital']).parse(formData.get('type'))
  if (!title) return fail('Asset title required')
  await withTenant(async () => {
    await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } })
    await prisma.creativeAsset.create({ data: scoped({ campaignId, title, type, status: 'internal_review' }) })
  })
  revalidatePath(`/campaigns/${campaignId}`)
  return { success: 'Asset submitted for internal review (FR-3.8)' }
}

export async function approveAssetAction(formData: FormData) {
  // Internal review gate (FR-3.8) — Marketing Manager approves brand/quality.
  await requirePermission('campaigns.approve')
  const assetId = uuid.parse(formData.get('assetId'))
  const campaignId = uuid.parse(formData.get('campaignId'))
  await withTenant(async () => {
    await prisma.creativeAsset.update({ where: { id: assetId }, data: { status: 'approved' } })
    await audit('campaign.asset_approved', 'campaign', campaignId, null, { assetId })
  })
  revalidatePath(`/campaigns/${campaignId}`)
}

export async function logRevisionAction(_p: S, formData: FormData): Promise<S> {
  const session = await requirePermission('campaigns.edit')
  const campaignId = uuid.parse(formData.get('campaignId'))
  const feedback = String(formData.get('feedback') ?? '').trim()
  if (!feedback) return fail('Feedback text is required')
  const r = await withTenant(() =>
    logRevisionRound(campaignId, { feedback }, session.user.permissions.includes('campaigns.approve')),
  )
  revalidatePath(`/campaigns/${campaignId}`)
  return r.ok ? { success: `Revision round ${r.roundNo} logged` } : fail(r.error)
}

export async function recordSignoffAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('campaigns.edit')
  const campaignId = uuid.parse(formData.get('campaignId'))
  const evidence = String(formData.get('evidence') ?? '').trim()
  const signedBy = String(formData.get('signedBy') ?? '').trim()
  if (!evidence || !signedBy) return fail('Sign-off evidence and signer name are required (FR-3.12)')
  await withTenant(async () => {
    const ctxCampaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } })
    await prisma.clientSignoff.create({
      data: scoped({ campaignId, scope: 'final', evidence, signedBy }),
    })
    await audit('campaign.signoff', 'campaign', campaignId, null, { signedBy, name: ctxCampaign.name })
  })
  revalidatePath(`/campaigns/${campaignId}`)
  return { success: 'Client sign-off recorded' }
}

export async function toggleChecklistAction(formData: FormData) {
  const session = await requirePermission('campaigns.edit')
  const itemId = uuid.parse(formData.get('itemId'))
  const campaignId = uuid.parse(formData.get('campaignId'))
  await withTenant(async () => {
    const item = await prisma.launchChecklistItem.findUniqueOrThrow({ where: { id: itemId } })
    await prisma.launchChecklistItem.update({
      where: { id: itemId },
      data: item.checkedAt ? { checkedAt: null, checkedBy: null } : { checkedAt: new Date(), checkedBy: session.user.id },
    })
  })
  revalidatePath(`/campaigns/${campaignId}`)
}

export async function addKpiAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('campaigns.edit')
  const campaignId = uuid.parse(formData.get('campaignId'))
  const name = String(formData.get('name') ?? '').trim()
  const target = Number(formData.get('target'))
  if (!name || !target) return fail('KPI name and target are required')
  await withTenant(async () => {
    const { Prisma } = await import('@/generated/prisma/client')
    await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } })
    await prisma.campaignKpi.create({ data: scoped({ campaignId, name, target: new Prisma.Decimal(target) }) })
  })
  revalidatePath(`/campaigns/${campaignId}`)
  return { success: 'KPI added' }
}

export async function recordSnapshotAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('campaigns.edit')
  const kpiId = uuid.parse(formData.get('kpiId'))
  const campaignId = uuid.parse(formData.get('campaignId'))
  const value = Number(formData.get('value'))
  if (Number.isNaN(value)) return fail('Enter a value')
  await withTenant(async () => {
    const { Prisma } = await import('@/generated/prisma/client')
    await prisma.campaignKpi.findUniqueOrThrow({ where: { id: kpiId } })
    await prisma.kpiSnapshot.create({ data: scoped({ kpiId, value: new Prisma.Decimal(value) }) })
  })
  revalidatePath(`/campaigns/${campaignId}`)
  return { success: 'Snapshot recorded' }
}

export async function addOptimizationAction(_p: S, formData: FormData): Promise<S> {
  const session = await requirePermission('campaigns.edit')
  const campaignId = uuid.parse(formData.get('campaignId'))
  const changeType = z.enum(['targeting', 'budget', 'creative']).parse(formData.get('changeType'))
  const description = String(formData.get('description') ?? '').trim()
  const reasoning = String(formData.get('reasoning') ?? '').trim()
  if (!description || !reasoning) return fail('Change and reasoning are both required (FR-3.17)')
  await withTenant(async () => {
    await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } })
    await prisma.optimizationLog.create({
      data: scoped({ campaignId, changeType, description, reasoning, actorId: session.user.id }),
    })
  })
  revalidatePath(`/campaigns/${campaignId}`)
  return { success: 'Optimization logged' }
}

export async function compileReportAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('campaigns.edit')
  const campaignId = uuid.parse(formData.get('campaignId'))
  const summary = String(formData.get('summary') ?? '').trim()
  if (!summary) return fail('Write the report summary')
  await withTenant(() => compileReport(campaignId, summary))
  revalidatePath(`/campaigns/${campaignId}`)
  return { success: 'Report compiled from latest KPI snapshots (FR-3.18)' }
}

export async function closeCampaignAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('campaigns.approve')
  const campaignId = uuid.parse(formData.get('campaignId'))
  const learnings = String(formData.get('learnings') ?? '').trim()
  if (!learnings) return fail('Log the learnings before closing (FR-3.20)')
  const r = await withTenant(() => closeCampaign(campaignId, learnings))
  revalidatePath(`/campaigns/${campaignId}`)
  return r.ok ? { success: 'Campaign closed and archived' } : fail(r.error)
}

export async function moveCampaignAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('campaigns.edit')
  const campaignId = uuid.parse(formData.get('campaignId'))
  const to = String(formData.get('to')) as CampaignStatusName
  const r = await withTenant(() => moveCampaignStatus(campaignId, to))
  revalidatePath(`/campaigns/${campaignId}`)
  return r.ok ? { success: `Moved to ${to}` } : fail(r.error)
}
