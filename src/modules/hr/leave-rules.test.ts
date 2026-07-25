import { describe, expect, it } from 'vitest'
import { accrualDueMonths, assessLeave, type LeaveContext, type LeaveRuleType } from './leave-rules'

const d = (s: string) => new Date(`${s}T00:00:00.000Z`)

// July 2026: 4th=Sat, 5th=Sun. Weekends = Sat/Sun.
const baseCtx = (over: Partial<LeaveContext> = {}): LeaveContext => ({
  weeklyOffDays: [0, 6],
  holidays: new Set(),
  existingLeaves: [],
  maxContinuousAbsenceDays: 4,
  plannedNoticeDays: 2,
  today: d('2026-07-01'), // Wed
  ...over,
})

const CL: LeaveRuleType = { id: 'cl', name: 'Casual Leave', maxConsecutive: 2, woffAdjacency: 'limited1', standaloneOnly: false, clubbableWithLeave: false }
const EL: LeaveRuleType = { id: 'el', name: 'Earned Leave', maxConsecutive: 4, woffAdjacency: 'forbidden', standaloneOnly: false, clubbableWithLeave: false }
const RH: LeaveRuleType = { id: 'rh', name: 'Restricted Holiday', maxConsecutive: 1, woffAdjacency: 'allowed', standaloneOnly: true, clubbableWithLeave: false }

describe('assessLeave — consecutive caps', () => {
  it('allows 2 mid-week CL', () => {
    // Tue 7th – Wed 8th, notice ok, not adjacent to weekend.
    const r = assessLeave({ fromOn: d('2026-07-07'), toOn: d('2026-07-08') }, CL, baseCtx())
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.leaveDays).toBe(2)
  })
  it('rejects 3 consecutive CL (max 2)', () => {
    const r = assessLeave({ fromOn: d('2026-07-07'), toOn: d('2026-07-09') }, CL, baseCtx())
    expect(r.ok).toBe(false)
  })
  it('rejects 5 consecutive EL (max 4)', () => {
    // Mon-Fri would also hit WOFF adjacency; use a window with a mid holiday to isolate — simplest: 5 weekdays Tue-Mon
    const r = assessLeave({ fromOn: d('2026-07-07'), toOn: d('2026-07-13') }, EL, baseCtx())
    expect(r.ok).toBe(false)
  })
})

describe('assessLeave — weekly-off adjacency', () => {
  it('CL of 1 day touching a weekend is allowed (Fri 10th)', () => {
    const r = assessLeave({ fromOn: d('2026-07-10'), toOn: d('2026-07-10') }, CL, baseCtx())
    expect(r.ok).toBe(true)
  })
  it('CL of 2 days touching a weekend is rejected (Thu-Fri 9-10)', () => {
    const r = assessLeave({ fromOn: d('2026-07-09'), toOn: d('2026-07-10') }, CL, baseCtx())
    expect(r.ok).toBe(false)
  })
  it('EL touching a weekend is rejected outright (Fri 10th)', () => {
    const r = assessLeave({ fromOn: d('2026-07-10'), toOn: d('2026-07-10') }, EL, baseCtx())
    expect(r.ok).toBe(false)
  })
  it('EL mid-week not touching a weekend is allowed (Tue-Wed)', () => {
    const r = assessLeave({ fromOn: d('2026-07-07'), toOn: d('2026-07-08') }, EL, baseCtx())
    expect(r.ok).toBe(true)
  })
})

