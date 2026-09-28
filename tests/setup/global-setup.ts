import { spawnSync } from "node:child_process";
import { DEV_DB, ensureCluster, testDatabaseUrl } from "../../scripts/lib/dev-database";

/**
 * Boots the embedded PostgreSQL cluster used by the integration tests and
 * applies migrations to the dedicated test database.
 *
 * The test database URL is injected into the test workers through
 * `test.env` in vitest.config.ts, so tests never touch the dev database.
 */
export async function setup(): Promise<void> {
  await ensureCluster([DEV_DB.testDatabase]);

  const url = testDatabaseUrl();
  const result = spawnSync("npx prisma migrate deploy", {
    shell: true,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });

  if (result.status !== 0) {
    throw new Error(
      `prisma migrate deploy failed for the test database (exit code ${result.status})`,
    );
  }
}
