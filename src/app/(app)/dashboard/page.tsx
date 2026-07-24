import { requireSession, withTenant } from '@/lib/authz'
import { prisma, prismaUnscoped } from '@/lib/db/prisma'

export default async function DashboardPage() {
  const session = await requireSession()
  // Guarded queries — tenant_id injected automatically (doc 02 §3.2).
  const [userCount, departmentCount, roleCount] = await withTenant(() =>
    Promise.all([prisma.user.count(), prisma.department.count(), prisma.role.count()]),
  )
  const tenant = await prismaUnscoped.tenant.findUnique({ where: { id: session.user.tenantId } })

  const stats = [
    { label: 'Team members', value: userCount },
    { label: 'Departments', value: departmentCount },
    { label: 'Roles', value: roleCount },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">
        {tenant?.name ?? 'Workspace'} — Dashboard
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Welcome back, {session.user.name}. Leads and the 7-status pipeline are live.
      </p>
      <div className="mt-6 grid max-w-2xl grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-3xl font-bold text-slate-900">{s.value}</p>
            <p className="mt-1 text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
