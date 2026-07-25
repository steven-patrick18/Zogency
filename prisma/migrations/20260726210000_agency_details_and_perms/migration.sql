-- Agency profile fields + deep-monitoring capture retention.
ALTER TABLE "tenant_settings"
  ADD COLUMN IF NOT EXISTS "timezone"                TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN IF NOT EXISTS "country"                 TEXT,
  ADD COLUMN IF NOT EXISTS "address_line"            TEXT,
  ADD COLUMN IF NOT EXISTS "city"                    TEXT,
  ADD COLUMN IF NOT EXISTS "state_region"            TEXT,
  ADD COLUMN IF NOT EXISTS "postal_code"             TEXT,
  ADD COLUMN IF NOT EXISTS "phone"                   TEXT,
  ADD COLUMN IF NOT EXISTS "website_url"             TEXT,
  ADD COLUMN IF NOT EXISTS "tax_id"                  TEXT,
  ADD COLUMN IF NOT EXISTS "capture_retention_hours" INTEGER NOT NULL DEFAULT 336;

-- Sync the permission catalog so already-seeded databases show every current
-- permission in the Roles matrix (the deploy runs `migrate deploy`, not the
-- seed). Idempotent: existing keys are left untouched.
INSERT INTO "permissions" ("id", "key", "module", "description") VALUES
  (gen_random_uuid(), 'leads.view',              'leads',      'View leads'),
  (gen_random_uuid(), 'leads.create',            'leads',      'Create leads manually'),
  (gen_random_uuid(), 'leads.edit',              'leads',      'Edit lead fields'),
  (gen_random_uuid(), 'leads.reassign',          'leads',      'Reassign lead ownership'),
  (gen_random_uuid(), 'leads.view_contact',      'leads',      'See unmasked lead phone/email by default'),
  (gen_random_uuid(), 'leads.import',            'leads',      'CSV import'),
  (gen_random_uuid(), 'pipeline.change_status',  'pipeline',   'Move leads between statuses'),
  (gen_random_uuid(), 'calls.log',               'calls',      'Click-to-call and manual call logging'),
  (gen_random_uuid(), 'deals.view',              'deals',      'View deals and pipeline value'),
  (gen_random_uuid(), 'deals.edit',              'deals',      'Edit deals, proposals'),
  (gen_random_uuid(), 'deals.approve_discount',  'deals',      'Approve pricing beyond standard bands'),
  (gen_random_uuid(), 'clients.view',            'clients',    'View client records'),
  (gen_random_uuid(), 'clients.edit',            'clients',    'Edit clients, handovers, SoW'),
  (gen_random_uuid(), 'campaigns.view',          'campaigns',  'View marketing campaigns'),
  (gen_random_uuid(), 'campaigns.edit',          'campaigns',  'Edit briefs, plans, creative'),
  (gen_random_uuid(), 'campaigns.approve',       'campaigns',  'Internal marketing approvals'),
  (gen_random_uuid(), 'tasks.view',              'tasks',      'View task boards'),
  (gen_random_uuid(), 'tasks.edit',              'tasks',      'Create/edit/complete tasks'),
  (gen_random_uuid(), 'hr.view',                 'hr',         'View HR records (non-sensitive)'),
  (gen_random_uuid(), 'hr.manage',               'hr',         'Manage recruitment, attendance, leave, reviews'),
  (gen_random_uuid(), 'hr.view_salaries',        'hr',         'View compensation data'),
  (gen_random_uuid(), 'invoices.view',           'invoices',   'View invoices and payments'),
  (gen_random_uuid(), 'invoices.manage',         'invoices',   'Create invoices, record payments'),
  (gen_random_uuid(), 'reports.view',            'reports',    'View module dashboards'),
  (gen_random_uuid(), 'reports.exec',            'reports',    'View executive dashboard'),
  (gen_random_uuid(), 'monitoring.deep',         'monitoring', 'View captured window titles & screenshots (deep monitoring)'),
  (gen_random_uuid(), 'approvals.act',           'approvals',  'Act on assigned approval requests'),
  (gen_random_uuid(), 'automation.manage',       'automation', 'Edit automation rules'),
  (gen_random_uuid(), 'settings.manage',         'settings',   'Tenant settings, statuses, departments, templates'),
  (gen_random_uuid(), 'system.manage',           'system',     'Server status, storage & data retention'),
  (gen_random_uuid(), 'users.manage',            'users',      'Manage users and roles'),
  (gen_random_uuid(), 'vendor.manage',           'vendor',     'Vendor console: licenses, client installs, releases (owner only)')
ON CONFLICT ("key") DO NOTHING;

-- Grant every non-vendor permission to the full-access system roles in every
-- tenant, so new capabilities (monitoring, system, etc.) land on Admin / Demo
-- Admin without a re-seed. Idempotent via the composite PK.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" IN ('Admin', 'Demo Admin')
  AND p."key" <> 'vendor.manage'
ON CONFLICT DO NOTHING;
