// Deal room domain service (doc 04 §6–7, FR-2.11–2.18, ADR-004).
// A deal is created when BANT qualification completes; it carries the
// opportunity through discovery → proposal/negotiation → verbal commit →
// contract → Closed-Won (or lost, with reason — doc 11 Q6).
import { Prisma, type Deal } from '@/generated/prisma/client'
import { audit } from '@/lib/audit'
import { requireTenantContext } from '@/lib/db/context'
import { prisma, scoped } from '@/lib/db/prisma'
import { notify } from '@/lib/notify'
import { changeLeadStatus } from '@/modules/pipeline/service'

export async function ensureDealForLead(leadId: string): Promise<Deal> {
  const existing = await prisma.deal.findUnique({ where: { leadId } })
  if (existing) return existing
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } })
  const deal = await prisma.deal.create({
    data: scoped({ leadId, ownerId: lead.ownerId }),
  })
  await audit('deal.create', 'deal', deal.id, null, { leadId })
  return deal
}

export async function addDiscoveryNote(
  dealId: string,
  input: { businessChallenges: string; requirements: string; budgetNotes?: string | null; decisionTimeline?: string | null },
) {
  const ctx = requireTenantContext()
  await prisma.deal.findUniqueOrThrow({ where: { id: dealId } })
  const note = await prisma.discoveryNote.create({
    data: scoped({ dealId, ...input, authorId: ctx.userId ?? null }),
  })
  await audit('deal.discovery_note', 'deal', dealId, null, { noteId: note.id })
  return note
}

export type NewVersionResult =
  | { ok: true; needsApproval: boolean; versionNo: number }
  | { ok: false; error: string }

/**
 * Creates the next immutable proposal version (FR-2.14/2.15). If the discount
 * vs list price exceeds the tenant band, a discount approval_request is opened
 * and the version cannot be sent until approved (FR-2.13).
 */
export async function createProposalVersion(
  dealId: string,
  input: { templateId?: string | null; listAmount?: number | null; amount: number; changeNote: string },
): Promise<NewVersionResult> {
  const ctx = requireTenantContext()
  const deal = await prisma.deal.findUnique({ where: { id: dealId }, include: { lead: true } })
  if (!deal) return { ok: false, error: 'Deal not found' }
  if (deal.stage === 'won' || deal.stage === 'lost') return { ok: false, error: 'Deal is closed' }
  if (input.amount <= 0) return { ok: false, error: 'Amount must be positive' }

  let proposal = await prisma.proposal.findFirst({ where: { dealId } })
  if (!proposal) {
    proposal = await prisma.proposal.create({
      data: scoped({ dealId, templateId: input.templateId ?? null }),
    })
  }

  const versionNo = proposal.currentVersion + 1
  await prisma.proposalVersion.create({
    data: scoped({
      proposalId: proposal.id,
      versionNo,
      listAmount: input.listAmount ?? null,
      amount: new Prisma.Decimal(input.amount),
      changeNote: input.changeNote,
      createdBy: ctx.userId ?? null,
    }),
  })
  await prisma.proposal.update({
    where: { id: proposal.id },
    data: { currentVersion: versionNo, status: 'draft' },
  })

  // Discount check (FR-2.13, doc 11 Q10 defaults until BRB's matrix lands).
  let needsApproval = false
  if (input.listAmount && input.listAmount > input.amount) {
    const settings = await prisma.tenantSettings.findFirstOrThrow()
    const discountPct = ((input.listAmount - input.amount) / input.listAmount) * 100
    if (discountPct > settings.maxDiscountPercent) {
      needsApproval = true
      const request = await prisma.approvalRequest.create({
        data: scoped({
          type: 'discount',
          entityType: 'proposal_version',
          entityId: proposal.id,
          summary: `v${versionNo} for "${deal.lead.name}": ${discountPct.toFixed(1)}% discount (₹${input.amount} vs list ₹${input.listAmount}) exceeds the ${settings.maxDiscountPercent}% band`,
          requestedBy: ctx.userId!,
        }),
      })
      for (const userId of await approverIds()) {
        await notify(userId, 'approval.requested', { summary: request.summary })
      }
    }
  }
  await audit('proposal.version_created', 'deal', dealId, null, {
    versionNo, amount: input.amount, listAmount: input.listAmount ?? null, needsApproval,
  })
  return { ok: true, needsApproval, versionNo }
}

/** Users holding deals.approve_discount (Sales Manager / Admin). */
async function approverIds(): Promise<string[]> {
  const permission = await prisma.role.findMany({
    where: { rolePermissions: { some: { permission: { key: 'deals.approve_discount' } } } },
    include: { userRoles: true },
  })
  return [...new Set(permission.flatMap((r) => r.userRoles.map((ur) => ur.userId)))]
}

