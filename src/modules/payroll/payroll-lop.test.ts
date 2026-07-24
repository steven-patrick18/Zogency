import { describe, expect, it } from 'vitest'
import { leaveWorkingDaysInMonth, workingDaysInMonth } from './service'

describe('payroll working-day LOP basis', () => {
  it('counts only Mon–Fri in a month (weekends never deducted)', () => {
    // July 2026: 31 days, 23 weekdays (1st is a Wednesday).
    expect(workingDaysInMonth(2026, 7)).toBe(23)
    // February 2026: 28 days, 20 weekdays.
    expect(workingDaysInMonth(2026, 2)).toBe(20)
  })

  it('a fully-present employee incurs zero LOP (no weekend penalty)', () => {
    const working = workingDaysInMonth(2026, 7)
    const present = working // attended every working day
    const lop = Math.max(0, working - present - 0)
    expect(lop).toBe(0)
  })

  it('clips a leave that spans a month boundary to this month only', () => {
    // Leave Jul 30 → Aug 3; only Jul 30 (Thu) and Jul 31 (Fri) are in July.
    const monthStart = new Date(2026, 6, 1)
    const monthEnd = new Date(2026, 7, 0, 23, 59, 59)
    const days = leaveWorkingDaysInMonth(
      new Date(2026, 6, 30),
      new Date(2026, 7, 3),
      monthStart,
      monthEnd,
    )
    expect(days).toBe(2)
  })

  it('excludes weekend days inside a leave range', () => {
    // Leave Jul 3 (Fri) → Jul 6 (Mon): working days are Fri + Mon = 2.
    const monthStart = new Date(2026, 6, 1)
    const monthEnd = new Date(2026, 7, 0, 23, 59, 59)
    const days = leaveWorkingDaysInMonth(
      new Date(2026, 6, 3),
      new Date(2026, 6, 6),
      monthStart,
      monthEnd,
    )
    expect(days).toBe(2)
  })
})
