import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { DEV_DB, EMBEDDED_PG_PASSWORD, EMBEDDED_PG_USER } from "./dev-db-config";

export { DEV_DB, databaseUrl, testDatabaseUrl } from "./dev-db-config";

/**
 * Local development/CI PostgreSQL cluster.
 *
 * The `embedded-postgres` package ships the official PostgreSQL binaries for
 * the current platform; this module drives those binaries directly through
 * `initdb` / `pg_ctl` so the server runs as an independent background process
 * (no keep-alive wrapper, no Docker, no system-wide install).
 */

export function platformPackageName(): string {
  const platform = process.platform === "win32" ? "windows" : process.platform;
  const arch = process.arch === "x64" ? "x64" : process.arch;
  return `@embedded-postgres/${platform}-${arch}`;
}

export function binaryDir(): string {
  return path.resolve(process.cwd(), "node_modules", platformPackageName(), "native", "bin");
}

export function binaryPath(name: string): string {
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  return path.join(binaryDir(), exe);
}

export function logFilePath(): string {
  return path.resolve(process.cwd(), "pg.log");
}

export function isClusterInitialised(databaseDir: string = DEV_DB.dir): boolean {
  return existsSync(path.join(databaseDir, "PG_VERSION"));
}

export function runningPid(databaseDir: string = DEV_DB.dir): number | null {
  const pidFile = path.join(databaseDir, "postmaster.pid");
  if (!existsSync(pidFile)) return null;
  const [firstLine] = readFileSync(pidFile, "utf8").split("\n");
  const pid = Number.parseInt(firstLine ?? "", 10);
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

export function runBinary(
  name: string,
  args: string[],
  options: { cwd?: string } = {},
): RunResult {
  const result = spawnSync(binaryPath(name), args, {
    cwd: options.cwd ?? binaryDir(),
    encoding: "utf8",
    windowsHide: true,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function initialiseCluster(databaseDir: string): void {
  mkdirSync(databaseDir, { recursive: true });
  const result = runBinary("initdb", [
    "-D",
    databaseDir,
    "-U",
    EMBEDDED_PG_USER,
    "-A",
    "trust",
    "-E",
    "UTF8",
  ]);
  if (result.status !== 0) {
    throw new Error(`initdb failed:\n${result.stdout}\n${result.stderr}`);
  }
}

function startServer(databaseDir: string): void {
  const result = runBinary("pg_ctl", [
    "-D",
    databaseDir,
    "-l",
    logFilePath(),
    "-o",
    `-p ${DEV_DB.port}`,
    "-w",
    "-t",
    "60",
    "start",
  ]);
  if (result.status !== 0) {
    throw new Error(`pg_ctl start failed:\n${result.stdout}\n${result.stderr}`);
  }
}

async function createDatabaseIfMissing(database: string): Promise<boolean> {
  const client = new pg.Client({
    host: "127.0.0.1",
    port: DEV_DB.port,
    user: EMBEDDED_PG_USER,
    password: EMBEDDED_PG_PASSWORD,
    database: "postgres",
  });
  await client.connect();
  try {
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      database,
    ]);
    if (existing.rowCount) return false;
    await client.query(`CREATE DATABASE "${database.replace(/"/g, "")}"`);
    return true;
  } finally {
    await client.end();
  }
}

/**
 * Boots (or reuses) the cluster and makes sure the requested databases exist.
 */
export async function ensureCluster(
  databases: string[] = [DEV_DB.database],
  databaseDir: string = DEV_DB.dir,
): Promise<{ started: boolean; created: string[] }> {
  if (!isClusterInitialised(databaseDir)) {
    initialiseCluster(databaseDir);
  }
  let started = false;
  if (!isServerRunning(databaseDir)) {
    startServer(databaseDir);
    started = true;
  }
  const created: string[] = [];
  for (const database of databases) {
    if (await createDatabaseIfMissing(database)) created.push(database);
  }
  return { started, created };
}

export function stopCluster(databaseDir: string = DEV_DB.dir): RunResult {
  if (!isClusterInitialised(databaseDir)) {
    return { status: 0, stdout: "cluster not initialised", stderr: "" };
  }
  return runBinary("pg_ctl", ["-D", databaseDir, "-m", "fast", "-w", "stop"]);
}

