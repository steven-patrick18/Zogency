// Payroll (Phase 3): generate a monthly run of payslips, computing LOP
// (loss-of-pay) days from attendance + approved leave, from each employee's
// salary structure. Net = basic + allowances − deductions − (LOP × per-day).
import { Prisma } from '@/generated/prisma/client'
import { audit } from '@/lib/audit'
import { prisma, scoped } from '@/lib/db/prisma'

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
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
  const totalDays = daysInMonth(year, month)
  let slips = 0

  for (const emp of employees) {
    const struct = structures.get(emp.id)
    if (!struct) continue // no salary structure → skip

    // Approved leave days in this month.
    const leaves = await prisma.leaveRequest.findMany({
      where: { employeeId: emp.id, state: 'approved', fromOn: { lte: monthEnd }, toOn: { gte: monthStart } },
    })
    const leaveDays = leaves.reduce((sum, l) => sum + l.days, 0)
    const present = await prisma.attendanceRecord.count({
      where: { employeeId: emp.id, date: { gte: monthStart, lte: monthEnd } },
    })
    // LOP only for employees actively on the attendance system (present>0);
    // untracked/salaried employees are paid in full rather than penalised for
    // missing attendance data.
    const lopDays = present > 0 ? Math.max(0, totalDays - present - leaveDays) : 0

    const basic = Number(struct.basic)
    const allowances = Number(struct.allowances)
    const gross = basic + allowances
    const perDay = gross / totalDays
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
