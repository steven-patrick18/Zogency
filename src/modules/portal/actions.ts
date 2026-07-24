'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { runWithTenant } from '@/lib/db/context'
import { prisma, prismaUnscoped, scoped } from '@/lib/db/prisma'
import { notify } from '@/lib/notify'
import { clearPortalCookie, getPortalSession, setPortalCookie } from '@/lib/portal-session'

export type PortalLoginState = { error?: string }

// ── Auth ────────────────────────────────────────────────────────────────────

export async function portalLoginAction(_p: PortalLoginState, formData: FormData): Promise<PortalLoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  if (!email || !password) return { error: 'Email and password required' }

  const contact = await prismaUnscoped.clientContact.findFirst({
    where: { email, portalEnabled: true, portalPasswordHash: { not: null } },
    include: { client: true },
  })
  if (!contact?.portalPasswordHash || !(await bcrypt.compare(password, contact.portalPasswordHash))) {
    return { error: 'Invalid email or password' }
  }
  await setPortalCookie({
    contactId: contact.id,
    clientId: contact.clientId,
    tenantId: contact.tenantId,
    name: contact.name,
  })
  redirect('/portal')
}

export async function portalLogoutAction() {
  await clearPortalCookie()
  redirect('/portal/login')
}

// Set password via the one-time invite link.
export async function portalSetPasswordAction(_p: PortalLoginState, formData: FormData): Promise<PortalLoginState> {
  const token = String(formData.get('token') ?? '')
  const password = String(formData.get('password') ?? '')
  if (password.length < 8) return { error: 'Password must be at least 8 characters' }
  const contact = await prismaUnscoped.clientContact.findUnique({ where: { portalInviteToken: token } })
  if (!contact) return { error: 'This invite link is invalid or already used.' }
  await prismaUnscoped.clientContact.update({
    where: { id: contact.id },
    data: {
      portalPasswordHash: await bcrypt.hash(password, 12),
      portalEnabled: true,
      portalInviteToken: null,
    },
  })
  await setPortalCookie({
    contactId: contact.id,
    clientId: contact.clientId,
    tenantId: contact.tenantId,
    name: contact.name,
  })
  redirect('/portal')
}

// ── Portal actions (require a portal session) ───────────────────────────────

async function requirePortal() {
  const session = await getPortalSession()
  if (!session) redirect('/portal/login')
  return session
}

/** Client approves final creative → records a client_signoff + advances. */
export async function portalApproveCampaignAction(formData: FormData) {
  const session = await requirePortal()
  const campaignId = z.string().uuid().parse(formData.get('campaignId'))
  await runWithTenant({ tenantId: session.tenantId, userId: session.contactId }, async () => {
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, clientId: session.clientId } })
    if (!campaign) return
    await prisma.clientSignoff.create({
      data: scoped({
        campaignId,
        scope: 'final',
        method: 'logged_written',
        evidence: `Approved via client portal by ${session.name}`,
        signedBy: session.name,
      }),
    })
    if (campaign.managerId) {
      await notify(campaign.managerId, 'portal.approved', { name: campaign.name, by: session.name })
    }
  })
  revalidatePath('/portal')
}

/** Client requests a revision → logs a revision round for the team. */
export async function portalRequestRevisionAction(formData: FormData) {
  const session = await requirePortal()
  const campaignId = z.string().uuid().parse(formData.get('campaignId'))
  const feedback = String(formData.get('feedback') ?? '').trim()
  if (!feedback) return
  await runWithTenant({ tenantId: session.tenantId, userId: session.contactId }, async () => {
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, clientId: session.clientId } })
    if (!campaign) return
    const roundNo = (await prisma.revisionRound.count({ where: { campaignId, source: 'client' } })) + 1
    await prisma.revisionRound.create({
      data: scoped({ campaignId, roundNo, feedback, source: 'client', loggedBy: null }),
    })
    if (campaign.managerId) {
      await notify(campaign.managerId, 'portal.revision', { name: campaign.name, by: session.name })
    }
  })
  revalidatePath('/portal')
}

export async function portalCreateTicketAction(_p: { error?: string }, formData: FormData): Promise<{ error?: string; success?: string }> {
  const session = await requirePortal()
  const subject = String(formData.get('subject') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()
  if (!subject || !body) return { error: 'Subject and message are required' }
  await runWithTenant({ tenantId: session.tenantId, userId: session.contactId }, async () => {
    const client = await prisma.client.findUniqueOrThrow({ where: { id: session.clientId } })
    const ticket = await prisma.supportTicket.create({
      data: scoped({ clientId: session.clientId, contactId: session.contactId, subject }),
    })
    await prisma.ticketMessage.create({
      data: scoped({ ticketId: ticket.id, authorKind: 'client', authorName: session.name, body }),
    })
    if (client.ownerId) {
      await notify(client.ownerId, 'ticket.new', { subject, client: client.name })
    }
  })
  revalidatePath('/portal/support')
  return { success: 'Ticket raised — the team has been notified.' }
}

export async function portalReplyTicketAction(formData: FormData) {
  const session = await requirePortal()
  const ticketId = z.string().uuid().parse(formData.get('ticketId'))
  const body = String(formData.get('body') ?? '').trim()
  if (!body) return
  await runWithTenant({ tenantId: session.tenantId, userId: session.contactId }, async () => {
    const ticket = await prisma.supportTicket.findFirst({ where: { id: ticketId, clientId: session.clientId } })
    if (!ticket) return
    await prisma.ticketMessage.create({
      data: scoped({ ticketId, authorKind: 'client', authorName: session.name, body }),
    })
    await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: 'open' } })
  })
  revalidatePath('/portal/support')
}
