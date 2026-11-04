import "dotenv/config";
import os from "node:os";
import path from "node:path";

/**
 * Shared, dependency-free configuration for the local MariaDB server used by
 * `npm run db:start` and by the integration test suite.
 *
 * Production deployments never use this: they point DATABASE_URL at the
 * hosting provider's MySQL/MariaDB database.
 */
export const DEV_DB_USER = "root";
export const DEV_DB_PASSWORD = "password";
export const MARIADB_VERSION = "10.11.19";

const localAppData = process.env.LOCALAPPDATA ?? path.join(os.homedir(), ".cache");

export const DEV_DB = {
  port: Number(process.env.DEV_DATABASE_PORT ?? 3307),
  dir: path.resolve(process.cwd(), process.env.DEV_DATABASE_DIR ?? ".dbdata"),
  database: process.env.DEV_DATABASE_NAME ?? "estateiq",
  testDatabase: process.env.TEST_DATABASE_NAME ?? "estateiq_test",
  /** MariaDB install folder (with bin/mariadbd); downloaded here on Windows when missing. */
  home:
    process.env.DEV_MARIADB_HOME ??
    path.join(localAppData, "estateiq", "mariadb", `mariadb-${MARIADB_VERSION}-winx64`),
};

export function databaseUrl(database: string, port = DEV_DB.port): string {
  return `mysql://${DEV_DB_USER}:${DEV_DB_PASSWORD}@127.0.0.1:${port}/${database}`;
}

export function testDatabaseUrl(): string {
  return databaseUrl(DEV_DB.testDatabase);
}
