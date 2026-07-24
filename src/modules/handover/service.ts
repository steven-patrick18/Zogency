// The Won handover chain (doc 04 §7: FR-2.19–2.21, FR-5.1–5.5, FR-6.1).
// Runs when a deal closes Won: client + contact + handover + onboarding
// checklist + delivery project + tasks from SoW + draft invoice + notifications.
import { audit } from '@/lib/audit'
import { prisma, scoped } from '@/lib/db/prisma'
import { notify } from '@/lib/notify'
import { createInvoice } from '@/modules/invoices/service'

// Base onboarding items generated for every new client (FR-5.4); SoW-specific
// items are appended per deliverable service. Service-keyed templates
// (onboarding_templates) become Admin-editable in Phase 2.
const BASE_ONBOARDING = [
  'Schedule kickoff call with client',
  'Collect brand assets & access credentials',
  'Share welcome pack & points of contact',
  'Raise first invoice',
]

export async function executeHandoverChain(dealId: string): Promise<{ clientId: string }> {
  const deal = await prisma.deal.findUniqueOrThrow({
    where: { id: dealId },
    include: { lead: true, discoveryNotes: { orderBy: { createdAt: 'desc' }, take: 1 } },
  })
  const deliverables = await prisma.sowDeliverable.findMany({ where: { dealId } })
  const lead = deal.lead

  // FR-5.1 — client profile merging the lead-to-Won history.
  const client = await prisma.client.create({
    data: scoped({
      name: lead.company ?? lead.name,
      originLeadId: lead.id,
      originDealId: deal.id,
      ownerId: deal.ownerId ?? lead.ownerId,
    }),
  })
  await prisma.clientContact.create({
    data: scoped({
      clientId: client.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      isPrimary: true,
    }),
  })

  // FR-2.20 — structured handover with account context + commitments.
  const discovery = deal.discoveryNotes[0]
  const handover = await prisma.handover.create({
    data: scoped({
      dealId: deal.id,
      clientId: client.id,
      accountContext: discovery
        ? `Challenges: ${discovery.businessChallenges}. Requirements: ${discovery.requirements}.`
        : `Won from lead ${lead.name}.`,
      commitments: deliverables.map((d) => `${d.serviceName}: ${d.description}`).join(' | ') || 'See SoW',
      completedAt: new Date(),
      // FR-2.21 — kickoff auto-scheduled; CalendarPort event on vendor setup.
      kickoffScheduledAt: new Date(Date.now() + 2 * 86_400_000),
    }),
  })

  // FR-5.4 — onboarding checklist.
  for (const [i, title] of BASE_ONBOARDING.entries()) {
    await prisma.onboardingChecklistItem.create({
      data: scoped({
        clientId: client.id,
        title,
        assigneeId: client.ownerId,
        dueOn: new Date(Date.now() + (i + 2) * 86_400_000),
      }),
    })
  }

  // FR-6.1 — delivery project; retainer if any recurring deliverable.
  const isRetainer = deliverables.some((d) => d.frequency !== 'one_time')
  const project = await prisma.project.create({
    data: scoped({
      clientId: client.id,
      handoverId: handover.id,
      name: `${client.name} — ${isRetainer ? 'Retainer' : 'Project'}`,
      type: isRetainer ? 'retainer' : 'one_off',
      startOn: new Date(),
    }),
  })

  // FR-6.3 — one trackable task per SoW line item (FR-5.3), department matched
  // by service name where possible.
  const departments = await prisma.department.findMany()
  for (const d of deliverables) {
    const dept = departments.find((dep) =>
      d.serviceName.toLowerCase().includes(dep.name.toLowerCase()),
    )
    await prisma.task.create({
      data: scoped({
        projectId: project.id,
        departmentId: dept?.id ?? null,
        assigneeId: client.ownerId,
        sowDeliverableId: d.id,
        title: `${d.serviceName} — ${d.description}`.slice(0, 200),
        deadline: d.deadline,
        priority: 'medium',
      }),
    })
  }

  // FR-2.19 — order to Finance: draft invoice for the deal value.
  await createInvoice({
    clientId: client.id,
    projectId: project.id,
    lineItems: [
      {
        description: `As per contract — ${client.name} (${deliverables.length} deliverables)`,
        rate: Number(deal.value ?? 0),
      },
    ],
  })

  // FR-5.5 — notify Delivery + Finance with full context available.
  const roles = await prisma.role.findMany({
    where: { name: { in: ['Delivery', 'Finance'] } },
    include: { userRoles: true },
  })
  const recipients = new Set<string>(roles.flatMap((r) => r.userRoles.map((ur) => ur.userId)))
  if (client.ownerId) recipients.add(client.ownerId)
  for (const userId of recipients) {
    await notify(userId, 'client.handover', { client: client.name, deliverables: deliverables.length })
  }

  await audit('handover.complete', 'client', client.id, null, {
    dealId: deal.id, projectId: project.id, deliverables: deliverables.length,
  })
  return { clientId: client.id }
}
