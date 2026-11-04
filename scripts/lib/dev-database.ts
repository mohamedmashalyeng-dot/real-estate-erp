import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import mariadb from "mariadb";
import { DEV_DB, DEV_DB_PASSWORD, DEV_DB_USER, MARIADB_VERSION } from "./dev-db-config";

export { DEV_DB, databaseUrl, testDatabaseUrl } from "./dev-db-config";

/**
 * Local development/CI MariaDB server.
 *
 * Runs a portable MariaDB build (downloaded once on Windows, or any install
 * named by DEV_MARIADB_HOME) as an independent background `mariadbd` process
 * with its data in DEV_DB.dir: no Docker, no system-wide service.
 */

export function binaryPath(name: string): string {
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  return path.join(DEV_DB.home, "bin", exe);
}

export function logFilePath(): string {
  return path.resolve(process.cwd(), "mariadb.log");
}

function pidFilePath(databaseDir: string): string {
  return path.join(databaseDir, "mariadbd.pid");
}

export function isClusterInitialised(databaseDir: string = DEV_DB.dir): boolean {
  return existsSync(path.join(databaseDir, "mysql"));
}

export function runningPid(databaseDir: string = DEV_DB.dir): number | null {
  const pidFile = pidFilePath(databaseDir);
  if (!existsSync(pidFile)) return null;
  const pid = Number.parseInt(readFileSync(pidFile, "utf8").trim(), 10);
  return Number.isFinite(pid) ? pid : null;
}

export function isServerRunning(databaseDir: string = DEV_DB.dir): boolean {
  const pid = runningPid(databaseDir);
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export function runBinary(name: string, args: string[]): RunResult {
  const result = spawnSync(binaryPath(name), args, { encoding: "utf8", windowsHide: true });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

async function ensureBinaries(): Promise<void> {
  if (existsSync(binaryPath("mariadbd"))) return;
  if (process.platform !== "win32" || process.env.DEV_MARIADB_HOME) {
    throw new Error(
      `MariaDB not found in ${DEV_DB.home}. Install MariaDB ${MARIADB_VERSION}+ and set DEV_MARIADB_HOME to its folder.`,
    );
  }
  const parent = path.dirname(DEV_DB.home);
  const zip = `${DEV_DB.home}.zip`;
  const url = `https://archive.mariadb.org/mariadb-${MARIADB_VERSION}/winx64-packages/mariadb-${MARIADB_VERSION}-winx64.zip`;
  console.log(`[db] downloading MariaDB ${MARIADB_VERSION} (one time)...`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`MariaDB download failed: HTTP ${response.status} for ${url}`);
  mkdirSync(parent, { recursive: true });
  writeFileSync(zip, Buffer.from(await response.arrayBuffer()));
  const result = spawnSync("tar", ["-xf", zip, "-C", parent], { stdio: "inherit", windowsHide: true });
  if (result.status !== 0) throw new Error(`extracting ${zip} failed`);
  rmSync(zip, { force: true });
}

function initialiseDataDir(databaseDir: string): void {
  mkdirSync(path.dirname(databaseDir), { recursive: true });
  const result = runBinary("mariadb-install-db", [
    `--datadir=${databaseDir}`,
    `--password=${DEV_DB_PASSWORD}`,
    `--port=${DEV_DB.port}`,
    "--allow-remote-root-access",
  ]);
  if (result.status !== 0) {
    throw new Error(`mariadb-install-db failed:\n${result.stdout}\n${result.stderr}`);
  }
}

function connect(database?: string) {
  return mariadb.createConnection({
    host: "127.0.0.1",
    port: DEV_DB.port,
    user: DEV_DB_USER,
    password: DEV_DB_PASSWORD,
    database,
    connectTimeout: 2000,
  });
}

async function startServer(databaseDir: string): Promise<void> {
  const child = spawn(
    binaryPath("mariadbd"),
    [
      `--defaults-file=${path.join(databaseDir, "my.ini")}`,
      `--port=${DEV_DB.port}`,
      "--bind-address=127.0.0.1",
      `--pid-file=${pidFilePath(databaseDir)}`,
      `--log-error=${logFilePath()}`,
      // Keep table-name case on Windows, so dumps match case-sensitive Linux servers.
      "--lower-case-table-names=2",
      "--character-set-server=utf8mb4",
      "--collation-server=utf8mb4_unicode_ci",
    ],
    { detached: true, stdio: "ignore", windowsHide: true },
  );
  child.unref();

  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      await (await connect()).end();
      return;
    } catch (error) {
      if (Date.now() > deadline) {
        throw new Error(`MariaDB did not accept connections within 60s (see mariadb.log): ${String(error)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

async function createDatabaseIfMissing(database: string): Promise<boolean> {
  const conn = await connect();
  try {
    const existing: unknown[] = await conn.query("SHOW DATABASES LIKE ?", [database]);
    if (existing.length) return false;
    await conn.query(
      `CREATE DATABASE \`${database.replace(/`/g, "")}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    return true;
  } finally {
    await conn.end();
  }
}

/**
 * Boots (or reuses) the server and makes sure the requested databases exist.
 */
export async function ensureCluster(
  databases: string[] = [DEV_DB.database],
  databaseDir: string = DEV_DB.dir,
): Promise<{ started: boolean; created: string[] }> {
  await ensureBinaries();
  if (!isClusterInitialised(databaseDir)) {
    initialiseDataDir(databaseDir);
  }
  let started = false;
  if (!isServerRunning(databaseDir)) {
    await startServer(databaseDir);
    started = true;
  }
  const created: string[] = [];
  for (const database of databases) {
    if (await createDatabaseIfMissing(database)) created.push(database);
  }
  return { started, created };
}

export function stopCluster(databaseDir: string = DEV_DB.dir): RunResult {
  if (!isServerRunning(databaseDir)) {
    return { status: 0, stdout: "server not running", stderr: "" };
  }
  return runBinary("mariadb-admin", [
    "--host=127.0.0.1",
    `--port=${DEV_DB.port}`,
    `--user=${DEV_DB_USER}`,
    `--password=${DEV_DB_PASSWORD}`,
    "shutdown",
  ]);
}
