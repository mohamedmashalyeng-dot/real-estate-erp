import "dotenv/config";
import path from "node:path";

/**
 * Shared, dependency-free configuration for the local embedded PostgreSQL
 * cluster used by `npm run db:start` and by the integration test suite.
 *
 * Production deployments never use this: they point DATABASE_URL at a managed
 * PostgreSQL instance.
 */
export const EMBEDDED_PG_USER = "postgres";
export const EMBEDDED_PG_PASSWORD = "password";

export const DEV_DB = {
  port: Number(process.env.DEV_DATABASE_PORT ?? 5433),
  dir: path.resolve(process.cwd(), process.env.DEV_DATABASE_DIR ?? ".pgdata"),
  database: process.env.DEV_DATABASE_NAME ?? "estateiq",
  testDatabase: process.env.TEST_DATABASE_NAME ?? "estateiq_test",
};

export function databaseUrl(database: string, port = DEV_DB.port): string {
  return `postgresql://${EMBEDDED_PG_USER}:${EMBEDDED_PG_PASSWORD}@127.0.0.1:${port}/${database}?schema=public`;
}

export function testDatabaseUrl(): string {
  return databaseUrl(DEV_DB.testDatabase);
}
