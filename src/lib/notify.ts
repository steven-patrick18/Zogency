// Notification service (doc 08 §4). Phase 1 S1: in-app rows; email/WhatsApp
// adapters attach in S4 via ports — this call-site contract stays stable.
import type { Prisma } from '@/generated/prisma/client'
import { prisma, scoped } from '@/lib/db/prisma'

export async function notify(
  userId: string,
  templateKey: string,
  payload: Record<string, unknown> = {},
) {
  await prisma.notification.create({
    data: scoped({
      userId,
      channel: 'in_app' as const,
      templateKey,
      payload: payload as Prisma.InputJsonValue,
      status: 'sent' as const,
      deliveredAt: new Date(),
    }),
  })
}

/** Renders a template key + payload into display text (in-app center). */
export function renderNotification(templateKey: string, payload: Record<string, unknown>): string {
  const templates: Record<string, (p: Record<string, unknown>) => string> = {
    'user.created': (p) => `Your Zogency account was created — welcome, ${p.name ?? ''}!`,
    'user.roles_changed': (p) => `Your roles were updated to: ${(p.roles as string[])?.join(', ') ?? ''}`,
    'license.expiring': (p) => `The workspace license expires on ${p.expiresAt} — renew soon.`,
    'lead.assigned': (p) => `New lead assigned to you: ${p.name}${p.company ? ` (${p.company})` : ''} — contact within SLA.`,
    'lead.reengagement': (p) => `Closed lead "${p.name}" submitted a new enquiry — possible re-engagement.`,
    'lead.followup_due': (p) => `"${p.name}" moved to Follow-up — schedule the next touchpoint.`,
    'lead.meeting_scheduled': (p) => `Meeting scheduled with "${p.name}" — prepare discovery notes.`,
    'lead.sla_breach': (p) => `SLA breached: "${p.name}" has not been contacted within the SLA window.`,
    'approval.requested': (p) => `Approval needed: ${p.summary}`,
    'approval.decided': (p) => `Your approval request was ${p.decision}: ${p.summary}`,
    'client.handover': (p) => `New client handover: ${p.client} (${p.deliverables} SoW deliverables) — project, checklist and draft invoice created.`,
    'invoice.overdue': (p) => `Invoice ${p.number} for ${p.client} is overdue (₹${p.total}).`,
    'campaign.launched': (p) => `Campaign "${p.name}" is live — confirm the launch to the client (FR-3.15).`,
    'hr.new_hire': (p) => `${p.name} joins your team as ${p.designation} — onboarding checklist created.`,
    'hr.leave_requested': (p) => `${p.name} requested ${p.days} day(s) of leave — review in HR.`,
    'hr.leave_decided': (p) => `Your leave request (${p.days} day(s)) was ${p.decision}.`,
    'renewal.due': (p) => `Renewal due in ${p.daysLeft} days: ${p.client} (₹${p.value}) — outreach task created.`,
    'client.churn_risk': (p) => `Churn risk: ${p.client} health is ${p.band} (${p.score}/100) — review the account.`,
    'vendor.installed': (p) => `✔ ${p.company} installed at https://${p.domain} — share the setup link with them.`,
    'portal.approved': (p) => `${p.by} approved "${p.name}" in the client portal.`,
    'portal.revision': (p) => `${p.by} requested a revision on "${p.name}" via the portal.`,
    'ticket.new': (p) => `New support ticket from ${p.client}: "${p.subject}"`,
    'ticket.resolved': (p) => `Your ticket "${p.subject}" was marked resolved.`,
    'chat.mention': (p) => `${p.by} mentioned you in #${p.channel}.`,
    'chat.dm': (p) => `${p.by} sent you a direct message.`,
    'task.assigned': (p) => `${p.by} assigned you a task: "${p.title}"${p.deadline ? ` — due ${p.deadline}` : ''}.`,
    'task.status_changed': (p) =>
      p.status === 'done'
        ? `Task "${p.title}" was completed by ${p.by}.`
        : `Task "${p.title}" moved to ${String(p.status).replace('_', ' ')} by ${p.by}.`,
  }
  return templates[templateKey]?.(payload) ?? templateKey
}
