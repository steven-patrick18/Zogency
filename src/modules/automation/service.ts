// Automation engine core (doc 08 §2). Domain code calls emitEvent() after
// state changes; enabled rules matching (triggerType, entityType) evaluate
// their conditions against the event data and execute actions. Every
// execution is recorded in automation_runs; the (rule, eventKey) unique
// makes redelivery idempotent.
import type { Prisma } from '@/generated/prisma/client'
import { prisma, scoped } from '@/lib/db/prisma'
import { notify } from '@/lib/notify'

export type AutomationEvent = {
  type: 'record_created' | 'status_changed' | 'sla_breach'
  entityType: string
  entityId: string
  /** Unique per occurrence — e.g. history row id — for idempotency. */
  eventKey: string
  data: Record<string, unknown> // flat fields conditions can reference
}

type Condition = { field: string; op: 'eq' | 'neq' | 'contains'; value: string }
type NotifyAction = { type: 'notify'; to: string; template: string }

function conditionsMatch(conditions: Condition[], data: Record<string, unknown>): boolean {
  return conditions.every((c) => {
    const actual = String(data[c.field] ?? '')
    if (c.op === 'eq') return actual === c.value
    if (c.op === 'neq') return actual !== c.value
    return actual.toLowerCase().includes(c.value.toLowerCase())
  })
}

/** Resolves an action target to user ids: 'owner' | 'role:<Name>'. */
async function resolveRecipients(to: string, data: Record<string, unknown>): Promise<string[]> {
  if (to === 'owner') {
    return data.ownerId ? [String(data.ownerId)] : []
  }
  if (to.startsWith('role:')) {
    const roleName = to.slice(5)
    const role = await prisma.role.findFirst({ where: { name: roleName } })
    if (!role) return []
    const members = await prisma.userRole.findMany({ where: { roleId: role.id } })
    return members.map((m) => m.userId)
  }
  return []
}

export async function emitEvent(event: AutomationEvent): Promise<void> {
  const rules = await prisma.automationRule.findMany({
    where: { enabled: true, triggerType: event.type, entityType: event.entityType },
    orderBy: { runOrder: 'asc' },
  })

  for (const rule of rules) {
    if (!conditionsMatch((rule.conditions as Condition[]) ?? [], event.data)) continue

    const executed: Array<Record<string, unknown>> = []
    let status = 'success'
    let error: string | null = null
    try {
      for (const action of (rule.actions as NotifyAction[]) ?? []) {
        if (action.type === 'notify') {
          const recipients = await resolveRecipients(action.to, event.data)
          for (const userId of recipients) {
            await notify(userId, action.template, event.data)
          }
          executed.push({ ...action, recipients: recipients.length })
        } else {
          // create_record / schedule / messaging actions land with their
          // modules (doc 08 §2 action catalog).
          executed.push({ ...action, skipped: 'action type not yet available' })
          status = 'partial'
        }
      }
    } catch (err) {
      status = 'failed'
      error = err instanceof Error ? err.message : String(err)
    }

    try {
      await prisma.automationRun.create({
        data: scoped({
          ruleId: rule.id,
          eventKey: event.eventKey,
          triggerEntityType: event.entityType,
          triggerEntityId: event.entityId,
          actionsExecuted: executed as Prisma.InputJsonValue,
          status,
          error,
        }),
      })
    } catch (err: unknown) {
      // P2002 → this rule already ran for this event (redelivery) — fine.
      if ((err as { code?: string }).code !== 'P2002') throw err
    }
  }
}

/**
 * First-contact SLA sweep (FR-2.5): leads past sla_due_at with no contact get
 * an escalation + notifications. Runs from the worker on a schedule in
 * production; in dev it is invoked opportunistically (throttled) on pipeline
 * page loads.
 */
// Dev-mode opportunistic trigger: page loads invoke this; at most one sweep
// per minute per process. The production worker replaces it with a cron job.
let lastSweepAt = 0
export async function maybeRunSlaSweep(): Promise<void> {
  if (Date.now() - lastSweepAt < 60_000) return
  lastSweepAt = Date.now()
  await runSlaSweep()
}

export async function runSlaSweep(): Promise<number> {
  const breached = await prisma.lead.findMany({
    where: {
      slaDueAt: { lt: new Date() },
      firstContactedAt: null,
      archivedAt: null,
      status: { isTerminal: false },
    },
  })
  let escalated = 0
  for (const lead of breached) {
    const existing = await prisma.slaEscalation.findFirst({
      where: { entityType: 'lead', entityId: lead.id, ruleRef: 'lead_first_contact_sla' },
    })
    if (existing) continue

    const managers = await resolveRecipients('role:Sales Manager', {})
    const recipients = [...new Set([...managers, ...(lead.ownerId ? [lead.ownerId] : [])])]
    await prisma.slaEscalation.create({
      data: scoped({
        entityType: 'lead',
        entityId: lead.id,
        ruleRef: 'lead_first_contact_sla',
        escalatedTo: recipients as unknown as Prisma.InputJsonValue,
      }),
    })
    for (const userId of recipients) {
      await notify(userId, 'lead.sla_breach', { name: lead.name, ownerId: lead.ownerId })
    }
    await emitEvent({
      type: 'sla_breach',
      entityType: 'lead',
      entityId: lead.id,
      eventKey: `sla:${lead.id}`,
      data: { name: lead.name, ownerId: lead.ownerId },
    })
    escalated++
  }
  return escalated
}
