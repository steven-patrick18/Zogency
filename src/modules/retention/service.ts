// Retention & renewal (doc 07 §5, FR-7.1–7.6).
import { Prisma } from '@/generated/prisma/client'
import { audit } from '@/lib/audit'
import { prisma, scoped } from '@/lib/db/prisma'
import { notify } from '@/lib/notify'

// FR-7.2: outreach triggers at 60/30/15 days before expiry. Worker cron in
// production; throttled opportunistic trigger on the retention page in dev.
const TRIGGER_DAYS = [60, 30, 15] as const

export async function runRenewalSweep(): Promise<number> {
  const now = Date.now()
  const renewals = await prisma.renewal.findMany({
    where: { status: { in: ['upcoming', 'in_progress'] } },
  })
  let fired = 0
  for (const renewal of renewals) {
    const daysLeft = Math.ceil((renewal.renewalOn.getTime() - now) / 86_400_000)
    const already = (renewal.triggersFired as number[]) ?? []
    const due = TRIGGER_DAYS.filter((t) => daysLeft <= t && !already.includes(t))
    if (due.length === 0) continue

    const client = await prisma.client.findUniqueOrThrow({ where: { id: renewal.clientId } })
    await prisma.renewal.update({
      where: { id: renewal.id },
      data: {
        status: 'in_progress',
        triggersFired: [...already, ...due] as unknown as Prisma.InputJsonValue,
      },
    })
    if (client.ownerId) {
      await notify(client.ownerId, 'renewal.due', {
        client: client.name, daysLeft, value: renewal.value.toString(),
      })
      // Outreach task for the account owner (doc 07 §5).
      await prisma.task.create({
        data: scoped({
          assigneeId: client.ownerId,
          title: `Renewal outreach — ${client.name} (${daysLeft}d to expiry, ₹${Number(renewal.value).toLocaleString('en-IN')})`,
          deadline: renewal.renewalOn,
          priority: daysLeft <= 15 ? 'urgent' : 'high',
        }),
      })
    }
    fired++
  }
  return fired
}

let lastRenewalSweep = 0
export async function maybeRunRenewalSweep(): Promise<void> {
  if (Date.now() - lastRenewalSweep < 60_000) return
  lastRenewalSweep = Date.now()
  await runRenewalSweep()
  await computeHealthScores()
}

/**
 * Client health score (FR-7.3) — default formula proposed in doc 07 §3.3 /
 * doc 11 Q9, pending BRB sign-off:
 *   score = payments(40%) + approvals(30%) + satisfaction(30%), each 0–100
 *   payments: avg days overdue in last 90d → 0d=100, ≥30d=0
 *   approvals: (proxy until portal) client task-approval turnaround → open
 *              overdue tasks ratio; no data = 80 (benefit of the doubt)
 *   satisfaction: latest survey (none yet in dev) → default 70 until surveys land
 * Bands: green ≥70, amber 40–69, red <40. Churn flag on red or 2× amber (FR-7.4).
 */
export async function computeHealthScores(): Promise<void> {
  const clients = await prisma.client.findMany({ where: { status: 'active', archivedAt: null } })
  for (const client of clients) {
    const invoices = await prisma.invoice.findMany({
      where: { clientId: client.id, createdAt: { gte: new Date(Date.now() - 90 * 86_400_000) } },
      include: { payments: true },
    })
    let paymentsScore = 100
    const overdueDays = invoices
      .filter((i) => i.status === 'overdue' || i.status === 'partial')
      .map((i) => Math.max(0, (Date.now() - i.dueOn.getTime()) / 86_400_000))
    if (overdueDays.length > 0) {
      const avg = overdueDays.reduce((s, d) => s + d, 0) / overdueDays.length
      paymentsScore = Math.max(0, Math.round(100 - (avg / 30) * 100))
    }

    const projects = await prisma.project.findMany({ where: { clientId: client.id }, select: { id: true } })
    const tasks = await prisma.task.findMany({ where: { projectId: { in: projects.map((p) => p.id) } } })
    const overdueTasks = tasks.filter((t) => t.deadline && t.deadline < new Date() && t.status !== 'done')
    const approvalsScore = tasks.length === 0 ? 80 : Math.max(0, Math.round(100 - (overdueTasks.length / tasks.length) * 100))

    const satisfactionScore = 70 // surveys land with the client portal (Phase 3)

    const score = Math.round(paymentsScore * 0.4 + approvalsScore * 0.3 + satisfactionScore * 0.3)
    const band = score >= 70 ? 'green' : score >= 40 ? 'amber' : 'red'

    const last = await prisma.clientHealthScore.findFirst({
      where: { clientId: client.id },
      orderBy: { computedAt: 'desc' },
    })
    // Append-only weekly cadence: skip if computed in the last 6 days with the same band.
    if (last && last.band === band && Date.now() - last.computedAt.getTime() < 6 * 86_400_000) continue

    await prisma.clientHealthScore.create({
      data: scoped({
        clientId: client.id,
        score,
        band,
        components: { payments: paymentsScore, approvals: approvalsScore, survey: satisfactionScore } as Prisma.InputJsonValue,
      }),
    })

    // Churn flag (FR-7.4): red, or two consecutive ambers.
    const shouldFlag = band === 'red' || (band === 'amber' && last?.band === 'amber')
    if (shouldFlag) {
      const open = await prisma.churnFlag.findFirst({ where: { clientId: client.id, resolvedAt: null } })
      if (!open) {
        const recipients = new Set<string>()
        if (client.ownerId) recipients.add(client.ownerId)
        const managers = await prisma.role.findFirst({
          where: { name: 'Sales Manager' }, include: { userRoles: true },
        })
        managers?.userRoles.forEach((ur) => recipients.add(ur.userId))
        await prisma.churnFlag.create({
          data: scoped({
            clientId: client.id,
            reason: `Health ${band} (score ${score}): payments ${paymentsScore}, approvals ${approvalsScore}`,
            severity: band === 'red' ? 'high' : 'watch',
            escalatedTo: [...recipients] as unknown as Prisma.InputJsonValue,
          }),
        })
        for (const userId of recipients) {
          await notify(userId, 'client.churn_risk', { client: client.name, score, band })
        }
      }
    }
  }
}

export async function addRenewal(input: {
  clientId: string
  renewalOn: Date
  value: number
  contractRef?: string | null
}) {
  const renewal = await prisma.renewal.create({
    data: scoped({
      clientId: input.clientId,
      renewalOn: input.renewalOn,
      value: new Prisma.Decimal(input.value),
      contractRef: input.contractRef ?? null,
    }),
  })
  await audit('renewal.create', 'client', input.clientId, null, { renewalOn: input.renewalOn.toISOString() })
  return renewal
}

export async function setRenewalStatus(renewalId: string, status: 'renewed' | 'lost') {
  const renewal = await prisma.renewal.findUniqueOrThrow({ where: { id: renewalId } })
  await prisma.renewal.update({ where: { id: renewalId }, data: { status } })
  await audit('renewal.status', 'client', renewal.clientId, { status: renewal.status }, { status })
}
