'use client'

import { useActionState, useState } from 'react'
import { addEmployeeAction, type HrActionState } from '@/modules/hr/actions'

const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none'
const label = 'mb-1 block text-xs font-medium text-slate-500'

export function AddEmployeeForm({
  departments,
  managers,
  roles,
}: {
  departments: Array<{ id: string; name: string }>
  managers: Array<{ id: string; name: string }>
  roles: Array<{ id: string; name: string }>
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<HrActionState, FormData>(addEmployeeAction, {})

  if (!open) {
    return (
      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => setOpen(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
          + Add employee
        </button>
        <span className="text-xs text-slate-400">Onboard an existing team member directly (no hiring pipeline).</span>
        {state.success && <span className="text-sm font-medium text-green-700">{state.success}</span>}
      </div>
    )
  }

  return (
    <form action={formAction} className="mb-4 max-w-3xl space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold text-slate-900">Add employee</h3>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label}>Full name *</label><input name="name" required className={field} /></div>
        <div><label className={label}>Work email *</label><input name="email" type="email" required className={field} /></div>
        <div><label className={label}>Phone</label><input name="phone" className={field} /></div>
        <div><label className={label}>Designation *</label><input name="designation" required placeholder="e.g. SEO Specialist" className={field} /></div>
        <div>
          <label className={label}>Department</label>
          <select name="departmentId" defaultValue="" className={field}>
            <option value="">No department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Reporting manager</label>
          <select name="managerId" defaultValue="" className={field}>
            <option value="">None</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Employment type</label>
          <select name="employmentType" defaultValue="permanent" className={field}>
            <option value="permanent">Permanent</option>
            <option value="contract">Contract</option>
            <option value="intern">Intern</option>
          </select>
        </div>
        <div><label className={label}>Joining date *</label><input name="joinedOn" type="date" required className={field} /></div>
      </div>
      <div>
        <label className={label}>Role(s) — what they can access in the CRM</label>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-lg border border-slate-200 p-3">
          {roles.map((r) => (
            <label key={r.id} className="flex items-center gap-1.5 text-sm text-slate-700">
              <input type="checkbox" name="roleIds" value={r.id} className="accent-indigo-600" />
              {r.name}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-400">Pick the least-privilege role for their job (not Admin).</p>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
          {pending ? 'Adding…' : 'Add employee'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:underline">Cancel</button>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
      {state.success && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">{state.success}</p>}
    </form>
  )
}
