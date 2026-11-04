import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma ORM v7 configuration.
 *
 * v7 no longer reads `.env` implicitly and no longer accepts `url` inside the
 * schema datasource block, so the connection string is wired up here.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Not `env()`: that throws when unset, and `prisma generate` (part of
    // `npm run build`) needs no database, so hosts that only inject
    // DATABASE_URL at runtime can still build.
    url: process.env.DATABASE_URL ?? "",
  },
});
