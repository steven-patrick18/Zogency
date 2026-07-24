'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePermission, withTenant } from '@/lib/authz'
import {
  addDiscoveryNote,
  createProposalVersion,
  decideApproval,
  markLost,
  recordSignedContract,
  sendProposal,
  setVerbalCommit,
} from './service'

export type DealActionState = { error?: string; success?: string }

const discoverySchema = z.object({
  dealId: z.string().uuid(),
  businessChallenges: z.string().min(1, 'Business challenges are required'),
  requirements: z.string().min(1, 'Requirements are required'),
  budgetNotes: z.string().optional().or(z.literal('')),
  decisionTimeline: z.string().optional().or(z.literal('')),
})

export async function addDiscoveryNoteAction(_p: DealActionState, formData: FormData): Promise<DealActionState> {
  await requirePermission('deals.edit')
  const parsed = discoverySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const { dealId, ...fields } = parsed.data
  await withTenant(() =>
    addDiscoveryNote(dealId, {
      businessChallenges: fields.businessChallenges,
      requirements: fields.requirements,
      budgetNotes: fields.budgetNotes || null,
      decisionTimeline: fields.decisionTimeline || null,
    }),
  )
  revalidatePath(`/deals/${dealId}`)
  return { success: 'Discovery note added' }
}

const versionSchema = z.object({
  dealId: z.string().uuid(),
  templateId: z.string().uuid().optional().or(z.literal('')),
  listAmount: z.coerce.number().positive().optional(),
  amount: z.coerce.number().positive('Amount must be positive'),
  changeNote: z.string().min(1, 'Describe what changed in this version'),
})

export async function createVersionAction(_p: DealActionState, formData: FormData): Promise<DealActionState> {
  await requirePermission('deals.edit')
  const raw = Object.fromEntries(formData)
  if (raw.listAmount === '') delete (raw as Record<string, unknown>).listAmount
  const parsed = versionSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const d = parsed.data

  const result = await withTenant(() =>
    createProposalVersion(d.dealId, {
      templateId: d.templateId || null,
      listAmount: d.listAmount ?? null,
      amount: d.amount,
      changeNote: d.changeNote,
    }),
  )
  revalidatePath(`/deals/${d.dealId}`)
  if (!result.ok) return { error: result.error }
  return {
    success: result.needsApproval
      ? `Version ${result.versionNo} saved — discount exceeds the band, approval requested. Sending is blocked until approved.`
      : `Version ${result.versionNo} saved`,
  }
}

export async function sendProposalAction(_p: DealActionState, formData: FormData): Promise<DealActionState> {
  await requirePermission('deals.edit')
  const dealId = z.string().uuid().parse(formData.get('dealId'))
  const result = await withTenant(() => sendProposal(dealId))
  revalidatePath(`/deals/${dealId}`)
  return result.ok ? { success: 'Proposal marked sent — logged with date and version (FR-2.14)' } : { error: result.error }
}

export async function decideApprovalAction(_p: DealActionState, formData: FormData): Promise<DealActionState> {
  await requirePermission('deals.approve_discount')
  const approvalId = z.string().uuid().parse(formData.get('approvalId'))
  const decision = z.enum(['approved', 'rejected']).parse(formData.get('decision'))
  const note = String(formData.get('note') ?? '')
  const dealId = String(formData.get('dealId') ?? '')
  await withTenant(() => decideApproval(approvalId, decision, note || undefined))
  if (dealId) revalidatePath(`/deals/${dealId}`)
  return { success: `Request ${decision}` }
}

export async function verbalCommitAction(_p: DealActionState, formData: FormData): Promise<DealActionState> {
  await requirePermission('deals.edit')
  const dealId = z.string().uuid().parse(formData.get('dealId'))
  try {
    await withTenant(() => setVerbalCommit(dealId))
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed' }
  }
  revalidatePath(`/deals/${dealId}`)
  return { success: 'Verbal commitment recorded (FR-2.16)' }
}

export async function markLostAction(_p: DealActionState, formData: FormData): Promise<DealActionState> {
  await requirePermission('deals.edit')
  const dealId = z.string().uuid().parse(formData.get('dealId'))
  const reason = String(formData.get('reason') ?? '').trim()
  if (!reason) return { error: 'A lost reason is required (doc 11 Q6)' }
  try {
    await withTenant(() => markLost(dealId, reason))
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed' }
  }
  revalidatePath(`/deals/${dealId}`)
  return { success: 'Deal marked lost' }
}

export async function recordContractAction(_p: DealActionState, formData: FormData): Promise<DealActionState> {
  await requirePermission('deals.edit')
  const dealId = z.string().uuid().parse(formData.get('dealId'))
  const evidenceNote = String(formData.get('evidenceNote') ?? '').trim()
  const finalValueRaw = String(formData.get('finalValue') ?? '').trim()
  if (!evidenceNote) return { error: 'Record how the contract was executed (e-sign ref / written approval evidence)' }

  const result = await withTenant(() =>
    recordSignedContract(dealId, {
      evidenceNote,
      finalValue: finalValueRaw ? Number(finalValueRaw) : null,
    }),
  )
  revalidatePath(`/deals/${dealId}`)
  revalidatePath('/leads')
  revalidatePath('/pipeline')
  return result.ok ? { success: 'Contract recorded — deal Closed-Won 🎉' } : { error: result.error }
}
