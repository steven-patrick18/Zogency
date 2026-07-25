// The human-readable leave policy, rendered from the configured rules so the
// document and the enforcement engine can never drift apart. Employees read this
// on /hr/policy; the rules above are what the system actually enforces.

type DocType = {
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

function woffClause(t: DocType): string | null {
  if (t.woffAdjacency === 'forbidden') return `${t.name} shall not be taken immediately before or after a Weekly Off (WOFF).`
  if (t.woffAdjacency === 'limited1') return `If ${t.name} is taken immediately before or after a Weekly Off (WOFF), only one (1) day shall be permitted.`
  return null
}

function ruleLines(t: DocType): string[] {
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

export function LeavePolicyDocument({ types, cap, notice }: { types: DocType[]; cap: number; notice: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-slate-900">Leave Policy</h2>
      <p className="mt-1 text-xs text-slate-400">
        Generated from the configured rules above — this is exactly what the system enforces when leave is applied.
      </p>

      <div className="mt-4 space-y-5 text-sm leading-relaxed text-slate-700">
        <section>
          <h3 className="font-semibold text-slate-900">1. Types of Leave</h3>
          <div className="mt-2 space-y-4">
            {types.map((t) => (
              <div key={t.name}>
                <p className="font-medium text-slate-800">
                  {t.name}{t.code ? ` (${t.code})` : ''}
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-600">
                  {ruleLines(t).map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="font-semibold text-slate-900">2. Public Holidays &amp; Weekly Offs</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-600">
            <li>Public Holidays (PH) are declared annually and are not counted as leave.</li>
            <li>Employees are entitled to two (2) Weekly Offs (WOFF) per week, allocated on a rotational basis per departmental requirements.</li>
            <li>Weekly Offs and Public Holidays shall not be used to extend leave beyond the continuous-absence cap.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-slate-900">3. Maximum Continuous Absence</h3>
          <p className="mt-1 text-slate-600">
            Under no circumstances shall an employee remain absent for more than{' '}
            <strong>{cap} consecutive calendar day(s)</strong>, inclusive of Casual Leave, Earned Leave,
            Restricted Holidays, Public Holidays and Weekly Offs. Any exception requires prior written
            approval from Senior Management.
          </p>
        </section>

        <section>
          <h3 className="font-semibold text-slate-900">4. Leave Application &amp; Approval</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-600">
            <li>All leave must be applied through this HR system.</li>
            <li>Planned leave must be applied at least <strong>{notice} working day(s)</strong> in advance.</li>
            <li>Emergency leave must be intimated at least one (1) hour prior to office hours and marked as an emergency.</li>
            <li>Leave approval is subject to operational requirements and management discretion.</li>
            <li>Absence without prior approval or proper intimation may result in Loss of Pay (LOP) and/or disciplinary action.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-slate-900">5. Special Circumstances</h3>
          <p className="mt-1 text-slate-600">
            Management reserves sole and absolute discretion to relax leave rules in exceptional cases
            (medical emergencies, marriage, bereavement, critical family situations). Any such relaxation
            shall not be treated as precedent.
          </p>
        </section>
      </div>
    </div>
  )
}