describe('assessLeave — continuous-absence cap', () => {
  // Isolate the cap: no weekly-offs (so blocks don't pull in weekends), a
  // permissive type (unlimited consecutive, clubbable, any adjacency).
  const FLEX: LeaveRuleType = { id: 'fx', name: 'Flex', maxConsecutive: 0, woffAdjacency: 'allowed', standaloneOnly: false, clubbableWithLeave: true }
  const noWoff = (over: Partial<LeaveContext> = {}) => baseCtx({ weeklyOffDays: [], ...over })

  it('allows a block exactly at the 4-day cap', () => {
    // Existing Tue7–Wed8 (same type) + new Thu9–Fri10 → block Tue–Fri = 4.
    const ctx = noWoff({ existingLeaves: [{ fromOn: d('2026-07-07'), toOn: d('2026-07-08'), typeId: 'fx', typeName: 'Flex' }] })
    const r = assessLeave({ fromOn: d('2026-07-09'), toOn: d('2026-07-10') }, FLEX, ctx)
    expect(r.ok).toBe(true)
  })
  it('rejects a block over the 4-day cap', () => {
    const ctx = noWoff({ existingLeaves: [{ fromOn: d('2026-07-07'), toOn: d('2026-07-08'), typeId: 'fx', typeName: 'Flex' }] })
    const r = assessLeave({ fromOn: d('2026-07-09'), toOn: d('2026-07-11') }, FLEX, ctx)
    // Tue7–Sat11 = 5 continuous → over cap 4.
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/continuous/i)
  })
})

describe('assessLeave — clubbing', () => {
  it('rejects clubbing CL with an adjacent EL', () => {
    const ctx = baseCtx({ existingLeaves: [{ fromOn: d('2026-07-07'), toOn: d('2026-07-07'), typeId: 'el', typeName: 'Earned Leave' }] })
    const r = assessLeave({ fromOn: d('2026-07-08'), toOn: d('2026-07-08') }, CL, ctx)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/clubbed/i)
  })
})

describe('assessLeave — standalone RH', () => {
  it('rejects a 2-day RH', () => {
    const r = assessLeave({ fromOn: d('2026-07-07'), toOn: d('2026-07-08') }, RH, baseCtx())
    expect(r.ok).toBe(false)
  })
  it('allows a single mid-week RH', () => {
    const r = assessLeave({ fromOn: d('2026-07-08'), toOn: d('2026-07-08') }, RH, baseCtx())
    expect(r.ok).toBe(true)
  })
})

describe('assessLeave — advance notice', () => {
  it('rejects planned leave inside the notice window', () => {
    // today Wed 1st; leave Thu 2nd = only ~0-1 working days notice.
    const r = assessLeave({ fromOn: d('2026-07-02'), toOn: d('2026-07-02') }, CL, baseCtx())
    expect(r.ok).toBe(false)
  })
  it('allows the same request when flagged emergency', () => {
    const r = assessLeave({ fromOn: d('2026-07-02'), toOn: d('2026-07-02'), isEmergency: true }, CL, baseCtx())
    expect(r.ok).toBe(true)
  })
})

describe('accrualDueMonths', () => {
  const CLm = { accrualPerMonth: 1, requiresConfirmation: false }
  const ELm = { accrualPerMonth: 1, requiresConfirmation: true }
  const joinedLastYear = { joinedOn: d('2025-01-10'), confirmedOn: null as Date | null }

  it('is 0 for non-accrual types', () => {
    expect(accrualDueMonths({ accrualPerMonth: 0, requiresConfirmation: false }, joinedLastYear, d('2026-07-15'))).toBe(0)
  })
  it('accrues through the current month for a prior-year joiner', () => {
    expect(accrualDueMonths(CLm, joinedLastYear, d('2026-07-15'))).toBe(7)
  })
  it('pro-rates from the join month for a mid-year joiner', () => {
    const emp = { joinedOn: d('2026-05-04'), confirmedOn: null }
    expect(accrualDueMonths(CLm, emp, d('2026-07-15'))).toBe(3) // May, Jun, Jul
  })
  it('never exceeds 12', () => {
    expect(accrualDueMonths(CLm, joinedLastYear, d('2026-12-31'))).toBe(12)
  })
  it('EL does not accrue before confirmation', () => {
    expect(accrualDueMonths(ELm, { joinedOn: d('2026-01-10'), confirmedOn: null }, d('2026-07-15'))).toBe(0)
  })
  it('EL accrues from the confirmation month', () => {
    const emp = { joinedOn: d('2026-01-10'), confirmedOn: d('2026-04-20') }
    expect(accrualDueMonths(ELm, emp, d('2026-07-15'))).toBe(4) // Apr–Jul
  })
})
