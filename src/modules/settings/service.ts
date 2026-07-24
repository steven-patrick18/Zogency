import { prisma } from '@/lib/db/prisma'
import { verifyLicense, type LicenseInfo } from '@/lib/license'

export function deployMode(): 'cloud' | 'self_hosted' {
  return process.env.ZOGENCY_DEPLOY_MODE === 'self_hosted' ? 'self_hosted' : 'cloud'
}

/** Current workspace license state — call inside tenant context. */
export async function getWorkspaceLicense(): Promise<LicenseInfo> {
  const settings = await prisma.tenantSettings.findFirst()
  return verifyLicense(settings?.licenseKey)
}