export async function sendProposal(dealId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = requireTenantContext()
  const proposal = await prisma.proposal.findFirst({ where: { dealId } })
  if (!proposal || proposal.currentVersion === 0) return { ok: false, error: 'No proposal version yet' }

  const pendingDiscount = await prisma.approvalRequest.findFirst({
    where: { type: 'discount', entityType: 'proposal_version', entityId: proposal.id, state: 'pending' },
  })
  if (pendingDiscount) {
    return { ok: false, error: 'Discount approval is pending — the proposal cannot be sent yet (FR-2.13).' }
  }
  const rejected = await prisma.approvalRequest.findFirst({
    where: { type: 'discount', entityType: 'proposal_version', entityId: proposal.id, state: 'rejected' },
    orderBy: { decidedAt: 'desc' },
  })
  const latest = await prisma.proposalVersion.findFirstOrThrow({
    where: { proposalId: proposal.id, versionNo: proposal.currentVersion },
  })
  if (rejected && rejected.decidedAt! > latest.createdAt) {
    return { ok: false, error: 'Discount was rejected — revise the proposal before sending.' }
  }

  await prisma.proposalVersion.update({
    where: { id: latest.id },
    data: { sentAt: new Date(), sentBy: ctx.userId ?? null },
  })
  await prisma.proposal.update({ where: { id: proposal.id }, data: { status: 'sent' } })
  await prisma.deal.update({
    where: { id: dealId },
    data: { value: latest.amount },
  })
  await audit('proposal.sent', 'deal', dealId, null, { versionNo: latest.versionNo, amount: latest.amount.toString() })
  return { ok: true }
}

export async function decideApproval(
  approvalId: string,
  decision: 'approved' | 'rejected',
  note?: string,
): Promise<void> {
  const ctx = requireTenantContext()
  const request = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: approvalId } })
  if (request.state !== 'pending') throw new Error('Already decided')
  await prisma.approvalRequest.update({
    where: { id: approvalId },
    data: { state: decision, approverId: ctx.userId, decisionNote: note ?? null, decidedAt: new Date() },
  })
  await notify(request.requestedBy, 'approval.decided', { decision, summary: request.summary })
  await audit('approval.decided', request.entityType, request.entityId, { state: 'pending' }, { state: decision, note })
}

export async function setVerbalCommit(dealId: string): Promise<void> {
  const deal = await prisma.deal.findUniqueOrThrow({ where: { id: dealId } })
  if (deal.stage !== 'open') throw new Error('Deal is not open')
  await prisma.deal.update({ where: { id: dealId }, data: { stage: 'verbal_commit' } })
  await audit('deal.verbal_commit', 'deal', dealId, { stage: 'open' }, { stage: 'verbal_commit' })
}

export async function markLost(dealId: string, reason: string): Promise<void> {
  const deal = await prisma.deal.findUniqueOrThrow({ where: { id: dealId } })
  if (deal.stage === 'won') throw new Error('Won deals cannot be marked lost')
  await prisma.deal.update({
    where: { id: dealId },
    data: { stage: 'lost', lostReason: reason },
  })
  await audit('deal.lost', 'deal', dealId, { stage: deal.stage }, { stage: 'lost', reason })
}

/**
 * Records the signed contract (logged fallback / e-sign event) and closes the
 * deal Won (FR-2.17/2.18): wonAt + final value captured, lead moved to Won.
 * S6 adds the SoW-mandatory-before-Won validation here.
 */
export async function recordSignedContract(
  dealId: string,
  input: { evidenceNote: string; finalValue?: number | null },
): Promise<{ ok: boolean; error?: string }> {
  const deal = await prisma.deal.findUniqueOrThrow({ where: { id: dealId }, include: { lead: true } })
  if (deal.stage === 'won') return { ok: false, error: 'Deal already won' }
  if (deal.stage === 'lost') return { ok: false, error: 'Deal is lost' }

  const finalValue = input.finalValue ?? (deal.value ? Number(deal.value) : null)
  if (!finalValue) return { ok: false, error: 'Set a final deal value (send a proposal or enter it here)' }

  await prisma.contract.upsert({
    where: { dealId },
    update: { status: 'signed', signedAt: new Date(), evidenceNote: input.evidenceNote },
    create: scoped({
      dealId,
      provider: 'logged',
      status: 'signed',
      signedAt: new Date(),
      evidenceNote: input.evidenceNote,
    }),
  })
  await prisma.deal.update({
    where: { id: dealId },
    data: { stage: 'won', wonAt: new Date(), value: new Prisma.Decimal(finalValue) },
  })
  const wonStatus = await prisma.leadStatus.findFirst({ where: { isWon: true } })
  if (wonStatus && deal.lead.statusId !== wonStatus.id) {
    await changeLeadStatus(
      deal.leadId,
      wonStatus.id,
      `Deal won — contract signed (₹${finalValue}). ${input.evidenceNote}`,
    )
  }
  await audit('deal.won', 'deal', dealId, { stage: deal.stage }, { stage: 'won', finalValue })
  return { ok: true }
}
