'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit } from '@/lib/audit'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma, scoped } from '@/lib/db/prisma'

export type RoutingActionState = { error?: string; success?: string }

// Lead routing was seed-only: the round-robin rule captured whoever held the
// Sales Rep role at install time and nothing could ever change it, so reps
// hired later never entered the rotation and leads silently landed unassigned.

const saveSchema = z.object({
  ruleId: z.string().uuid().optional().or(z.literal('')),
  name: z.string().min(1, 'Rule name required').max(120),
})

/** Replace a rule's target set (repeated `targetUserIds` fields). */
export async function saveRoutingRuleAction(
  _p: RoutingActionState,
  formData: FormData,
): Promise<RoutingActionState> {
  await requirePermission('automation.manage')
  const parsed = saveSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const uuid = z.string().uuid()
  const targetUserIds = [
    ...new Set(formData.getAll('targetUserIds').map(String).filter((v) => uuid.safeParse(v).success)),
  ]
  if (targetUserIds.length === 0) {
    return { error: 'Pick at least one person — a rule with no targets is skipped and leads stay unassigned.' }
  }

  try {
    await withTenant(async () => {
      // Targets must be active users in this tenant; the scoped client keeps
      // the lookup tenant-bound, so a foreign id simply will not match.
      const valid = await prisma.user.findMany({
        where: { id: { in: targetUserIds }, status: 'active' },
        select: { id: true },
      })
      if (valid.length === 0) throw new Error('None of the selected people are active users')
      const ids = valid.map((u) => u.id)

      if (parsed.data.ruleId) {
        const before = await prisma.assignmentRule.findUniqueOrThrow({ where: { id: parsed.data.ruleId } })
        await prisma.assignmentRule.update({
          where: { id: parsed.data.ruleId },
          data: { name: parsed.data.name, targetUserIds: ids },
        })
        await audit(
          'assignment_rule.update',
          'assignment_rule',
          parsed.data.ruleId,
          { name: before.name, targets: (before.targetUserIds as string[]).length },
          { name: parsed.data.name, targets: ids.length },
        )
      } else {
        const created = await prisma.assignmentRule.create({
          data: scoped({ name: parsed.data.name, strategy: 'round_robin', targetUserIds: ids, priority: 0 }),
        })
        await audit('assignment_rule.create', 'assignment_rule', created.id, null, {
          name: parsed.data.name,
          targets: ids.length,
        })
      }
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save the routing rule' }
  }
  revalidatePath('/settings/automation')
  return { success: 'Lead routing saved' }
}

export async function toggleRoutingRuleAction(formData: FormData): Promise<void> {
  await requirePermission('automation.manage')
  const id = z.string().uuid().parse(formData.get('ruleId'))
  await withTenant(async () => {
    const rule = await prisma.assignmentRule.findUniqueOrThrow({ where: { id } })
    await prisma.assignmentRule.update({ where: { id }, data: { enabled: !rule.enabled } })
    await audit('assignment_rule.toggle', 'assignment_rule', id, { enabled: rule.enabled }, { enabled: !rule.enabled })
  })
  revalidatePath('/settings/automation')
}
