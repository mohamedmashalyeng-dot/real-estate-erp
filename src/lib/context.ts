import { cache } from "react";
import { cookies } from "next/headers";
import { auth } from "./auth";
import { ACTIVE_ORGANIZATION_COOKIE } from "./constants";
import { NoOrganizationError, UnauthorizedError } from "./errors";
import { assertPermission, type PermissionKey } from "./permissions";
import { forOrganization, prisma, type TenantScopedClient } from "./prisma";

/**
 * Request-scoped identity & tenant context.
 *
 * The active organization always comes from the authenticated user's
 * memberships — never from client input. The cookie merely remembers which
 * membership the user last selected, and is re-validated on every request.
 */

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  jobTitle: string | null;
  isPlatformAdmin: boolean;
}

export interface MembershipSummary {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationCurrency: string;
  organizationStatus: string;
  roleId: string;
  roleName: string;
  roleSlug: string;
  permissions: string[];
  isPrimary: boolean;
}

export const getCurrentSession = cache(async () => auth());

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getCurrentSession();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== "ACTIVE") return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    jobTitle: user.jobTitle,
    isPlatformAdmin: user.isPlatformAdmin,
  };
});

export const requireUser = cache(async (): Promise<SessionUser> => {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user;
});

export const listMemberships = cache(
  async (userId: string): Promise<MembershipSummary[]> => {
    const rows = await prisma.membership.findMany({
      where: {
        userId,
        status: "ACTIVE",
        organization: { status: { in: ["ACTIVE", "TRIAL"] } },
      },
      include: {
        organization: true,
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
      orderBy: [{ isPrimary: "desc" }, { joinedAt: "asc" }],
    });

    return rows.map((row) => ({
      membershipId: row.id,
      organizationId: row.organizationId,
      organizationName: row.organization.name,
      organizationSlug: row.organization.slug,
      organizationCurrency: row.organization.currency,
      organizationStatus: row.organization.status,
      roleId: row.roleId,
      roleName: row.role.name,
      roleSlug: row.role.slug,
      permissions: row.role.permissions.map((entry) => entry.permission.key),
      isPrimary: row.isPrimary,
    }));
  },
);

export interface OrganizationContext {
  user: SessionUser;
  membership: MembershipSummary;
  memberships: MembershipSummary[];
  organizationId: string;
  currency: string;
  permissions: string[];
  /** Tenant-scoped Prisma client: every query is tenant-guarded. */
  db: TenantScopedClient;
}

async function readActiveOrganizationCookie(): Promise<string | undefined> {
  try {
    const store = await cookies();
    return store.get(ACTIVE_ORGANIZATION_COOKIE)?.value;
  } catch {
    // cookies() is unavailable outside a request scope (e.g. in tests).
    return undefined;
  }
}

export const requireOrganization = cache(async (): Promise<OrganizationContext> => {
  const user = await requireUser();
  const memberships = await listMemberships(user.id);
  if (memberships.length === 0) {
    throw new NoOrganizationError();
  }

  const preferredId = await readActiveOrganizationCookie();
  const membership =
    memberships.find((entry) => entry.organizationId === preferredId) ??
    memberships[0];

  return {
    user,
    membership,
    memberships,
    organizationId: membership.organizationId,
    currency: membership.organizationCurrency,
    permissions: membership.permissions,
    db: forOrganization(membership.organizationId),
  };
});

/** Resolves the context and asserts a single permission (server-side gate). */
export async function requirePermission(
  permission: PermissionKey,
): Promise<OrganizationContext> {
  const context = await requireOrganization();
  assertPermission(context.permissions, permission);
  return context;
}

export async function requireAnyPermission(
  permissions: readonly PermissionKey[],
): Promise<OrganizationContext> {
  const context = await requireOrganization();
  const allowed = permissions.some((permission) =>
    context.permissions.includes(permission),
  );
  if (!allowed) {
    assertPermission(context.permissions, permissions[0]);
  }
  return context;
}

/** Platform (super admin) context: not scoped to tenant permissions. */
export const requirePlatformAdmin = cache(async (): Promise<SessionUser> => {
  const user = await requireUser();
  if (!user.isPlatformAdmin) {
    throw new UnauthorizedError("Platform administrator access is required.");
  }
  return user;
});

export function currentPermissions(context: OrganizationContext): string[] {
  return context.permissions;
}

