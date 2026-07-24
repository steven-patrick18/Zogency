'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@/generated/prisma/client'
import { z } from 'zod'
import { audit } from '@/lib/audit'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma, scoped } from '@/lib/db/prisma'
import { generatePayrollRun } from './service'

export type PayrollActionState = { error?: string; success?: string }

export async function saveSalaryAction(_p: PayrollActionState, formData: FormData): Promise<PayrollActionState> {
  await requirePermission('hr.view_salaries')
  const employeeId = z.string().uuid().parse(formData.get('employeeId'))
  const basic = Number(formData.get('basic'))
  const allowances = Number(formData.get('allowances') ?? 0)
  if (!basic || basic <= 0) return { error: 'Basic salary must be positive' }
  await withTenant(async () => {
    await prisma.salaryStructure.upsert({
      where: { employeeId },
      update: { basic: new Prisma.Decimal(basic), allowances: new Prisma.Decimal(allowances || 0) },
      create: scoped({ employeeId, basic: new Prisma.Decimal(basic), allowances: new Prisma.Decimal(allowances || 0) }),
    })
    await audit('salary.saved', 'employee', employeeId, null, { basic, allowances })
  })
  revalidatePath('/hr/payroll')
  return { success: 'Salary structure saved' }
}

export async function generatePayrollAction(_p: PayrollActionState, formData: FormData): Promise<PayrollActionState> {
  await requirePermission('hr.view_salaries')
  const month = z.coerce.number().int().min(1).max(12).parse(formData.get('month'))
  const year = z.coerce.number().int().min(2020).max(2100).parse(formData.get('year'))
  const result = await withTenant(() => generatePayrollRun(month, year))
  revalidatePath('/hr/payroll')
  return { success: `Payroll generated for ${month}/${year} — ${result.slips} payslips` }
}

export async function finalizePayrollAction(formData: FormData) {
  await requirePermission('hr.view_salaries')
  const runId = z.string().uuid().parse(formData.get('runId'))
  await withTenant(async () => {
    await prisma.payrollRun.update({ where: { id: runId }, data: { status: 'finalized', finalizedAt: new Date() } })
    await audit('payroll.finalized', 'payroll_run', runId, null, { finalized: true })
  })
  revalidatePath('/hr/payroll')
}
