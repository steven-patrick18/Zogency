// Seed: permission catalog, BRB Digital tenant, system roles, admin user.
// Idempotent — safe to re-run (upserts keyed on natural keys).
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '../src/generated/prisma/client'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

// Global permission catalog (doc 02 §4.2). Extended as modules land.
const PERMISSIONS: Array<[key: string, module: string, description: string]> = [
  ['leads.view', 'leads', 'View leads'],
  ['leads.create', 'leads', 'Create leads manually'],
  ['leads.edit', 'leads', 'Edit lead fields'],
  ['leads.reassign', 'leads', 'Reassign lead ownership'],
  ['leads.import', 'leads', 'CSV import'],
  ['pipeline.change_status', 'pipeline', 'Move leads between statuses'],
  ['calls.log', 'calls', 'Click-to-call and manual call logging'],
  ['deals.view', 'deals', 'View deals and pipeline value'],
  ['deals.edit', 'deals', 'Edit deals, proposals'],
  ['deals.approve_discount', 'deals', 'Approve pricing beyond standard bands'],
  ['clients.view', 'clients', 'View client records'],
  ['clients.edit', 'clients', 'Edit clients, handovers, SoW'],
  ['campaigns.view', 'campaigns', 'View marketing campaigns'],
  ['campaigns.edit', 'campaigns', 'Edit briefs, plans, creative'],
  ['campaigns.approve', 'campaigns', 'Internal marketing approvals'],
  ['tasks.view', 'tasks', 'View task boards'],
  ['tasks.edit', 'tasks', 'Create/edit/complete tasks'],
  ['hr.view', 'hr', 'View HR records (non-sensitive)'],
  ['hr.manage', 'hr', 'Manage recruitment, attendance, leave, reviews'],
  ['hr.view_salaries', 'hr', 'View compensation data'],
  ['invoices.view', 'invoices', 'View invoices and payments'],
  ['invoices.manage', 'invoices', 'Create invoices, record payments'],
  ['reports.view', 'reports', 'View module dashboards'],
  ['reports.exec', 'reports', 'View executive dashboard'],
  ['approvals.act', 'approvals', 'Act on assigned approval requests'],
  ['automation.manage', 'automation', 'Edit automation rules'],
  ['settings.manage', 'settings', 'Tenant settings, statuses, departments, templates'],
  ['users.manage', 'users', 'Manage users and roles'],
]

// System roles → permission keys (doc 01 §3). Admin gets all.
const ROLES: Record<string, string[] | 'ALL'> = {
  Admin: 'ALL',
  'Sales Manager': [
    'leads.view', 'leads.create', 'leads.edit', 'leads.reassign', 'leads.import',
    'pipeline.change_status', 'calls.log', 'deals.view', 'deals.edit',
    'deals.approve_discount', 'clients.view', 'reports.view', 'approvals.act',
  ],
  'Sales Rep': [
    'leads.view', 'leads.create', 'leads.edit', 'pipeline.change_status',
    'calls.log', 'deals.view', 'deals.edit', 'clients.view',
  ],
  'Pre-Sales': ['leads.view', 'deals.view', 'deals.edit'],
  'Marketing Manager': [
    'campaigns.view', 'campaigns.edit', 'campaigns.approve', 'tasks.view',
    'tasks.edit', 'clients.view', 'reports.view', 'approvals.act',
  ],
  'Account Servicing': ['campaigns.view', 'campaigns.edit', 'clients.view', 'clients.edit', 'tasks.view'],
  Creative: ['campaigns.view', 'campaigns.edit', 'tasks.view', 'tasks.edit'],
  'HR Manager': ['hr.view', 'hr.manage', 'hr.view_salaries', 'reports.view', 'approvals.act'],
  Finance: ['invoices.view', 'invoices.manage', 'deals.view', 'clients.view', 'approvals.act'],
  Delivery: ['clients.view', 'tasks.view', 'tasks.edit', 'campaigns.view'],
}

const DEPARTMENTS = ['SEO', 'Design', 'Social', 'Video', 'Content', 'Web', 'Performance']

