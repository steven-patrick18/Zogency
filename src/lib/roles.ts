// Internal/system roles that are part of the vendor+demo plumbing, not the
// tenant's own team structure. They are hidden from role management (assignment
// pickers, the permission matrix) for everyone EXCEPT actual vendor operators
// (holders of vendor.manage) — so a Demo Admin / client admin never sees or can
// assign them.
export const INTERNAL_ROLE_NAMES = new Set(['Demo Admin', 'Vendor Owner'])

export function isInternalRole(name: string): boolean {
  return INTERNAL_ROLE_NAMES.has(name)
}

/** Roles a user may see/assign: hide internal roles unless they run the console. */
export function visibleRoles<T extends { name: string }>(roles: T[], canManageVendor: boolean): T[] {
  return canManageVendor ? roles : roles.filter((r) => !isInternalRole(r.name))
}
