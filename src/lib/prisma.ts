import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";
import { tenantGuardExtension } from "./tenant";

/**
 * Base Prisma client (Prisma ORM v7, driver-adapter based).
 *
 * IMPORTANT: application code must use `forOrganization(orgId)` below. The
 * base client is reserved for platform-level flows (authentication, seeding,
 * platform admin, tenant discovery).
 */
const globalForPrisma = globalThis as unknown as {
  __estateiqPrisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.databaseUrl });
  return new PrismaClient({
    adapter,
    log:
      process.env.PRISMA_LOG === "1"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });
}

export const prisma: PrismaClient =
  globalForPrisma.__estateiqPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__estateiqPrisma = prisma;
}

/**
 * Returns a tenant-scoped client: every query is forced through the tenant
 * guard, which injects and verifies `organizationId` for tenant-owned models.
 */
export function forOrganization(organizationId: string) {
  if (!organizationId) {
    throw new Error("forOrganization() requires a non-empty organizationId");
  }
  return prisma.$extends(tenantGuardExtension(organizationId));
}

export type TenantScopedClient = ReturnType<typeof forOrganization>;
