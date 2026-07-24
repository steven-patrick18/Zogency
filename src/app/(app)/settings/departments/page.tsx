import { withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { createDepartment, deleteDepartment } from '@/modules/settings/actions'

export default async function DepartmentsPage() {
  const departments = await withTenant(() =>
    prisma.department.findMany({ orderBy: { sort: 'asc' } }),
  )

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        Task boards are created per department (doc 11 Q12 — this list is workspace-configurable).
      </p>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {departments.map((d) => (
          <li key={d.id} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium text-slate-900">{d.name}</span>
            <form action={deleteDepartment}>
              <input type="hidden" name="id" value={d.id} />
              <button className="text-xs font-medium text-red-600 hover:underline">Remove</button>
            </form>
          </li>
        ))}
      </ul>
      <form action={createDepartment} className="flex gap-3">
        <input
          name="name"
          placeholder="New department name"
          required
          className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
          Add department
        </button>
      </form>
    </div>
  )
}
