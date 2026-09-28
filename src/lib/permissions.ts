/**
 * RBAC catalogue: the single source of truth for permission keys, their module
 * and the built-in system roles.
 *
 * Permissions are persisted in the database (Role -> RolePermission ->
 * Permission) and resolved per request. This catalogue drives seeding and the
 * administration UI.
 */

export const PERMISSIONS = {
  "leads.view": { module: "crm", label: "View leads" },
  "leads.create": { module: "crm", label: "Create leads" },
  "leads.update": { module: "crm", label: "Update leads" },
  "leads.delete": { module: "crm", label: "Delete leads" },
  "followups.view": { module: "crm", label: "View follow-ups" },
  "followups.manage": { module: "crm", label: "Manage follow-ups" },

  "projects.view": { module: "inventory", label: "View projects" },
  "projects.create": { module: "inventory", label: "Create projects" },
  "projects.update": { module: "inventory", label: "Update projects" },
  "units.view": { module: "inventory", label: "View units" },
  "units.manage": { module: "inventory", label: "Manage units" },

  "reservations.view": { module: "sales", label: "View reservations" },
  "reservations.manage": { module: "sales", label: "Manage reservations" },
  "sales.view": { module: "sales", label: "View sales" },
  "sales.create": { module: "sales", label: "Create sales" },
  "sales.approve": { module: "sales", label: "Approve sales" },

  "payments.view": { module: "finance", label: "View payments" },
  "payments.create": { module: "finance", label: "Record payments" },
  "payments.manage": { module: "finance", label: "Manage payment plans" },
  "collections.view": { module: "finance", label: "View collections" },

  "marketing.view": { module: "marketing", label: "View marketing" },
  "marketing.manage": { module: "marketing", label: "Manage campaigns" },

  "reports.view": { module: "reports", label: "View reports" },
  "audit.view": { module: "admin", label: "View audit log" },
  "automations.manage": { module: "admin", label: "Manage automations" },
  "users.manage": { module: "admin", label: "Manage users" },
  "roles.manage": { module: "admin", label: "Manage roles" },
  "settings.manage": { module: "admin", label: "Manage settings" },

  "ai.use": { module: "ai", label: "Use the AI assistant" },
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ALL_PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

export function permissionLabel(key: string): string {
  const entry = (PERMISSIONS as Record<string, { label: string }>)[key];
  return entry?.label ?? key;
}

export function permissionModule(key: string): string {
  const entry = (PERMISSIONS as Record<string, { module: string }>)[key];
  return entry?.module ?? "other";
}

export const PERMISSION_MODULES: readonly string[] = Array.from(
  new Set(ALL_PERMISSION_KEYS.map((key) => PERMISSIONS[key].module)),
);

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function hasPermission(
  granted: readonly string[] | ReadonlySet<string>,
  key: PermissionKey,
): boolean {
  const set = granted instanceof Set ? granted : new Set(granted);
  return set.has(key);
}

export function hasAnyPermission(
  granted: readonly string[] | ReadonlySet<string>,
  keys: readonly PermissionKey[],
): boolean {
  return keys.some((key) => hasPermission(granted, key));
}

export function assertPermission(
  granted: readonly string[] | ReadonlySet<string>,
  key: PermissionKey,
): void {
  if (!hasPermission(granted, key)) {
    throw new ForbiddenError(`Missing permission "${key}".`);
  }
}

/** Privilege ordering used by the admin UI (higher = more privileged). */
export const ROLE_WEIGHT: Record<string, number> = {
  marketing: 20,
  finance: 30,
  sales: 40,
  sales_manager: 50,
  manager: 60,
  admin: 80,
  owner: 100,
};

export interface SystemRoleDefinition {
  slug: string;
  name: string;
  description: string;
  permissions: readonly PermissionKey[];
}

const VIEW_ALL: readonly PermissionKey[] = [
  "leads.view",
  "followups.view",
  "projects.view",
  "units.view",
  "reservations.view",
  "sales.view",
  "payments.view",
  "collections.view",
  "marketing.view",
  "reports.view",
];

export const SYSTEM_ROLES: readonly SystemRoleDefinition[] = [
  {
    slug: "owner",
    name: "Owner",
    description: "Full control over the organization, including billing and administration.",
    permissions: ALL_PERMISSION_KEYS,
  },
  {
    slug: "admin",
    name: "Admin",
    description: "Administers users, roles, settings and every operational module.",
    permissions: ALL_PERMISSION_KEYS,
  },
  {
    slug: "manager",
    name: "Manager",
    description: "Runs day-to-day operations across sales, inventory and finance.",
    permissions: [
      ...VIEW_ALL,
      "audit.view",
      "automations.manage",
      "leads.create",
      "leads.update",
      "leads.delete",
      "followups.manage",
      "projects.create",
      "projects.update",
      "units.manage",
      "reservations.manage",
      "sales.create",
      "sales.approve",
      "payments.create",
      "payments.manage",
      "marketing.manage",
      "ai.use",
    ],
  },
  {
    slug: "sales_manager",
    name: "Sales Manager",
    description: "Owns the pipeline: assignment, follow-ups, reservations and approvals.",
    permissions: [
      ...VIEW_ALL,
      "leads.create",
      "leads.update",
      "followups.manage",
      "units.manage",
      "reservations.manage",
      "sales.create",
      "sales.approve",
      "ai.use",
    ],
  },
  {
    slug: "sales",
    name: "Sales Agent",
    description: "Works the pipeline: leads, follow-ups, viewings and reservations.",
    permissions: [
      "leads.view",
      "leads.create",
      "leads.update",
      "followups.view",
      "followups.manage",
      "projects.view",
      "units.view",
      "reservations.view",
      "reservations.manage",
      "sales.view",
      "sales.create",
      "ai.use",
    ],
  },
  {
    slug: "finance",
    name: "Finance",
    description: "Handles collections, payment plans and financial reporting.",
    permissions: [
      "leads.view",
      "followups.view",
      "projects.view",
      "units.view",
      "reservations.view",
      "sales.view",
      "sales.approve",
      "payments.view",
      "payments.create",
      "payments.manage",
      "collections.view",
      "reports.view",
      "ai.use",
    ],
  },
  {
    slug: "marketing",
    name: "Marketing",
    description: "Manages lead sources, campaigns and attribution reporting.",
    permissions: [
      "leads.view",
      "leads.create",
      "followups.view",
      "projects.view",
      "units.view",
      "marketing.view",
      "marketing.manage",
      "reports.view",
      "ai.use",
    ],
  },
];

export function systemRoleDefinition(slug: string): SystemRoleDefinition | undefined {
  return SYSTEM_ROLES.find((role) => role.slug === slug);
}

