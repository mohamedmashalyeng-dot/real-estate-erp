import { PrismaMariaDb } from "@prisma/adapter-mariadb";
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

/**
 * DATABASE_URL is a Prisma-style `mysql://user:password@host:3306/database`
 * URL (MySQL or MariaDB). It is split into driver options so passwords with
 * special characters work once URL-encoded.
 */
function poolConfig(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
    connectionLimit: Number(parsed.searchParams.get("connection_limit") ?? 5),
  };
}

function createPrismaClient(): PrismaClient {
  // Prisma connects on the first query, so DATABASE_URL is only read then:
  // `next build` imports this module on hosts that inject it at runtime only.
  let factory: PrismaMariaDb | undefined;
  const adapter = {
    provider: "mysql" as const,
    adapterName: "@prisma/adapter-mariadb",
    connect() {
      factory ??= new PrismaMariaDb(poolConfig(env.databaseUrl));
      return factory.connect();
    },
  };
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
