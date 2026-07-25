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
  ['leads.view_contact', 'leads', 'See unmasked lead phone/email by default'],
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
  ['monitoring.deep', 'monitoring', 'View captured window titles & screenshots (deep monitoring)'],
  ['approvals.act', 'approvals', 'Act on assigned approval requests'],
  ['automation.manage', 'automation', 'Edit automation rules'],
  ['settings.manage', 'settings', 'Tenant settings, statuses, departments, templates'],
  ['system.manage', 'system', 'Server status, storage & data retention'],
  ['users.manage', 'users', 'Manage users and roles'],
  ['vendor.manage', 'vendor', 'Vendor console: licenses, client installs, releases (owner only)'],
]

// System roles → permission keys (doc 01 §3). Admin gets all EXCEPT the
// vendor console — that needs the explicit Vendor Owner role (master server).
// Demo Admin: full product access for prospect demos — everything the Admin can
// do (add users, configure the org, connect integrations) EXCEPT the vendor
// console. Demos are disposable fresh installs, so there is nothing to protect
// from user administration.
const ROLES: Record<string, string[] | 'ALL_BUT_VENDOR'> = {
  Admin: 'ALL_BUT_VENDOR',
  'Vendor Owner': ['vendor.manage'],
  'Demo Admin': 'ALL_BUT_VENDOR',
  'Sales Manager': [
    'leads.view', 'leads.create', 'leads.edit', 'leads.reassign', 'leads.import',
    'leads.view_contact',
    'pipeline.change_status', 'calls.log', 'deals.view', 'deals.edit',
    'deals.approve_discount', 'clients.view', 'reports.view', 'reports.exec', 'approvals.act',
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

  // Self-hosted installs override these (deploy/install.sh writes SEED_* envs).
  const tenantName = process.env.SEED_TENANT_NAME ?? 'BRB Digital'
  const tenantSlug = process.env.SEED_TENANT_SLUG ?? 'brb'
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@brb.digital').toLowerCase()
  const adminName = process.env.SEED_ADMIN_NAME ?? 'BRB Admin'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123'

  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: {},
    create: { name: tenantName, slug: tenantSlug },
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
    const wanted =
      permKeys === 'ALL_BUT_VENDOR'
        ? allPerms.filter((p) => p.key !== 'vendor.manage')
        : allPerms.filter((p) => permKeys.includes(p.key))
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
    where: { tenantId_email: { tenantId: tenant.id, email: adminEmail } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: adminName,
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      // Provisioned installs: the client sets their own password via the
      // one-time /setup/<token> link (vendor console flow).
      setupToken: process.env.SEED_ADMIN_SETUP_TOKEN || null,
    },
  })

  // Provisioned installs arrive pre-licensed (vendor console flow).
  if (process.env.SEED_LICENSE_KEY) {
    await prisma.tenantSettings.update({
      where: { tenantId: tenant.id },
      data: { licenseKey: process.env.SEED_LICENSE_KEY },
    })
  }
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  })

  // Master server only: the seeded admin owns the vendor console.
  if (process.env.ZOGENCY_VENDOR_MODE === '1') {
    const vendorOwner = await prisma.role.findUniqueOrThrow({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Vendor Owner' } },
    })
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: vendorOwner.id } },
      update: {},
      create: { userId: admin.id, roleId: vendorOwner.id },
    })
  }

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

  // Proposal templates per service line (FR-2.12) — Admin-editable.
  const PROPOSAL_TEMPLATES = [
    ['Social Media Management', 'Social Media Retainer'],
    ['Performance Marketing', 'Performance Marketing Retainer'],
    ['Web Development', 'Website Design & Development'],
    ['SEO', 'SEO Retainer'],
    ['Branding', 'Brand Identity Package'],
  ]
  for (const [serviceLine, name] of PROPOSAL_TEMPLATES) {
    await prisma.proposalTemplate.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: {},
      create: {
        tenantId: tenant.id,
        serviceLine,
        name,
        body: `Scope, deliverables, timelines and commercial terms for ${serviceLine}. (Edit in Settings once template editor ships.)`,
      },
    })
  }

  // Leave types (FR-4.9/4.10) — Admin-editable in a later settings pass.
  // Leave types encode the strict-management policy (BRB leave policy 2026).
  // All fields stay admin-editable on /hr/policy.
  type LeaveSeed = {
    name: string
    code: string
    annualQuota: number
    accrualPerMonth: number
    carryForwardMax: number
    maxConsecutive: number
    woffAdjacency: 'allowed' | 'limited1' | 'forbidden'
    standaloneOnly: boolean
    clubbableWithLeave: boolean
    encashable: boolean
    requiresConfirmation: boolean
    requiresRestrictedHoliday?: boolean
  }
  const LEAVE_TYPES: LeaveSeed[] = [
    // CL: 1/mo, 12/yr, no carry, ≤2 consecutive but only 1 if adjacent to a WOFF,
    // never clubbed with EL/RH.
    { name: 'Casual Leave', code: 'CL', annualQuota: 12, accrualPerMonth: 1, carryForwardMax: 0, maxConsecutive: 2, woffAdjacency: 'limited1', standaloneOnly: false, clubbableWithLeave: false, encashable: false, requiresConfirmation: false },
    // EL: 1/mo after confirmation, 12/yr, carry ≤18, ≤4 consecutive, never adjacent
    // to a WOFF, never clubbed with CL/RH, encashable only with approval.
    { name: 'Earned Leave', code: 'EL', annualQuota: 12, accrualPerMonth: 1, carryForwardMax: 18, maxConsecutive: 4, woffAdjacency: 'forbidden', standaloneOnly: false, clubbableWithLeave: false, encashable: true, requiresConfirmation: true },
    // RH: 4/yr, standalone single days only, never clubbed, lapses; must land on
    // a published restricted-holiday date from the company calendar.
    { name: 'Restricted Holiday', code: 'RH', annualQuota: 4, accrualPerMonth: 0, carryForwardMax: 0, maxConsecutive: 1, woffAdjacency: 'allowed', standaloneOnly: true, clubbableWithLeave: false, encashable: false, requiresConfirmation: false, requiresRestrictedHoliday: true },
  ]
  for (const t of LEAVE_TYPES) {
    const data = {
      code: t.code,
      annualQuota: t.annualQuota,
      carryForward: t.carryForwardMax > 0,
      accrualPerMonth: t.accrualPerMonth,
      carryForwardMax: t.carryForwardMax,
      maxConsecutive: t.maxConsecutive,
      woffAdjacency: t.woffAdjacency,
      standaloneOnly: t.standaloneOnly,
      clubbableWithLeave: t.clubbableWithLeave,
      encashable: t.encashable,
      requiresConfirmation: t.requiresConfirmation,
      requiresRestrictedHoliday: t.requiresRestrictedHoliday ?? false,
    }
    await prisma.leaveType.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: t.name } },
      update: data,
      create: { tenantId: tenant.id, name: t.name, ...data },
    })
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

  console.log(`Seeded tenant "${tenant.name}" (${tenant.slug}) with ${PERMISSIONS.length} permissions, ${Object.keys(ROLES).length} roles, ${DEPARTMENTS.length} departments, ${LEAD_STATUSES.length} lead statuses, ${LEAD_SOURCES.length} sources, admin ${adminEmail}`)
}

main().finally(() => prisma.$disconnect())
