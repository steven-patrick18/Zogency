'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePermission, requireSession, withTenant } from '@/lib/authz'
import { prisma, scoped } from '@/lib/db/prisma'
import { addRenewal, setRenewalStatus } from './service'

export type RetentionActionState = { error?: string; success?: string }
type S = RetentionActionState
const uuid = z.string().uuid()

export async function addRenewalAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('clients.edit')
  const clientId = uuid.parse(formData.get('clientId'))
  const renewalOn = String(formData.get('renewalOn') ?? '')
  const value = Number(formData.get('value'))
  if (!renewalOn || !value || value <= 0) return { error: 'Renewal date and value are required (FR-7.2)' }
  await withTenant(() =>
    addRenewal({
      clientId,
      renewalOn: new Date(renewalOn),
      value,
      contractRef: String(formData.get('contractRef') ?? '') || null,
    }),
  )
  revalidatePath('/retention')
  return { success: 'Renewal tracked — 60/30/15-day outreach triggers armed' }
}

export async function renewalStatusAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('clients.edit')
  const renewalId = uuid.parse(formData.get('renewalId'))
  const status = z.enum(['renewed', 'lost']).parse(formData.get('status'))
  await withTenant(() => setRenewalStatus(renewalId, status))
  revalidatePath('/retention')
  return { success: `Renewal marked ${status}` }
}

export async function addCheckinAction(_p: S, formData: FormData): Promise<S> {
  const session = await requirePermission('clients.edit')
  const clientId = uuid.parse(formData.get('clientId'))
  const scheduledAt = String(formData.get('scheduledAt') ?? '')
  if (!scheduledAt) return { error: 'Pick a date/time (FR-7.1)' }
  await withTenant(async () => {
    await prisma.client.findUniqueOrThrow({ where: { id: clientId } })
    await prisma.clientCheckin.create({
      data: scoped({ clientId, scheduledAt: new Date(scheduledAt), ownerId: session.user.id }),
    })
  })
  revalidatePath('/retention')
  return { success: 'Check-in scheduled' }
}

export async function holdCheckinAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('clients.edit')
  const checkinId = uuid.parse(formData.get('checkinId'))
  const notes = String(formData.get('notes') ?? '').trim()
  if (!notes) return { error: 'Log what was discussed' }
  await withTenant(() =>
    prisma.clientCheckin.update({ where: { id: checkinId }, data: { heldAt: new Date(), notes } }),
  )
  revalidatePath('/retention')
  return { success: 'Check-in logged' }
}

export async function addServiceAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('settings.manage')
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'Service name required' }
  await withTenant(() =>
    prisma.serviceCatalogItem.create({
      data: scoped({ name, priceBand: String(formData.get('priceBand') ?? '') || null }),
    }),
  )
  revalidatePath('/retention')
  return { success: 'Service added to catalogue' }
}

export async function addUpsellAction(_p: S, formData: FormData): Promise<S> {
  const session = await requireSession()
  await requirePermission('clients.edit')
  const clientId = uuid.parse(formData.get('clientId'))
  const serviceId = uuid.parse(formData.get('serviceId'))
  const value = Number(formData.get('value') ?? 0)
  await withTenant(async () => {
    await prisma.client.findUniqueOrThrow({ where: { id: clientId } })
    const { Prisma } = await import('@/generated/prisma/client')
    await prisma.upsellOpportunity.create({
      data: scoped({
        clientId,
        serviceId,
        value: value > 0 ? new Prisma.Decimal(value) : null,
        ownerId: session.user.id,
      }),
    })
  })
  revalidatePath('/retention')
  return { success: 'Upsell opportunity tracked (FR-7.5)' }
}

export async function moveUpsellAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('clients.edit')
  const upsellId = uuid.parse(formData.get('upsellId'))
  const stage = z.enum(['proposed', 'won', 'lost']).parse(formData.get('stage'))
  await withTenant(() => prisma.upsellOpportunity.update({ where: { id: upsellId }, data: { stage } }))
  revalidatePath('/retention')
  return { success: `Upsell ${stage}` }
}

export async function resolveChurnFlagAction(_p: S, formData: FormData): Promise<S> {
  await requirePermission('clients.edit')
  const flagId = uuid.parse(formData.get('flagId'))
  await withTenant(() =>
    prisma.churnFlag.update({ where: { id: flagId }, data: { resolvedAt: new Date() } }),
  )
  revalidatePath('/retention')
  return { success: 'Churn flag resolved' }
}

export async function toggleRuleAction(formData: FormData) {
  await requirePermission('automation.manage')
  const ruleId = uuid.parse(formData.get('ruleId'))
  await withTenant(async () => {
    const rule = await prisma.automationRule.findUniqueOrThrow({ where: { id: ruleId } })
    await prisma.automationRule.update({ where: { id: ruleId }, data: { enabled: !rule.enabled } })
  })
  revalidatePath('/settings/automation')
}
