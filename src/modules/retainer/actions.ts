'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { addRetainerSchedule } from './service'

export type RetainerActionState = { error?: string; success?: string }

const schema = z.object({
  clientId: z.string().uuid(),
  description: z.string().min(1),
  amount: z.coerce.number().positive(),
  billingDay: z.coerce.number().int().min(1).max(28),
})

export async function addRetainerScheduleAction(
  _p: RetainerActionState,
  formData: FormData,
): Promise<RetainerActionState> {
  await requirePermission('invoices.manage')
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const d = parsed.data
  await withTenant(() =>
    addRetainerSchedule({
      clientId: d.clientId,
      description: d.description,
      amount: d.amount,
      billingDay: d.billingDay,
    }),
  )
  revalidatePath('/invoices')
  return { success: 'Retainer schedule created' }
}

export async function toggleRetainerAction(formData: FormData) {
  await requirePermission('invoices.manage')
  const id = z.string().uuid().parse(formData.get('id'))
  await withTenant(async () => {
    const current = await prisma.retainerSchedule.findUniqueOrThrow({ where: { id } })
    await prisma.retainerSchedule.update({ where: { id }, data: { active: !current.active } })
  })
  revalidatePath('/invoices')
}