async function main() {
  for (const [key, module, description] of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: { module, description },
      create: { key, module, description },
    })
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'brb' },
    update: {},
    create: { name: 'BRB Digital', slug: 'brb' },
  })

  await prisma.tenantSettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      emailSenderName: 'BRB Digital',
    },
  })

  const allPerms = await prisma.permission.findMany()
  for (const [name, permKeys] of Object.entries(ROLES)) {
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: {},
      create: { tenantId: tenant.id, name, isSystem: true },
    })
    const wanted = permKeys === 'ALL' ? allPerms : allPerms.filter((p) => permKeys.includes(p.key))
    for (const p of wanted) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
        update: {},
        create: { roleId: role.id, permissionId: p.id },
      })
    }
  }

  for (const [i, name] of DEPARTMENTS.entries()) {
    await prisma.department.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: {},
      create: { tenantId: tenant.id, name, type: name.toLowerCase(), sort: i },
    })
  }

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Admin' } },
  })
  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@brb.digital' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'BRB Admin',
      email: 'admin@brb.digital',
      passwordHash: await bcrypt.hash('Admin@123', 12),
    },
  })
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  })

  // ── Sprint 2: lead statuses (the 7 PRD defaults), sources, assignment rule ──
  const LEAD_STATUSES: Array<[name: string, sort: number, flags?: { isTerminal?: boolean; isWon?: boolean; isJunk?: boolean }, color?: string]> = [
    ['New', 0, {}, '#3b82f6'],
    ['Connected', 1, {}, '#06b6d4'],
    ['Follow-up', 2, {}, '#f59e0b'],
    ['Meeting Scheduled', 3, {}, '#8b5cf6'],
    ['Meeting Done', 4, {}, '#6366f1'],
    ['Junk', 5, { isTerminal: true, isJunk: true }, '#94a3b8'],
    ['Won', 6, { isTerminal: true, isWon: true }, '#22c55e'],
  ]
  for (const [name, sort, flags, color] of LEAD_STATUSES) {
    await prisma.leadStatus.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: { sort, ...flags, color },
      create: { tenantId: tenant.id, name, sort, ...flags, color },
    })
  }

  const LEAD_SOURCES: Array<[type: string, name: string, isMql: boolean]> = [
    ['meta', 'Meta Lead Ads', true],
    ['google', 'Google Ads Lead Form', true],
    ['website', 'Website Form', true],
    ['referral', 'Referral', false],
    ['cold_call', 'Cold Calling', false],
    ['linkedin', 'LinkedIn Outreach', false],
    ['event', 'Events', false],
    ['csv', 'CSV Import', false],
  ]
  for (const [type, name, isMql] of LEAD_SOURCES) {
    await prisma.leadSource.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: { type, isMql },
      create: { tenantId: tenant.id, type, name, isMql },
    })
  }

  // Default round-robin rule over all users holding the Sales Rep role.
  const salesRepRole = await prisma.role.findUniqueOrThrow({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Sales Rep' } },
  })
  const reps = await prisma.userRole.findMany({ where: { roleId: salesRepRole.id } })
  const existingRule = await prisma.assignmentRule.findFirst({
    where: { tenantId: tenant.id, strategy: 'round_robin' },
  })
  if (!existingRule) {
    await prisma.assignmentRule.create({
      data: {
        tenantId: tenant.id,
        name: 'Round-robin to Sales Reps',
        strategy: 'round_robin',
        targetUserIds: reps.map((r) => r.userId),
        priority: 0,
      },
    })
  }

  // Seeded automation rules (doc 08 §3, FR-10.2). WhatsApp/email actions
  // attach when MessagingPort/EmailPort are connected — notify runs in-app now.
  const AUTOMATION_RULES = [
    {
      name: 'Follow-up reminder',
      triggerType: 'status_changed',
      entityType: 'lead',
      conditions: [{ field: 'status', op: 'eq', value: 'Follow-up' }],
      actions: [{ type: 'notify', to: 'owner', template: 'lead.followup_due' }],
    },
    {
      name: 'Meeting scheduled reminder',
      triggerType: 'status_changed',
      entityType: 'lead',
      conditions: [{ field: 'status', op: 'eq', value: 'Meeting Scheduled' }],
      actions: [{ type: 'notify', to: 'owner', template: 'lead.meeting_scheduled' }],
    },
    {
      name: 'SLA breach — escalate to Sales Manager',
      triggerType: 'sla_breach',
      entityType: 'lead',
      conditions: [],
      actions: [{ type: 'notify', to: 'role:Sales Manager', template: 'lead.sla_breach' }],
    },
  ]
  for (const rule of AUTOMATION_RULES) {
    const existing = await prisma.automationRule.findFirst({
      where: { tenantId: tenant.id, name: rule.name },
    })
    if (!existing) {
      await prisma.automationRule.create({ data: { tenantId: tenant.id, ...rule } })
    }
  }

  // Dev IVR webhook key (vendor pending — doc 11 Q1).
  await prisma.integrationCredential.upsert({
    where: { tenantId_provider: { tenantId: tenant.id, provider: 'ivr' } },
    update: {},
    create: {
      tenantId: tenant.id,
      provider: 'ivr',
      configEncrypted: JSON.stringify({ key: 'brb-ivr-dev-key' }),
    },
  })

  // Website-form intake key (doc 09 §2.3) — per-tenant credential.
  await prisma.integrationCredential.upsert({
    where: { tenantId_provider: { tenantId: tenant.id, provider: 'website_form' } },
    update: {},
    create: {
      tenantId: tenant.id,
      provider: 'website_form',
      // Dev key — plain here; production keys go through the encryption path.
      configEncrypted: JSON.stringify({ key: 'brb-webform-dev-key' }),
    },
  })

  console.log(`Seeded tenant "${tenant.name}" (${tenant.slug}) with ${PERMISSIONS.length} permissions, ${Object.keys(ROLES).length} roles, ${DEPARTMENTS.length} departments, ${LEAD_STATUSES.length} lead statuses, ${LEAD_SOURCES.length} sources, admin admin@brb.digital / Admin@123`)
}

main().finally(() => prisma.$disconnect())
