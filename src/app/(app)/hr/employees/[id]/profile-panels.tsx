'use client'

import { useActionState } from 'react'
import {
  deleteEmployeeDocAction,
  updateEmployeeAction,
  uploadEmployeeDocAction,
  type HrActionState,
} from '@/modules/hr/actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'
const primaryBtn =
  'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50'

function Feedback({ state }: { state: HrActionState }) {
  if (state.error) return <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>
  if (state.success) return <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">{state.success}</p>
  return null
}

type Option = { id: string; name: string }

export function JobDetailsForm({
  employeeId,
  designation,
  departmentId,
  managerId,
  employmentType,
  departments,
  users,
}: {
  employeeId: string
  designation: string
  departmentId: string | null
  managerId: string | null
  employmentType: string
  departments: Option[]
  users: Option[]
}) {
  const [state, formAction, pending] = useActionState<HrActionState, FormData>(updateEmployeeAction, {})
  return (
    <form action={formAction} className="mt-3 space-y-3">
      <input type="hidden" name="employeeId" value={employeeId} />
      <label className="block text-xs font-medium text-slate-500">
        Designation
        <input name="designation" required defaultValue={designation} className={`mt-1 ${field}`} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-slate-500">
          Department
          <select name="departmentId" defaultValue={departmentId ?? ''} className={`mt-1 ${field}`}>
            <option value="">— None —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Manager
          <select name="managerId" defaultValue={managerId ?? ''} className={`mt-1 ${field}`}>
            <option value="">— None —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs font-medium text-slate-500">
        Employment type
        <select name="employmentType" defaultValue={employmentType} className={`mt-1 ${field}`}>
          <option value="permanent">Permanent</option>
          <option value="contract">Contract</option>
          <option value="intern">Intern</option>
        </select>
      </label>
      <Feedback state={state} />
      <button disabled={pending} className={primaryBtn}>
        {pending ? 'Saving…' : 'Save job details'}
      </button>
    </form>
  )
}

type Doc = { id: string; title: string; size: number; createdAt: string; dataUri: string }

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1000))} KB`
}

export function DocumentsPanel({
  employeeId,
  docs,
  canManage,
}: {
  employeeId: string
  docs: Doc[]
  canManage: boolean
}) {
  const [state, formAction, pending] = useActionState<HrActionState, FormData>(uploadEmployeeDocAction, {})
  return (
    <div className="mt-3 space-y-3">
      {canManage && (
        <form action={formAction} className="space-y-2">
          <input name="title" required placeholder="Title (e.g. Aadhaar, Offer letter)" className={field} />
          <input
            name="file"
            type="file"
            required
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
          <input type="hidden" name="employeeId" value={employeeId} />
          <Feedback state={state} />
          <button disabled={pending} className={primaryBtn}>
            {pending ? 'Uploading…' : 'Upload document'}
          </button>
        </form>
      )}
      {docs.length === 0 ? (
        <p className="text-sm text-slate-400">No documents yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-slate-800">{doc.title}</p>
                <p className="text-xs text-slate-400">
                  {formatSize(doc.size)} · {doc.createdAt}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={doc.dataUri}
                  target="_blank"
                  rel="noreferrer"
                  download={doc.title}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  View
                </a>
                {canManage && (
                  <form action={deleteEmployeeDocAction}>
                    <input type="hidden" name="docId" value={doc.id} />
                    <input type="hidden" name="employeeId" value={employeeId} />
                    <button className="rounded-lg border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                      Delete
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
