'use server'

// Staff-side: invite a client contact to the portal + manage tickets.
import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit } from '@/lib/audit'
import { requirePermission, requireSession, withTenant } from '@/lib/authz'
import { prisma, scoped } from '@/lib/db/prisma'
import { notify } from '@/lib/notify'

export type PortalInviteState = { error?: string; success?: string; inviteLink?: string }

export async function invitePortalContactAction(_p: PortalInviteState, formData: FormData): Promise<PortalInviteState> {
  await requirePermission('clients.edit')
  const contactId = z.string().uuid().parse(formData.get('contactId'))
  const token = randomBytes(24).toString('base64url')
  const domain = process.env.AUTH_URL ?? 'https://your-domain'
  await withTenant(async () => {
    const contact = await prisma.clientContact.findUniqueOrThrow({ where: { id: contactId } })
    if (!contact.email) throw new Error('Contact needs an email to invite')
    await prisma.clientContact.update({
      where: { id: contactId },
      data: { portalInviteToken: token, portalEnabled: true },
    })
    await audit('portal.invited', 'client_contact', contactId, null, { email: contact.email })
  })
  revalidatePath('/clients')
  return { success: 'Invite created — share this one-time link with the client:', inviteLink: `${domain}/portal/setup/${token}` }
}

// ── Staff ticket handling ────────────────────────────────────────────────────

export async function staffReplyTicketAction(formData: FormData) {
  const session = await requireSession()
  await requirePermission('clients.view')
  const ticketId = z.string().uuid().parse(formData.get('ticketId'))
  const body = String(formData.get('body') ?? '').trim()
  if (!body) return
  await withTenant(async () => {
    await prisma.ticketMessage.create({
      data: scoped({ ticketId, authorKind: 'staff', authorId: session.user.id, authorName: session.user.name ?? 'Team', body }),
    })
    await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: 'in_progress' } })
  })
  revalidatePath('/support')
  return
}

export async function setTicketStatusAction(formData: FormData) {
  await requirePermission('clients.view')
  const ticketId = z.string().uuid().parse(formData.get('ticketId'))
  const status = z.enum(['open', 'in_progress', 'resolved', 'closed']).parse(formData.get('status'))
  await withTenant(async () => {
    const ticket = await prisma.supportTicket.update({ where: { id: ticketId }, data: { status } })
    if (status === 'resolved' && ticket.contactId) {
      const contact = await prisma.clientContact.findUnique({ where: { id: ticket.contactId } })
      if (contact) await notify(ticket.contactId!, 'ticket.resolved', { subject: ticket.subject }).catch(() => {})
    }
  })
  revalidatePath('/support')
}
