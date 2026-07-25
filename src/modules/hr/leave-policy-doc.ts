// Generates the leave policy as editable markdown from the configured rules —
// used as the default document and as the starting point HR edits from, so a
// custom policy begins accurate to what the engine actually enforces.

export type PolicyDocType = {
  name: string
  code: string | null
  annualQuota: number
  accrualPerMonth: number
  carryForwardMax: number
  maxConsecutive: number
  woffAdjacency: string
  standaloneOnly: boolean
  clubbableWithLeave: boolean
  encashable: boolean
  requiresConfirmation: boolean
  requiresRestrictedHoliday?: boolean
}

function woffClause(t: PolicyDocType): string | null {
  if (t.woffAdjacency === 'forbidden') return `${t.name} shall not be taken immediately before or after a Weekly Off (WOFF).`
  if (t.woffAdjacency === 'limited1') return `If ${t.name} is taken immediately before or after a Weekly Off (WOFF), only one (1) day shall be permitted.`
  return null
}

function ruleLines(t: PolicyDocType): string[] {
  const lines: string[] = []
  if (t.accrualPerMonth) lines.push(`Accrues at ${t.accrualPerMonth} day(s) per month${t.requiresConfirmation ? ' upon confirmation of employment' : ''}.`)
  lines.push(`Total entitlement: ${t.annualQuota} day(s) per calendar year.`)
  lines.push(t.carryForwardMax > 0 ? `Up to ${t.carryForwardMax} day(s) may be carried forward; any excess lapses at year end.` : 'Not carried forward; unused balance lapses at the end of the calendar year.')
  if (t.maxConsecutive > 0) lines.push(`A maximum of ${t.maxConsecutive} consecutive day(s) may be availed at a time.`)
  if (t.standaloneOnly) lines.push('Must be taken as standalone day(s) only — not clubbed with any other leave type.')
  else if (!t.clubbableWithLeave) lines.push('Shall not be clubbed with any other leave type.')
  if (t.requiresRestrictedHoliday) lines.push('May be availed only on a Restricted Holiday published in the company calendar.')
  const w = woffClause(t)
  if (w) lines.push(w)
  lines.push(t.encashable ? 'Encashable only with specific written approval of Management.' : 'Not encashable under any circumstances.')
  return lines
}

export function generateLeavePolicyMarkdown(types: PolicyDocType[], cap: number, notice: number): string {
  const out: string[] = ['# Leave Policy', '', '## 1. Types of Leave', '']
  for (const t of types) {
    out.push(`### ${t.name}${t.code ? ` (${t.code})` : ''}`)
    for (const l of ruleLines(t)) out.push(`- ${l}`)
    out.push('')
  }
  out.push(
    '## 2. Public Holidays & Weekly Offs',
    '- Public Holidays (PH) are declared annually and are not counted as leave.',
    '- Employees are entitled to two (2) Weekly Offs (WOFF) per week, allocated on a rotational basis per departmental requirements.',
    '- Weekly Offs and Public Holidays shall not be used to extend leave beyond the continuous-absence cap.',
    '',
    '## 3. Maximum Continuous Absence',
    `Under no circumstances shall an employee remain absent for more than ${cap} consecutive calendar day(s), inclusive of Casual Leave, Earned Leave, Restricted Holidays, Public Holidays and Weekly Offs. Any exception requires prior written approval from Senior Management.`,
    '',
    '## 4. Leave Application & Approval',
    '- All leave must be applied through this HR system.',
    `- Planned leave must be applied at least ${notice} working day(s) in advance.`,
    '- Emergency leave must be intimated at least one (1) hour prior to office hours and marked as an emergency.',
    '- Leave approval is subject to operational requirements and management discretion.',
    '- Absence without prior approval or proper intimation may result in Loss of Pay (LOP) and/or disciplinary action.',
    '',
    '## 5. Special Circumstances',
    'Management reserves sole and absolute discretion to relax leave rules in exceptional cases (medical emergencies, marriage, bereavement, critical family situations). Any such relaxation shall not be treated as precedent.',
  )
  return out.join('\n')
}
