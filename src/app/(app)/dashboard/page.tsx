// Department-aware home (BRB): leadership (reports.view) sees the company
// dashboard; everyone else sees their own department-focused "My work" view.
import { requireSession } from '@/lib/authz'
import { prismaUnscoped } from '@/lib/db/prisma'
import { CompanyDashboard } from './company-dashboard'
import { MyWorkDashboard } from './my-work-dashboard'

export default async function DashboardPage() {
  const session = await requireSession()
  const perms = session.user.permissions
  const isLeadership = perms.includes('reports.view')

  if (isLeadership) {
    const tenant = await prismaUnscoped.tenant.findUnique({ where: { id: session.user.tenantId } })
    return <CompanyDashboard tenantName={tenant?.name ?? 'Workspace'} />
  }

  return (
    <MyWorkDashboard
      userId={session.user.id}
      name={session.user.name ?? 'there'}
      canSeeLeads={perms.includes('leads.view')}
    />
  )
}
