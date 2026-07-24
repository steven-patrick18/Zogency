'use server'

import { z } from 'zod'
import { audit } from '@/lib/audit'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'

// Reveals a masked lead's full contact — every reveal is audit-logged so
// number harvesting leaves a trail (privacy vault, doc 11 O1).
export async function revealContactAction(
  _prev: { phone?: string; email?: string; error?: string },
  formData: FormData,
): Promise<{ phone?: string; email?: string; error?: string }> {
  await requirePermission('calls.log') // anyone who can call may reveal to dial
  const leadId = z.string().uuid().parse(formData.get('leadId'))
  return withTenant(async () => {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { phone: true, email: true, name: true },
    })
    if (!lead) return { error: 'Lead not found' }
    await audit('lead.contact_revealed', 'lead', leadId, null, { name: lead.name })
    return { phone: lead.phone ?? '—', email: lead.email ?? '—' }
  })
}
