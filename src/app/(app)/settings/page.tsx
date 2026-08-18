import { withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { GeneralSettingsForm } from './general-form'
import { InvoiceBrandingForm } from './invoice-branding-form'

// IANA time zones for the picker. `Intl.supportedValuesOf` returns legacy
// aliases for some regions (e.g. Asia/Calcutta, not Asia/Kolkata), so we always
// fold in a few canonical names AND the value already stored — otherwise the
// <select> can't show the saved zone and defaults to the first entry.
function timeZones(current: string): string[] {
  let base: string[] = []
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
    if (fn) base = fn('timeZone')
  } catch {
    /* not supported */
  }
  if (base.length === 0) {
    base = ['Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'UTC']
  }
  const extras = ['Asia/Kolkata', 'UTC', current]
  return Array.from(new Set([...base, ...extras])).sort()
}

export default async function GeneralSettingsPage() {
  const settings = await withTenant(() => prisma.tenantSettings.findFirstOrThrow())
  const zones = timeZones(settings.timezone)

  return (
    <div className="space-y-8">
      <GeneralSettingsForm
        zones={zones}
        values={{
        primaryColor: settings.primaryColor,
        slaHours: settings.slaHours,
        revisionRoundDefault: settings.revisionRoundDefault,
        emailSenderName: settings.emailSenderName ?? '',
        emailSenderAddress: settings.emailSenderAddress ?? '',
        timezone: settings.timezone,
        country: settings.country ?? '',
        addressLine: settings.addressLine ?? '',
        city: settings.city ?? '',
        stateRegion: settings.stateRegion ?? '',
        postalCode: settings.postalCode ?? '',
        phone: settings.phone ?? '',
        websiteUrl: settings.websiteUrl ?? '',
        taxId: settings.taxId ?? '',
        requireTaskApproval: settings.requireTaskApproval,
        }}
      />
      <InvoiceBrandingForm currentTemplate={settings.invoiceTemplate} currentLogo={settings.logo} />
    </div>
  )
}
