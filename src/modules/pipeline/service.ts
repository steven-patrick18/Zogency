// Status workflow service (doc 04 §4, FR-2.6–2.10).
// Every transition: mandatory comment → append-only history row → audit.
// Gates: BANT before leaving Connected forward (doc 11 Q7), junk reason,
// terminal statuses locked.
import { audit } from '@/lib/audit'
import { requireTenantContext } from '@/lib/db/context'
import { prisma, scoped } from '@/lib/db/prisma'

export type StatusChangeResult = { ok: true } | { ok: false; error: string }

export async function changeLeadStatus(
  leadId: string,
  toStatusId: string,
  comment: string,
): Promise<StatusChangeResult> {
  const ctx = requireTenantContext()
  const body = comment.trim()
  if (!body) return { ok: false, error: 'A comment is required for every status change (FR-2.7).' }

  const [lead, toStatus] = await Promise.all([
    prisma.lead.findUnique({ where: { id: leadId }, include: { status: true } }),
    prisma.leadStatus.findUnique({ where: { id: toStatusId } }),
  ])
  if (!lead) return { ok: false, error: 'Lead not found' }
  if (!toStatus) return { ok: false, error: 'Unknown status' }
  if (toStatus.id === lead.statusId) return { ok: false, error: 'Lead is already in that status' }

  if (lead.status.isTerminal) {
    return { ok: false, error: `Lead is ${lead.status.name} — terminal statuses are locked.` }
  }

  // BANT gate (FR-2.10, doc 11 Q7): leaving Connected for any forward status
  // (not Junk) requires a completed qualification.
  const isForward = toStatus.sort > lead.status.sort && !toStatus.isJunk
  if (lead.status.name === 'Connected' && isForward) {
    const bant = await prisma.bantQualification.findUnique({ where: { leadId } })
    if (!bant) {
      return {
        ok: false,
        error: 'Complete BANT qualification (Budget, Authority, Need, Timeline) before moving this lead forward.',
      }
    }
  }

  // Won gate placeholder: full SoW-mandatory-before-Won lands with deals (S5).
  // Until then Won is reachable so BRB can practice the flow end to end.

  await prisma.$transaction(async (tx) => {
    const commentRow = await tx.comment.create({
      data: scoped({
        entityType: 'lead',
        entityId: leadId,
        authorId: ctx.userId ?? null,
        body,
      }),
    })
    await tx.leadStatusHistory.create({
      data: scoped({
        leadId,
        fromStatusId: lead.statusId,
        toStatusId: toStatus.id,
        commentId: commentRow.id,
        actorId: ctx.userId ?? null,
      }),
    })
    await tx.lead.update({
      where: { id: leadId },
      data: {
        statusId: toStatus.id,
        junkReason: toStatus.isJunk ? body : lead.junkReason,
        // First forward move out of New = initial outreach done (proxy until
        // call logging lands in S4, which will set this from the call record).
        firstContactedAt:
          lead.firstContactedAt ?? (lead.status.name === 'New' ? new Date() : null),
      },
    })
  })
  await audit('lead.status_change', 'lead', leadId,
    { status: lead.status.name }, { status: toStatus.name, comment: body })
  return { ok: true }
}

export type TimelineEntry = {
  at: Date
  kind: 'status' | 'comment' | 'assignment'
  actorId: string | null
  text: string
}

/** Single chronological timeline (FR-2.9): status changes + comments + assignments. */
export async function getLeadTimeline(leadId: string): Promise<TimelineEntry[]> {
  const [history, comments, assignments, statuses, users] = await Promise.all([
    prisma.leadStatusHistory.findMany({ where: { leadId } }),
    prisma.comment.findMany({ where: { entityType: 'lead', entityId: leadId } }),
    prisma.leadAssignment.findMany({ where: { leadId } }),
    prisma.leadStatus.findMany(),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ])
  const statusName = new Map(statuses.map((s) => [s.id, s.name]))
  const userName = new Map(users.map((u) => [u.id, u.name]))
  const historyCommentIds = new Set(history.map((h) => h.commentId))

  const entries: TimelineEntry[] = [
    ...history.map((h) => ({
      at: h.at,
      kind: 'status' as const,
      actorId: h.actorId,
      text: `${h.fromStatusId ? statusName.get(h.fromStatusId) : 'New'} → ${statusName.get(h.toStatusId)}: ${comments.find((c) => c.id === h.commentId)?.body ?? ''}`,
    })),
    // Standalone comments only — transition comments render with their status row.
    ...comments
      .filter((c) => !historyCommentIds.has(c.id))
      .map((c) => ({ at: c.createdAt, kind: 'comment' as const, actorId: c.authorId, text: c.body })),
    ...assignments.map((a) => ({
      at: a.at,
      kind: 'assignment' as const,
      actorId: a.assignedBy,
      text: `Assigned to ${userName.get(a.assigneeId) ?? 'unknown'}${a.assignedBy ? ` by ${userName.get(a.assignedBy)}` : ' (auto-rule)'}`,
    })),
  ]
  return entries.sort((a, b) => b.at.getTime() - a.at.getTime())
}
