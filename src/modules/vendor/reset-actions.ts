'use server'

// Reset the demo workspace to a FRESH INSTALL (master server only). After a
// prospect's demo, this returns the workspace to exactly what a brand-new
// Zogency install looks like: no employees, no team, no leads/deals/clients/
// campaigns/tickets/invoices, no connected integrations, no history — the next
// prospect configures everything from scratch, adds their own people and
// connects their own APIs.
//
// PRESERVED (the fresh-install baseline): tenant + settings, the RBAC scaffold
// (roles, permissions), default lead statuses / sources / leave types, seeded
// automation & assignment rules, proposal templates, service catalogue,
// departments, the vendor console's own data (client installs + releases), and
// the vendor operator accounts (any user holding vendor.manage) so the console
// stays reachable. EVERYTHING ELSE is cleared.
//
// Implemented with TRUNCATE: row-level DELETE triggers don't fire on TRUNCATE,
// so it slips past the append-only guards (comments / history / audit), and
// CASCADE resolves foreign-key order. The master is single-tenant, so a
// table-wide truncate is exactly a tenant wipe. Users are the one exception —
// deleted selectively so the vendor operators survive.
import { revalidatePath } from 'next/cache'
import { audit } from '@/lib/audit'
import { requirePermission, withTenant } from '@/lib/authz'
import { prismaUnscoped } from '@/lib/db/prisma'
import { vendorModeEnabled } from './config'

export type ResetActionState = { error?: string; success?: string }

const RESET_CONFIRM_PHRASE = 'RESET DEMO DATA'

// Tables emptied on a fresh-install reset. Anything NOT listed is preserved:
// tenants, tenant_domains, tenant_settings, permissions, roles, role_permissions,
// users (vendor operators only — see below), user_roles, departments,
// lead_sources, lead_statuses, leave_types, assignment_rules, automation_rules,
// proposal_templates, service_catalog, vendor_clients, vendor_releases.
const WIPE_TABLES = [
  // Sales pipeline
  'leads', 'lead_status_history', 'lead_assignments', 'bant_qualifications',
  'calls', 'sla_escalations', 'automation_runs',
  // Deals
  'deals', 'discovery_notes', 'proposals', 'proposal_versions',
  'approval_requests', 'contracts',
  // Delivery & finance
  'clients', 'client_contacts', 'handovers', 'sow_deliverables',
  'onboarding_checklist_items', 'projects', 'tasks', 'task_status_history',
  'invoices', 'invoice_line_items', 'payments', 'payment_reminders',
  // Marketing
  'campaigns', 'briefs', 'campaign_strategies', 'campaign_plans',
  'plan_milestones', 'budgets', 'creative_concepts', 'creative_assets',
  'revision_rounds', 'client_signoffs', 'launch_checklist_items',
  'campaign_channels', 'campaign_kpis', 'kpi_snapshots', 'optimization_logs',
  'campaign_reports', 'project_closures',
  // Recruitment
  'job_requisitions', 'candidates', 'candidate_stage_history',
  'candidate_interviews', 'offers',
  // HR org (a fresh install has no employees — the prospect adds their team)
  'employees', 'employee_documents', 'employee_onboarding_items',
  'employee_exits', 'salary_structures', 'attendance_records',
  'leave_balances', 'leave_requests', 'employee_goals', 'performance_reviews',
  'performance_cycles', 'holidays',
  // Retention
  'renewals', 'client_checkins', 'client_health_scores', 'churn_flags',
  'upsell_opportunities',
  // Support / comms / content
  'support_tickets', 'ticket_messages', 'chat_messages', 'content_items',
  'email_campaigns', 'email_campaign_recipients', 'scheduled_deliveries',
  'retainer_schedules', 'meetings',
  // Payroll
  'payroll_runs', 'payslips',
  // Monitoring, integrations, notifications, attachments, audit history
  'activity_pings', 'integration_credentials', 'notifications', 'comments',
  'webhook_events', 'files', 'audit_logs',
] as const

/**
 * Wipe the workspace back to a fresh install. Returns the number of remaining
 * (preserved) users. Callers must already hold vendor.manage and be in vendor
 * mode; kept internal so demo creation can reuse it.
 */
export async function freshInstallReset(): Promise<void> {
  // Never run against a real multi-tenant deployment.
  const tenants = await prismaUnscoped.tenant.count()
  if (tenants !== 1) {
    throw new Error(`Refusing to reset: expected a single-tenant master, found ${tenants} tenants.`)
  }

  const quoted = WIPE_TABLES.map((t) => `"${t}"`).join(', ')
  await prismaUnscoped.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`)

  // Delete every user EXCEPT the vendor operators (holders of vendor.manage), so
  // the console stays reachable but the demo team is gone. Employees were just
  // truncated, so the only remaining FK into users is user_roles.
  const vendorRoleIds = (
    await prismaUnscoped.rolePermission.findMany({
      where: { permission: { key: 'vendor.manage' } },
      select: { roleId: true },
    })
  ).map((r) => r.roleId)
  const keepUserIds = [
    ...new Set(
      (
        await prismaUnscoped.userRole.findMany({
          where: { roleId: { in: vendorRoleIds } },
          select: { userId: true },
        })
      ).map((u) => u.userId),
    ),
  ]
  // Safety: only prune users if we found at least one operator to keep — never
  // leave the workspace with zero login accounts.
  if (keepUserIds.length > 0) {
    await prismaUnscoped.userRole.deleteMany({ where: { userId: { notIn: keepUserIds } } })
    await prismaUnscoped.user.deleteMany({ where: { id: { notIn: keepUserIds } } })
  }
  // Department heads pointed at now-deleted users — clear the dangling pointer.
  await prismaUnscoped.department.updateMany({ data: { headUserId: null } })
}

export async function resetDemoDataAction(
  _prev: ResetActionState,
  formData: FormData,
): Promise<ResetActionState> {
  await requirePermission('vendor.manage')
  if (!vendorModeEnabled()) return { error: 'Vendor mode is not enabled — reset is master-only.' }

  const confirm = String(formData.get('confirm') ?? '').trim()
  if (confirm !== RESET_CONFIRM_PHRASE) {
    return { error: `Type "${RESET_CONFIRM_PHRASE}" exactly to confirm — nothing was changed.` }
  }

  await freshInstallReset()
  await withTenant(() =>
    audit('vendor.demo_reset', 'tenant', 'demo', null, { tables: WIPE_TABLES.length }),
  )

  revalidatePath('/vendor')
  return { success: 'Workspace reset to a fresh install — no employees, data or connectors. Create a demo login to hand it over.' }
}
