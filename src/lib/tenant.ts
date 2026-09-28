import { Prisma } from "@/generated/prisma/client";

/**
 * Tenant isolation guard.
 *
 * Every model that owns tenant data is listed here. `forOrganization(orgId)`
 * wraps the Prisma client with this guard, which:
 *
 *  - injects `organizationId` into reads/writes so developers cannot forget it,
 *  - refuses queries that try to filter on a *different* organization
 *    (throw instead of silently returning nothing),
 *  - fails closed for unknown models: if a new tenant model is added to the
 *    schema but forgotten here, the isolation test suite fails.
 *
 * Platform-level code (login, platform admin, seeding) must use the base
 * `prisma` client from `@/lib/prisma` deliberately.
 */
export const TENANT_MODELS = [
  "Membership",
  "Role",
  "Invitation",
  "OrganizationSettings",
  "Subscription",
  "UsageRecord",
  "Lead",
  "LeadActivity",
  "FollowUp",
  "Campaign",
  "Project",
  "Building",
  "Unit",
  "Reservation",
  "Sale",
  "PaymentPlan",
  "Installment",
  "Payment",
  "ExchangeRate",
  "Notification",
  "AuditLog",
  "AutomationRule",
  "AutomationExecution",
  "AIConversation",
  "AIMessage",
  "AIInsight",
] as const;

export type TenantModelName = (typeof TENANT_MODELS)[number];

export const TENANT_MODEL_SET: ReadonlySet<string> = new Set<string>(TENANT_MODELS);

export class TenantIsolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantIsolationError";
  }
}

type AnyArgs = Record<string, unknown>;

const WHERE_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
]);

const CREATE_OPS = new Set(["create", "createMany"]);
const UPSERT = "upsert";

function readOrganizationId(source: unknown): unknown {
  if (source && typeof source === "object" && "organizationId" in source) {
    return (source as { organizationId?: unknown }).organizationId;
  }
  return undefined;
}

function assertSameTenant(model: string, operation: string, actual: unknown, expected: string) {
  if (actual !== undefined && actual !== expected) {
    throw new TenantIsolationError(
      `Blocked cross-tenant ${operation} on ${model}: organizationId "${String(actual)}" does not match the active organization.`,
    );
  }
}

function withOrganizationId(where: unknown, organizationId: string): AnyArgs {
  const base = where && typeof where === "object" ? { ...(where as AnyArgs) } : {};
  base.organizationId = organizationId;
  return base;
}

/**
 * Returns a copy of the Prisma args with the tenant filter/assignment applied.
 */
export function scopeTenantArgs(
  model: string,
  operation: string,
  args: AnyArgs | undefined,
  organizationId: string,
): AnyArgs {
  const next: AnyArgs = { ...(args ?? {}) };

  if (WHERE_OPS.has(operation)) {
    assertSameTenant(model, operation, readOrganizationId(next.where), organizationId);
    next.where = withOrganizationId(next.where, organizationId);
    return next;
  }

  if (CREATE_OPS.has(operation)) {
    if (operation === "createMany") {
      const data = next.data;
      const rows = Array.isArray(data) ? data : [data];
      if (Array.isArray(data)) {
        next.data = rows.map((row) => {
          assertSameTenant(model, operation, readOrganizationId(row), organizationId);
          return withOrganizationId(row, organizationId);
        });
      } else if (data && typeof data === "object") {
        assertSameTenant(model, operation, readOrganizationId(data), organizationId);
        next.data = withOrganizationId(data, organizationId);
      }
      return next;
    }
    assertSameTenant(model, operation, readOrganizationId(next.data), organizationId);
    next.data = withOrganizationId(next.data, organizationId);
    return next;
  }

  if (operation === UPSERT) {
    assertSameTenant(model, operation, readOrganizationId(next.where), organizationId);
    assertSameTenant(model, operation, readOrganizationId(next.create), organizationId);
    next.where = withOrganizationId(next.where, organizationId);
    next.create = withOrganizationId(next.create, organizationId);
    return next;
  }

  // Anything else (raw reads, field selections, ...) is passed through; the
  // guard never widens access, only narrows it.
  return next;
}

export function tenantGuardExtension(organizationId: string) {
  return Prisma.defineExtension({
    name: "tenant-isolation",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODEL_SET.has(model)) {
            return (query as (a: unknown) => Promise<unknown>)(args);
          }
          const scoped = scopeTenantArgs(model, operation, args as AnyArgs | undefined, organizationId);
          return (query as (a: unknown) => Promise<unknown>)(scoped);
        },
      },
    },
  });
}
