// Lead domain service (doc 04 §2–3). All ingestion channels converge on
// createLead(): normalize → dedupe → create/merge → SLA stamp → assign → notify.
// Callers must be inside tenant context (withTenant or runWithTenant).
import type { Lead } from '@/generated/prisma/client'
import { audit } from '@/lib/audit'
import { requireTenantContext } from '@/lib/db/context'
import { prisma, scoped } from '@/lib/db/prisma'
import { notify } from '@/lib/notify'

export type LeadInput = {
  name: string
  phone?: string | null
  email?: string | null
  company?: string | null
  city?: string | null
  industry?: string | null
  sourceName: string // must match a lead_sources row (seeded)
  ownerId?: string | null // manual override — skips assignment rules
}

export type CreateLeadResult =
  | { outcome: 'created'; lead: Lead }
  | { outcome: 'merged'; lead: Lead } // duplicate — merged into existing (FR-1.4)
  | { outcome: 'rejected'; reason: string }

/** Normalizes to E.164; assumes India (+91) for bare 10-digit numbers. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/[^\d+]/g, '')
  if (!digits) return null
  if (digits.startsWith('+')) return digits
  if (digits.length === 10) return `+91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`
  if (digits.startsWith('0') && digits.length === 11) return `+91${digits.slice(1)}`
  return `+${digits}`
}

export async function createLead(input: LeadInput): Promise<CreateLeadResult> {
  const phone = normalizePhone(input.phone)
  const email = input.email?.trim().toLowerCase() || null
  const name = input.name?.trim()
  if (!name) return { outcome: 'rejected', reason: 'Missing name' }
  if (!phone && !email) return { outcome: 'rejected', reason: 'Needs phone or email' }

  const source = await prisma.leadSource.findFirst({ where: { name: input.sourceName } })
  if (!source) return { outcome: 'rejected', reason: `Unknown source "${input.sourceName}"` }

  // Dedupe (FR-1.4): match by phone OR email; merge, never duplicate.
  const existing = await prisma.lead.findFirst({
    where: {
      OR: [...(phone ? [{ phone }] : []), ...(email ? [{ email }] : [])],
    },
    include: { status: true },
  })
  if (existing) {
    const merged = await prisma.lead.update({
      where: { id: existing.id },
      data: {
        // Fill blanks only — existing values are never overwritten (doc 04 §2.2).
        email: existing.email ?? email,
        phone: existing.phone ?? phone,
        company: existing.company ?? input.company?.trim() ?? null,
        city: existing.city ?? input.city?.trim() ?? null,
        industry: existing.industry ?? input.industry?.trim() ?? null,
      },
    })
    await prisma.comment.create({
      data: scoped({
        entityType: 'lead',
        entityId: existing.id,
        body: `Duplicate submission from ${input.sourceName} on ${new Date().toISOString().slice(0, 10)}; details merged.${existing.status.isTerminal ? ' Lead is in a terminal status — possible re-engagement, review advised.' : ''}`,
      }),
    })
    if (existing.status.isTerminal && existing.ownerId) {
      await notify(existing.ownerId, 'lead.reengagement', { name: existing.name })
    }
    return { outcome: 'merged', lead: merged }
  }

  const [newStatus, settings] = await Promise.all([
    prisma.leadStatus.findFirst({ where: { name: 'New' } }),
    prisma.tenantSettings.findFirst(),
  ])
  if (!newStatus) return { outcome: 'rejected', reason: 'No "New" status configured' }

  const lead = await prisma.lead.create({
    data: scoped({
      name,
      phone,
      email,
      company: input.company?.trim() || null,
      city: input.city?.trim() || null,
      industry: input.industry?.trim() || null,
      sourceId: source.id,
      statusId: newStatus.id,
      slaDueAt: new Date(Date.now() + (settings?.slaHours ?? 24) * 3_600_000),
    }),
  })
  await audit('lead.create', 'lead', lead.id, null, { name, phone, email, source: input.sourceName })

  if (input.ownerId) {
    await assignLead(lead.id, input.ownerId, { manual: true })
  } else {
    await runAssignmentRules(lead.id)
  }
  const assigned = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })
  return { outcome: 'created', lead: assigned }
}

/** Applies enabled assignment_rules by priority (FR-1.5). */
export async function runAssignmentRules(leadId: string): Promise<string | null> {
  const rules = await prisma.assignmentRule.findMany({
    where: { enabled: true },
    orderBy: { priority: 'asc' },
  })
  for (const rule of rules) {
    const targets = (rule.targetUserIds as string[]).filter(Boolean)
    if (targets.length === 0) continue
    if (rule.strategy === 'round_robin') {
      const pick = await pickRoundRobin(targets)
      if (pick) {
        await assignLead(leadId, pick, { ruleId: rule.id })
        return pick
      }
    }
    // territory / product_line / account_size strategies land with Q5 rule
    // data from BRB (doc 11) — criteria matching slots in here.
  }
  return null // unassigned — surfaces in the leads list for manual pickup
}

/** Least-recently-assigned active user among targets. */
async function pickRoundRobin(targetUserIds: string[]): Promise<string | null> {
  const active = await prisma.user.findMany({
    where: { id: { in: targetUserIds }, status: 'active' },
    select: { id: true },
  })
  if (active.length === 0) return null
  const lastAssignments = await prisma.leadAssignment.groupBy({
    by: ['assigneeId'],
    where: { assigneeId: { in: active.map((u) => u.id) } },
    _max: { at: true },
  })
  const lastByUser = new Map(lastAssignments.map((a) => [a.assigneeId, a._max.at?.getTime() ?? 0]))
  return active
    .map((u) => ({ id: u.id, last: lastByUser.get(u.id) ?? 0 }))
    .sort((a, b) => a.last - b.last)[0].id
}

export async function assignLead(
  leadId: string,
  assigneeId: string,
  opts: { manual?: boolean; ruleId?: string } = {},
) {
  const ctx = requireTenantContext()
  await prisma.lead.update({ where: { id: leadId }, data: { ownerId: assigneeId } })
  await prisma.leadAssignment.create({
    data: scoped({
      leadId,
      assigneeId,
      assignedBy: opts.manual ? (ctx.userId ?? null) : null,
      ruleId: opts.ruleId ?? null,
    }),
  })
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } })
  await audit('lead.assign', 'lead', leadId, null, { assigneeId, manual: !!opts.manual })
  await notify(assigneeId, 'lead.assigned', { name: lead.name, company: lead.company })
}
