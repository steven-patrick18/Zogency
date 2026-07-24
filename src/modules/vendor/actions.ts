'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit } from '@/lib/audit'
import { requirePermission, withTenant } from '@/lib/authz'
import { encryptJson } from '@/lib/crypto'
import { prisma, scoped } from '@/lib/db/prisma'
import { issueLicense, issuerConfigured } from '@/lib/license-issuer'
import { vendorModeEnabled } from './config'
import { startProvisioning } from './provision'

export type VendorActionState = { error?: string; success?: string }

const clientSchema = z.object({
  companyName: z.string().min(1, 'Company name required'),
  contactEmail: z.string().email('Valid client email required'),
  domain: z
    .string()
    .min(4)
    .regex(/^[a-z0-9.-]+$/i, 'Domain only — no https:// or paths'),
  serverIp: z.string().min(7, 'Server IP required'),
  sshUser: z.string().min(1).default('root'),
  sshPassword: z.string().min(1, 'SSH password required'),
  plan: z.enum(['pro', 'starter']).default('pro'),
  seats: z.coerce.number().int().min(1).max(500).default(15),
  days: z.coerce.number().int().min(7).max(1095).default(365),
})

export async function createClientInstallAction(
  _prev: VendorActionState,
  formData: FormData,
): Promise<VendorActionState> {
  const session = await requirePermission('settings.manage')
  if (!vendorModeEnabled()) return { error: 'Vendor mode is not enabled on this server' }
  if (!issuerConfigured()) {
    return { error: 'ZOGENCY_LICENSE_PRIVATE_KEY is not set — add it to .env.production first' }
  }
  const parsed = clientSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const d = parsed.data

  const { key, claims } = issueLicense({
    customer: d.companyName,
    plan: d.plan,
    seats: d.seats,
    days: d.days,
  })

  const clientId = await withTenant(async () => {
    const row = await prisma.vendorClient.create({
      data: scoped({
        companyName: d.companyName,
        contactEmail: d.contactEmail.toLowerCase(),
        domain: d.domain.toLowerCase(),
        serverIp: d.serverIp,
        sshUser: d.sshUser,
        sshPasswordEnc: encryptJson({ password: d.sshPassword }),
        licenseKey: key,
        licenseExpiresAt: new Date(claims.expiresAt),
        plan: d.plan,
        seats: d.seats,
      }),
    })
    await audit('vendor.client_created', 'vendor_client', row.id, null, {
      company: d.companyName, domain: d.domain, plan: d.plan, seats: d.seats,
    })
    return row.id
  })

  startProvisioning(session.user.tenantId, clientId, session.user.id)
  revalidatePath('/vendor')
  return { success: `License issued and installation started for ${d.companyName} — watch the status below.` }
}

export async function retryInstallAction(
  _prev: VendorActionState,
  formData: FormData,
): Promise<VendorActionState> {
  const session = await requirePermission('settings.manage')
  const clientId = z.string().uuid().parse(formData.get('clientId'))
  const sshPassword = String(formData.get('sshPassword') ?? '').trim()

  const result = await withTenant(async () => {
    const client = await prisma.vendorClient.findUniqueOrThrow({ where: { id: clientId } })
    if (client.status === 'installing') return { error: 'Install already running' }
    if (!client.sshPasswordEnc && !sshPassword) {
      return { error: 'Re-enter the SSH password to retry (credentials were cleared)' }
    }
    if (sshPassword) {
      await prisma.vendorClient.update({
        where: { id: clientId },
        data: { sshPasswordEnc: encryptJson({ password: sshPassword }) },
      })
    }
    return { ok: true }
  })
  if ('error' in result && result.error) return { error: result.error }

  startProvisioning(session.user.tenantId, clientId, session.user.id)
  revalidatePath('/vendor')
  return { success: 'Retrying installation…' }
}
