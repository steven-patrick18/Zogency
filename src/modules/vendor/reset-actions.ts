'use server'

// Wipe demo operational data (master server only). After prospects poke around
// a live demo, this returns the workspace to its freshly-seeded state: every
// lead / deal / client / campaign / ticket / invoice they created is cleared,
// while the org itself — the 25-person BRB team, roles, departments, lead
// statuses, settings, license, connected integrations, vendor records and any
// demo logins — is left untouched.
//
// Implemented with TRUNCATE (not deleteMany): row-level DELETE triggers do not
// fire on TRUNCATE, so it slips past the append-only guards on comments /
// history / audit tables, and CASCADE resolves foreign-key order for us. The
// master is single-tenant, so a table-wide truncate is exactly a tenant wipe.
import { revalidatePath } from 'next/cache'
import { audit } from '@/lib/audit'
import { requirePermission, withTenant } from '@/lib/authz'
import { prismaUnscoped } from '@/lib/db/prisma'
import { vendorModeEnabled } from './config'

export type ResetActionState = { error?: string; success?: string }

const CONFIRM_PHRASE = 'RESET DEMO DATA'

// Operational tables cleared on reset. Everything NOT listed here is preserved:
// tenants, users, roles, permissions, departments, lead_sources, lead_statuses,
// assignment_rules, automation_rules, proposal_templates, service_catalog,
// integration_credentials, vendor_clients, vendor_releases, and the whole HR
// org (employees, documents, salary, attendance, leave, holidays, reviews) plus
// audit_logs (the reset is itself audited).
const OPERATIONAL_TABLES = [
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
  // Retention
  'renewals', 'client_checkins', 'client_health_scores', 'churn_flags',
  'upsell_opportunities',
  // Support / comms / content
  'support_tickets', 'ticket_messages', 'chat_messages', 'content_items',
  'email_campaigns', 'email_campaign_recipients', 'scheduled_deliveries',
  'retainer_schedules', 'meetings',
  // Payroll
  'payroll_runs', 'payslips',
  // Monitoring & generic attachments
  'activity_pings', 'notifications', 'comments', 'webhook_events', 'files',
] as const

export async function resetDemoDataAction(
  _prev: ResetActionState,
  formData: FormData,
): Promise<ResetActionState> {
  await requirePermission('vendor.manage')
  if (!vendorModeEnabled()) return { error: 'Vendor mode is not enabled — reset is master-only.' }

  const confirm = String(formData.get('confirm') ?? '').trim()
  if (confirm !== CONFIRM_PHRASE) {
    return { error: `Type "${CONFIRM_PHRASE}" exactly to confirm — nothing was changed.` }
  }

  // Guard against ever running this on a real multi-tenant deployment.
  const tenants = await prismaUnscoped.tenant.count()
  if (tenants !== 1) {
    return { error: `Refusing to reset: expected a single-tenant master, found ${tenants} tenants.` }
  }

  const quoted = OPERATIONAL_TABLES.map((t) => `"${t}"`).join(', ')
  await prismaUnscoped.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`)

  await withTenant(() =>
    audit('vendor.demo_reset', 'tenant', 'demo', null, { tables: OPERATIONAL_TABLES.length }),
  )

  revalidatePath('/vendor')
  return { success: `Demo data wiped — ${OPERATIONAL_TABLES.length} operational tables cleared. The org, team and settings are intact.` }
}
