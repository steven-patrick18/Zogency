// Tenancy registry (doc 02 §3.2): every Prisma model MUST appear in exactly one
// of these sets. A CI test (registry.test.ts) fails if a model is missing, so
// adding a table forces an explicit tenancy decision.

/** Models carrying tenant_id — the guard injects it on every query. */
export const TENANT_SCOPED_MODELS = new Set([
  'TenantSettings',
  'User',
  'Role',
  'Department',
  'AuditLog',
  'Notification',
  'File',
  'Comment',
  'WebhookEvent',
  'IntegrationCredential',
  'LeadSource',
  'LeadStatus',
  'Lead',
  'LeadStatusHistory',
  'LeadAssignment',
  'AssignmentRule',
  'BantQualification',
  'Call',
  'SlaEscalation',
  'AutomationRule',
  'AutomationRun',
])

/** Platform-level models with no tenant_id — only reachable via prismaUnscoped. */
export const GLOBAL_MODELS = new Set(['Tenant', 'TenantDomain', 'Permission'])

/**
 * Join tables without their own tenant_id, scoped transitively through their
 * parents (both sides of the join are themselves tenant-scoped or global).
 */
export const JOIN_MODELS = new Set(['UserRole', 'RolePermission'])
