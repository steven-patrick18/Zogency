// Payroll (Phase 3): generate a monthly run of payslips, computing LOP
// (loss-of-pay) days from attendance + approved leave, from each employee's
// salary structure. Net = basic + allowances − deductions − (LOP × per-day).
import { Prisma } from '@/generated/prisma/client'
import { audit } from '@/lib/audit'
import { prisma, scoped } from '@/lib/db/prisma'

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

/** Working days (Mon–Fri) in a month. */
export function workingDaysInMonth(year: number, month: number): number {
  let n = 0
  const total = daysInMonth(year, month)
  for (let day = 1; day <= total; day++) {
    if (!isWeekend(new Date(year, month - 1, day))) n++
  }
  return n
}

/** Working days of a leave request that actually fall inside [monthStart, monthEnd]. */
export function leaveWorkingDaysInMonth(fromOn: Date, toOn: Date, monthStart: Date, monthEnd: Date): number {
  const start = fromOn > monthStart ? fromOn : monthStart
  const end = toOn < monthEnd ? toOn : monthEnd
  let n = 0
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  while (cur <= last) {
    if (!isWeekend(cur)) n++
    cur.setDate(cur.getDate() + 1)
  }
  return n
}

export async function generatePayrollRun(month: number, year: number): Promise<{ runId: string; slips: number }> {
  const existing = await prisma.payrollRun.findFirst({ where: { periodmonth: month, periodyear: year } })
  if (existing) {
    return { runId: existing.id, slips: await prisma.payslip.count({ where: { runId: existing.id } }) }
  }
  const run = await prisma.payrollRun.create({ data: scoped({ periodmonth: month, periodyear: year }) })

  const employees = await prisma.employee.findMany({ where: { status: { not: 'exited' } } })
  const structures = new Map(
    (await prisma.salaryStructure.findMany()).map((s) => [s.employeeId, s]),
  )
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0, 23, 59, 59)
  const workingDays = workingDaysInMonth(year, month)
  let slips = 0

  for (const emp of employees) {
    const struct = structures.get(emp.id)
    if (!struct) continue // no salary structure → skip

    // Approved leave, clipped to the working days that fall inside this month
    // (a leave spanning a month boundary must not count its out-of-month days).
    const leaves = await prisma.leaveRequest.findMany({
      where: { employeeId: emp.id, state: 'approved', fromOn: { lte: monthEnd }, toOn: { gte: monthStart } },
    })
    const leaveDays = leaves.reduce(
      (sum, l) => sum + leaveWorkingDaysInMonth(l.fromOn, l.toOn, monthStart, monthEnd),
      0,
    )
    const present = await prisma.attendanceRecord.count({
      where: { employeeId: emp.id, date: { gte: monthStart, lte: monthEnd } },
    })
    // LOP is measured against WORKING days (not calendar days) so weekends are
    // never deducted. Only for employees actively on the attendance system
    // (present>0); untracked/salaried employees are paid in full rather than
    // penalised for missing attendance data.
    const lopDays = present > 0 ? Math.max(0, workingDays - present - leaveDays) : 0

    const basic = Number(struct.basic)
    const allowances = Number(struct.allowances)
    const gross = basic + allowances
    // Per-day rate is on working days, matching the working-day LOP basis.
    const perDay = gross / workingDays
    const deductions = Math.round(perDay * lopDays)
    const net = Math.max(0, gross - deductions)

    await prisma.payslip.create({
      data: scoped({
        runId: run.id,
        employeeId: emp.id,
        basic: new Prisma.Decimal(basic),
        allowances: new Prisma.Decimal(allowances),
        deductions: new Prisma.Decimal(deductions),
        lopDays,
        netPay: new Prisma.Decimal(net),
      }),
    })
    slips++
  }
  await audit('payroll.run_generated', 'payroll_run', run.id, null, { month, year, slips })
  return { runId: run.id, slips }
}
