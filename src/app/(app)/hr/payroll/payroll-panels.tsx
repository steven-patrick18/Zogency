'use client'

import { useActionState } from 'react'
import {
  generatePayrollAction,
  saveSalaryAction,
  type PayrollActionState,
} from '@/modules/payroll/actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'
const primaryBtn =
  'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50'
const smallBtn =
  'rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function Feedback({ state }: { state: PayrollActionState }) {
  if (state.error) return <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>
  if (state.success) return <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">{state.success}</p>
  return null
}

export function SalaryRow({
  employeeId,
  name,
  basic,
  allowances,
}: {
  employeeId: string
  name: string
  basic: number | null
  allowances: number | null
}) {
  const [state, formAction, pending] = useActionState<PayrollActionState, FormData>(saveSalaryAction, {})

  return (
    <form
      action={formAction}
      className="grid grid-cols-[1fr_130px_130px_auto] items-center gap-3 border-t border-slate-100 px-4 py-2.5 text-sm"
    >
      <input type="hidden" name="employeeId" value={employeeId} />
      <span className="font-medium text-slate-900">{name}</span>
      <input
        name="basic"
        type="number"
        step="0.01"
        min="0"
        defaultValue={basic ?? ''}
        placeholder="Basic ₹"
        className={field}
      />
      <input
        name="allowances"
        type="number"
        step="0.01"
        min="0"
        defaultValue={allowances ?? ''}
        placeholder="Allowances ₹"
        className={field}
      />
      <div className="flex items-center gap-2">
        <button disabled={pending} className={smallBtn}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
        {state.success && <span className="text-xs text-green-700">Saved</span>}
      </div>
    </form>
  )
}

export function GeneratePayrollForm({
  defaultMonth,
  defaultYear,
}: {
  defaultMonth: number
  defaultYear: number
}) {
  const [state, formAction, pending] = useActionState<PayrollActionState, FormData>(generatePayrollAction, {})

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="payroll-month" className="block text-xs font-medium text-slate-500">
            Month
          </label>
          <select id="payroll-month" name="month" defaultValue={defaultMonth} className={`${field} mt-1`}>
            {MONTHS.map((label, i) => (
              <option key={label} value={i + 1}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="payroll-year" className="block text-xs font-medium text-slate-500">
            Year
          </label>
          <input
            id="payroll-year"
            name="year"
            type="number"
            min="2020"
            max="2100"
            defaultValue={defaultYear}
            className={`${field} mt-1`}
          />
        </div>
        <button disabled={pending} className={primaryBtn}>
          {pending ? 'Generating…' : 'Generate payroll'}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  )
}
