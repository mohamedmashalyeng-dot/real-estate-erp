import { rmSync } from "node:fs";
import {
  DEV_DB,
  ensureCluster,
  isClusterInitialised,
  isServerRunning,
  runningPid,
  stopCluster,
} from "./lib/dev-database";

const command = (process.argv[2] ?? "start").toLowerCase();

function log(message: string) {
  console.log(`[db] ${message}`);
}

async function start(): Promise<void> {
  log(`data dir : ${DEV_DB.dir}`);
  const { started, created } = await ensureCluster([DEV_DB.database, DEV_DB.testDatabase]);
  log(started ? `started MariaDB on port ${DEV_DB.port}` : `MariaDB already running on port ${DEV_DB.port}`);
  if (created.length) log(`created databases: ${created.join(", ")}`);
  log(`DATABASE_URL=mysql://root:***@127.0.0.1:${DEV_DB.port}/${DEV_DB.database}`);
  log(`engine log: mariadb.log`);
}

function status(): void {
  if (!isClusterInitialised()) {
    log("data dir not initialised yet (run: npm run db:start)");
    return;
  }
  const pid = runningPid();
  log(isServerRunning() ? `running (pid ${pid}) on port ${DEV_DB.port}` : "stopped");
}

function stop(): void {
  const result = stopCluster();
  log(result.status === 0 ? "stopped" : `stop reported: ${result.stdout}${result.stderr}`);
}

async function reset(): Promise<void> {
  if (isServerRunning()) stopCluster();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  rmSync(DEV_DB.dir, { recursive: true, force: true });
  log("data dir removed (run `npm run db:start` and `npm run db:migrate` to rebuild)");
}

async function main(): Promise<void> {
  switch (command) {
    case "start":
      await start();
      break;
    case "stop":
      stop();
      break;
    case "status":
      status();
      break;
    case "reset":
      await reset();
      break;
    default:
      console.error(`Unknown command "${command}". Use: start | stop | status | reset`);
      process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
