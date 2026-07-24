'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit } from '@/lib/audit'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma, scoped } from '@/lib/db/prisma'
import { assignLead } from '@/modules/leads/service'
import { ensureDealForLead } from '@/modules/deals/service'
import { changeLeadStatus } from './service'

export type ActionState = { error?: string; success?: string }

const statusChangeSchema = z.object({
  leadId: z.string().uuid(),
  toStatusId: z.string().uuid(),
  comment: z.string().min(1, 'A comment is required for every status change'),
})

export async function changeStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission('pipeline.change_status')
  const parsed = statusChangeSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const result = await withTenant(() =>
    changeLeadStatus(parsed.data.leadId, parsed.data.toStatusId, parsed.data.comment),
  )
  if (!result.ok) return { error: result.error }
  revalidatePath('/pipeline')
  revalidatePath(`/leads/${parsed.data.leadId}`)
  revalidatePath('/leads')
  return { success: 'Status updated' }
}

const bantSchema = z.object({
  leadId: z.string().uuid(),
  budgetRange: z.string().min(1, 'Budget is required'),
  authority: z.string().min(1, 'Authority (decision-maker) is required'),
  need: z.string().min(1, 'Need is required'),
  timeline: z.string().min(1, 'Timeline is required'),
})

export async function saveBantAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requirePermission('pipeline.change_status')
  const parsed = bantSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'All four BANT fields are required' }
  const { leadId, ...fields } = parsed.data

  await withTenant(async () => {
    await prisma.lead.findUniqueOrThrow({ where: { id: leadId } }) // tenant-guarded existence
    const existing = await prisma.bantQualification.findUnique({ where: { leadId } })
    if (existing) {
      await prisma.bantQualification.update({ where: { leadId }, data: fields })
    } else {
      await prisma.bantQualification.create({
        data: scoped({ leadId, ...fields, qualifiedBy: session.user.id }),
      })
    }
    await audit('lead.bant_saved', 'lead', leadId, null, fields)
    // Qualification complete → the deal record opens (ADR-004).
    await ensureDealForLead(leadId)
  })
  revalidatePath(`/leads/${leadId}`)
  return { success: 'BANT qualification saved — deal opened' }
}

const reassignSchema = z.object({
  leadId: z.string().uuid(),
  assigneeId: z.string().uuid(),
})

export async function reassignLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission('leads.reassign')
  const parsed = reassignSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Pick a team member' }

  await withTenant(async () => {
    await prisma.user.findUniqueOrThrow({ where: { id: parsed.data.assigneeId } })
    await assignLead(parsed.data.leadId, parsed.data.assigneeId, { manual: true })
  })
  revalidatePath(`/leads/${parsed.data.leadId}`)
  revalidatePath('/leads')
  return { success: 'Lead reassigned' }
}
