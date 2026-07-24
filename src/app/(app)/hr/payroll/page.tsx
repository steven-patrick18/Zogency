import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { finalizePayrollAction } from '@/modules/payroll/actions'
import { GeneratePayrollForm, SalaryRow } from './payroll-panels'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

export default async function PayrollPage() {
  await requirePermission('hr.view_salaries')

  const now = new Date()
  const [employees, users, structures, runs] = await withTenant(() =>
    Promise.all([
      prisma.employee.findMany({ orderBy: { joinedOn: 'asc' } }),
      prisma.user.findMany({ select: { id: true, name: true } }),
      prisma.salaryStructure.findMany(),
      prisma.payrollRun.findMany({
        orderBy: [{ periodyear: 'desc' }, { periodmonth: 'desc' }],
        include: { payslips: true },
      }),
    ]),
  )
  const userName = new Map(users.map((u) => [u.id, u.name]))
  const empName = new Map(employees.map((e) => [e.id, userName.get(e.userId) ?? '—']))
  const structByEmp = new Map(structures.map((s) => [s.employeeId, s]))
  const activeEmployees = employees.filter((e) => e.status !== 'exited')

  return (
    <div className="space-y-6">
      {/* (a) Salary structures */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Salary structures</h2>
        <p className="mt-0.5 text-xs text-slate-400">Set each employee&apos;s monthly basic and allowances.</p>
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
          <div className="grid grid-cols-[1fr_130px_130px_auto] gap-3 bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <span>Employee</span>
            <span>Basic</span>
            <span>Allowances</span>
            <span>Action</span>
          </div>
          {activeEmployees.map((e) => {
            const s = structByEmp.get(e.id)
            return (
              <SalaryRow
                key={e.id}
                employeeId={e.id}
                name={empName.get(e.id) ?? '—'}
                basic={s ? Number(s.basic) : null}
                allowances={s ? Number(s.allowances) : null}
              />
            )
          })}
          {activeEmployees.length === 0 && (
            <p className="border-t border-slate-100 px-4 py-6 text-center text-sm text-slate-400">
              No active employees.
            </p>
          )}
        </div>
      </section>

      {/* (b) Generate payroll */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Generate payroll</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Creates a draft run of payslips for every employee with a salary structure.
        </p>
        <div className="mt-3">
          <GeneratePayrollForm defaultMonth={now.getMonth() + 1} defaultYear={now.getFullYear()} />
        </div>
      </section>

      {/* (c) Payroll runs */}
      <section className="space-y-4">
        <h2 className="font-semibold text-slate-900">Payroll runs</h2>
        {runs.map((run) => (
          <div key={run.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-slate-900">
                  {MONTHS[run.periodmonth - 1]} {run.periodyear}
                </h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    run.status === 'finalized' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {run.status}
                </span>
                <span className="text-xs text-slate-400">
                  {run.payslips.length} payslip{run.payslips.length === 1 ? '' : 's'}
                </span>
              </div>
              {run.status === 'draft' && (
                <form action={finalizePayrollAction}>
                  <input type="hidden" name="runId" value={run.id} />
                  <button className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500">
                    Finalize
                  </button>
                </form>
              )}
            </div>
            <table className="mt-4 w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-1">Employee</th>
                  <th>Basic</th>
                  <th>Allowances</th>
                  <th>Deductions</th>
                  <th>LOP days</th>
                  <th>Net pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {run.payslips.map((p) => (
                  <tr key={p.id}>
                    <td className="py-1.5 font-medium text-slate-900">{empName.get(p.employeeId) ?? '—'}</td>
                    <td className="text-slate-600">{inr(Number(p.basic))}</td>
                    <td className="text-slate-600">{inr(Number(p.allowances))}</td>
                    <td className="text-slate-600">{inr(Number(p.deductions))}</td>
                    <td className="text-slate-600">{p.lopDays}</td>
                    <td className="font-medium text-slate-900">{inr(Number(p.netPay))}</td>
                  </tr>
                ))}
                {run.payslips.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-3 text-center text-slate-400">
                      No payslips in this run.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
        {runs.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            No payroll runs yet — generate one above.
          </div>
        )}
      </section>
    </div>
  )
}
