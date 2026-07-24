// Contact masking (privacy vault, doc 11 O1). Default view masks lead phone/
// email; users with leads.view_contact see full values, and reps can Reveal
// per-lead (audit-logged) so manual dialing works without leaking the list.

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return '••••'
  // Keep country prefix (if +) and last 2 digits: +9198••••••10
  const last2 = digits.slice(-2)
  const prefix = phone.startsWith('+') ? `+${digits.slice(0, 2)}` : ''
  return `${prefix}${'•'.repeat(Math.max(4, digits.length - (prefix ? 4 : 2)))}${last2}`
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '—'
  const [local, domain] = email.split('@')
  if (!domain) return '••••'
  const head = local.slice(0, 1)
  return `${head}${'•'.repeat(Math.max(3, local.length - 1))}@${domain}`
}
