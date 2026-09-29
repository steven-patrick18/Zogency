'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit } from '@/lib/audit'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'

export type ClientActionState = { error?: string; success?: string }

// Clients were created by the handover chain and then frozen — nothing in the
// app could correct a typo in a name or a GSTIN (BRB issue #1).
const clientSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1, 'Client name required').max(200),
  legalName: z.string().max(200).optional().or(z.literal('')),
  gstin: z.string().max(20).optional().or(z.literal('')),
  status: z.enum(['active', 'paused', 'churned']),
  ownerId: z.string().uuid().optional().or(z.literal('')),
})

export async function updateClientAction(
  _p: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  await requirePermission('clients.edit')
  const parsed = clientSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const d = parsed.data

  try {
    await withTenant(async () => {
      const before = await prisma.client.findUniqueOrThrow({ where: { id: d.clientId } })
      await prisma.client.update({
        where: { id: d.clientId },
        data: {
          name: d.name,
          legalName: d.legalName || null,
          gstin: d.gstin || null,
          status: d.status,
          ownerId: d.ownerId || null,
        },
      })
      await audit(
        'client.update',
        'client',
        d.clientId,
        { name: before.name, legalName: before.legalName, gstin: before.gstin, status: before.status, ownerId: before.ownerId },
        { name: d.name, legalName: d.legalName || null, gstin: d.gstin || null, status: d.status, ownerId: d.ownerId || null },
      )
    })
  } catch {
    return { error: 'Could not save the client' }
  }
  revalidatePath(`/clients/${d.clientId}`)
  revalidatePath('/clients')
  return { success: 'Client updated' }
}

const contactSchema = z.object({
  contactId: z.string().uuid(),
  clientId: z.string().uuid(),
  name: z.string().min(1, 'Contact name required').max(200),
  role: z.string().max(120).optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  isPrimary: z.coerce.boolean().optional(),
})

/** Correct a client contact's details (the other half of BRB issue #1). */
export async function updateClientContactAction(
  _p: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  await requirePermission('clients.edit')
  const parsed = contactSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const d = parsed.data

  try {
    await withTenant(async () => {
      const before = await prisma.clientContact.findUniqueOrThrow({ where: { id: d.contactId } })
      if (before.clientId !== d.clientId) throw new Error('Contact does not belong to this client')
      // One primary per client — promoting this one demotes the rest.
      if (d.isPrimary && !before.isPrimary) {
        await prisma.clientContact.updateMany({
          where: { clientId: d.clientId, isPrimary: true },
          data: { isPrimary: false },
        })
      }
      await prisma.clientContact.update({
        where: { id: d.contactId },
        data: {
          name: d.name,
          role: d.role || null,
          phone: d.phone || null,
          email: d.email ? d.email.toLowerCase() : null,
          isPrimary: d.isPrimary ?? false,
        },
      })
      await audit(
        'client.contact_update',
        'client_contact',
        d.contactId,
        { name: before.name, role: before.role, phone: before.phone, email: before.email, isPrimary: before.isPrimary },
        { name: d.name, role: d.role || null, phone: d.phone || null, email: d.email || null, isPrimary: d.isPrimary ?? false },
      )
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save the contact' }
  }
  revalidatePath(`/clients/${d.clientId}`)
  return { success: 'Contact updated' }
}
